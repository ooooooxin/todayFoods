import type { IDoubleTokenRes } from '@/api/types/login'
import type { ApiResponse, CustomRequestOptions } from '@/http/types'
import { showCustomToast } from '@/composables/useCustomToast'
import { useTokenStore } from '@/store/token'
import { isDoubleTokenMode } from '@/utils'
import { toLoginPage } from '@/utils/toLoginPage'

// 刷新 token 状态管理
let isRefreshing = false // 防止重复刷新 token 标识
let requestQueue: ((newAccessToken: string) => void)[] = [] // 刷新 token 请求队列
const hasRefreshedMap = new WeakMap<CustomRequestOptions, boolean>() // 记录请求是否已刷新过 token
let _isHandlingLogout = false // 防止 logout 接口本身触发再次 logout（死循环）

/**
 * 安全退出：带防重入保护，http.ts 内部使用
 */
async function _safeLogout() {
  if (_isHandlingLogout)
    return
  _isHandlingLogout = true
  try {
    const tokenStore = useTokenStore()
    await tokenStore.logout()
  }
  finally {
    _isHandlingLogout = false
  }
}

// loading 延迟显示管理
const loadingTimerMap = new Map<string, ReturnType<typeof setTimeout>>() // 存储每个请求的 loading 定时器
const LOADING_DELAY = 1000 // loading 延迟显示时间（1秒）

export function http<T>(options: CustomRequestOptions) {
  // 1. 返回 Promise 对象
  return new Promise<T>((resolve, reject) => {
    // 生成请求唯一标识
    const requestId = `${options.url}_${Date.now()}_${Math.random()}`

    // 检查网络状态
    uni.getNetworkType({
      success: (res) => {
        if (res.networkType === 'none' || res.networkType === 'offline') {
          // 无网络，跳转到异常页面
          uni.navigateTo({
            url: '/pages/exception/index?type=network&showButton=1',
          })
          return reject(new Error('无网络连接'))
        }

        // 有网络，继续发送请求
        sendRequest()
      },
      fail: () => {
        // 获取网络状态失败，尝试发送请求
        sendRequest()
      },
    })

    function sendRequest() {
      // 延迟显示 loading（除非请求配置中设置了 hideLoading: true）
      if (!options.hideLoading) {
        const timer = setTimeout(() => {
          uni.showLoading({
            title: '加载中...',
            mask: true,
          })
          loadingTimerMap.delete(requestId)
        }, LOADING_DELAY)
        loadingTimerMap.set(requestId, timer)
      }

      uni.request({
        ...options,
        dataType: 'json',
        // #ifndef MP-WEIXIN
        responseType: 'json',
        // #endif
        // 响应成功
        success: async (res) => {
        // 清除 loading 定时器并隐藏 loading
          if (!options.hideLoading) {
            const timer = loadingTimerMap.get(requestId)
            if (timer) {
              clearTimeout(timer)
              loadingTimerMap.delete(requestId)
            }
            else {
            // 定时器已执行（loading 已显示），需要隐藏
              uni.hideLoading()
            }
          }

          const responseData = res.data as ApiResponse<T>
          const { code, success } = responseData

          // 402 refresh_token过期 - 强制退出登录
          if (code === 402) {
            console.log('🔒 refresh_token已过期，强制退出登录')
            await _safeLogout()
            setTimeout(() => {
              toLoginPage()
            }, 2000)
            return reject(new Error('refresh_token已过期'))
          }

          // 403 被顶下线 - 强制退出登录
          if (code === 403) {
            console.log('🔒 账号在其他设备登录，被顶下线')
            showCustomToast({
              title: responseData.message || '您的账号在其他设备登录，请重新登录',
              icon: 'none',
              duration: 2000,
            })
            await _safeLogout()
            setTimeout(() => {
              toLoginPage()
            }, 2000)
            return reject(new Error('被顶下线'))
          }

          // 401 未授权 - 判断是否需要刷新token
          const isTokenExpired = res.statusCode === 401 || code === 401

          if (isTokenExpired) {
            const tokenStore = useTokenStore()

            // 检查这个请求是否已经刷新过token
            if (hasRefreshedMap.get(options)) {
            // 已经刷新过token但仍然401，说明token无效，直接退出登录
              console.log('🔒 刷新token后仍然401，强制退出登录')
              await _safeLogout()
              hasRefreshedMap.delete(options)
              toLoginPage()
              return reject(res)
            }

            if (!isDoubleTokenMode) {
            // 未启用双token策略，清理用户信息，跳转到登录页
              console.log('🔒 单token模式，跳转登录页')
              await _safeLogout()
              toLoginPage()
              return reject(res)
            }

            /* -------- 无感刷新 token ----------- */
            const { refreshToken } = tokenStore.tokenInfo as IDoubleTokenRes || {}

            // 检查是否有refreshToken
            if (!refreshToken) {
              console.log('🔒 无refreshToken，跳转登录页')
              await _safeLogout()
              toLoginPage()
              return reject(res)
            }

            // 如果正在刷新token，将当前请求加入队列
            if (isRefreshing) {
              console.log('🔄 正在刷新token，将请求加入队列')
              return new Promise<T>((resolveRequest) => {
                requestQueue.push((newAccessToken: string) => {
                // 标记这个请求已刷新过token
                  hasRefreshedMap.set(options, true)
                  // 使用新token重新请求
                  http<T>(options).then(resolveRequest).catch(reject)
                })
              })
            }

            // 开始刷新token
            isRefreshing = true
            console.log('🔄 开始刷新token')

            try {
            // 发起刷新 token 请求
              await tokenStore.refreshToken()
              const newAccessToken = tokenStore.validToken

              console.log('✅ token刷新成功')

              // 执行队列中的所有请求
              requestQueue.forEach(callback => callback(newAccessToken))
              requestQueue = []

              // 标记当前请求已刷新过token
              hasRefreshedMap.set(options, true)

              // 重新执行当前请求
              return resolve(http<T>(options))
            }
            catch (refreshErr: any) {
              console.error('❌ 刷新token失败:', refreshErr)

              // 清空请求队列
              requestQueue = []

              // 判断是否是refreshToken过期（401）
              if (refreshErr?.statusCode === 401 || refreshErr?.data?.code === 401) {
                console.log('🔒 refreshToken已过期，强制退出登录')
              }

              // 清除用户信息并跳转登录页
              await _safeLogout()
              setTimeout(() => {
                toLoginPage()
              }, 2000)

              return reject(refreshErr)
            }
            finally {
              isRefreshing = false
            }
          }

          // 处理其他成功状态（HTTP状态码200-299）
          if (res.statusCode >= 200 && res.statusCode < 300) {
          // 处理业务逻辑错误
            if (!success) {
              if (responseData.code === 4100) { // 素材不可访问
                return reject(responseData)
              }
              if (responseData.code === 4005) { // IP不可访问
                return reject(responseData)
              }
              if (responseData.code === 4002) { // 系列不可访问
                return reject(responseData)
              }
              if (responseData.code === 2005) { // 登录凭证已过期等状态
                return reject(responseData)
              }
              if (responseData.code !== 4002) {
                showCustomToast({
                  icon: 'none',
                  title: responseData.message || '请求错误',
                })
              }
              return reject(new Error(responseData.message || '请求错误'))
            }
            // 返回 result 字段
            return resolve(responseData.result)
          }

          // 处理其他错误
          !options.hideErrorToast
          && showCustomToast({
            icon: 'none',
            title: responseData.message || '请求错误',
          })

          reject(res)
        },
        // 响应失败
        fail(err) {
        // 清除 loading 定时器并隐藏 loading
          if (!options.hideLoading) {
            const timer = loadingTimerMap.get(requestId)
            if (timer) {
              clearTimeout(timer)
              loadingTimerMap.delete(requestId)
            }
            else {
            // 定时器已执行（loading 已显示），需要隐藏
              uni.hideLoading()
            }
          }

          showCustomToast({
            icon: 'none',
            title: '网络错误，换个网络试试',
          })
          reject(err)
        },
      })
    }
  })
}

/**
 * GET 请求
 * @param url 后台地址
 * @param query 请求query参数
 * @param header 请求头，默认为json格式
 * @returns
 */
export function httpGet<T>(url: string, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    query,
    method: 'GET',
    header,
    ...options,
  })
}

/**
 * POST 请求
 * @param url 后台地址
 * @param data 请求body参数
 * @param query 请求query参数，post请求也支持query，很多微信接口都需要
 * @param header 请求头，默认为json格式
 * @returns
 */
export function httpPost<T>(url: string, data?: Record<string, any>, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    query,
    data,
    method: 'POST',
    ...options,
    header: {
      ...options?.header,
      ...header,
    },
  })
}
/**
 * PUT 请求
 */
export function httpPut<T>(url: string, data?: Record<string, any>, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    data,
    query,
    method: 'PUT',
    header,
    ...options,
  })
}

/**
 * DELETE 请求（无请求体，仅 query）
 */
export function httpDelete<T>(url: string, query?: Record<string, any>, header?: Record<string, any>, options?: Partial<CustomRequestOptions>) {
  return http<T>({
    url,
    query,
    method: 'DELETE',
    header,
    ...options,
  })
}

// 支持与 axios 类似的API调用
http.get = httpGet
http.post = httpPost
http.put = httpPut
http.delete = httpDelete

// 支持与 alovaJS 类似的API调用
http.Get = httpGet
http.Post = httpPost
http.Put = httpPut
http.Delete = httpDelete
