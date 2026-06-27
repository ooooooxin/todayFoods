import type { IAuthLoginRes, ICaptcha, IRefreshTokenRes, IUpdateInfo, IUpdatePassword, IUserInfoRes } from './types/login'
import type { ApiResponse } from '@/http/types'
import { showCustomToast } from '@/composables/useCustomToast'
import { http } from '@/http/http'
import { getEnvBaseUrl } from '@/utils'

// 多账号选择时的账号信息
export interface IAccountItem {
  accountId: string | number
  nickname: string
  uniqueCode: string
  avatar: string
}

// 短信登录 code=2004 时的返回结果（需要选择账号）
export interface ISmsLoginMultiAccountResult {
  authTicket: string
  accountList: IAccountItem[]
}

// 多账号选择错误类（用于在 phone.vue 中区分普通错误和多账号场景）
export class MultiAccountError extends Error {
  code: number
  data: ISmsLoginMultiAccountResult
  constructor(data: ISmsLoginMultiAccountResult) {
    super('请选择登录账号')
    this.code = 2004
    this.data = data
  }
}

/**
 * 登录表单
 */
export interface ILoginForm {
  username: string
  password: string
}

/**
 * 获取验证码
 * @returns ICaptcha 验证码
 */
export function getCode() {
  return http.get<ICaptcha>('/user/getCode')
}

/**
 * 用户登录
 * @param loginForm 登录表单
 */
export function login(loginForm: ILoginForm) {
  return http.post<IAuthLoginRes>('/auth/login', loginForm)
}

/**
 * 刷新token
 * @param refreshToken 刷新token
 * @returns Promise 包含新的 accessToken 和 expiresIn
 */
export function refreshToken(refreshToken: string) {
  return http.post<IRefreshTokenRes>('/auth/refreshToken', { refreshToken })
}

/**
 * 获取用户信息
 */
export function getUserInfo() {
  return http.post<IUserInfoRes>('/me/info')
}

/**
 * 退出登录
 */
export function logout() {
  return http.post<void>('/me/logout')
}

/**
 * 修改用户信息
 */
export function updateInfo(data: IUpdateInfo) {
  return http.post('/me/update', data)
}

/**
 * 修改用户密码
 */
export function updateUserPassword(data: IUpdatePassword) {
  return http.post('/user/updatePassword', data)
}

/**
 * 获取微信登录凭证
 * @returns Promise 包含微信登录凭证(code)
 */
export function getWxCode() {
  return new Promise<UniApp.LoginRes>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: res => resolve(res),
      fail: err => reject(new Error(err)),
    })
  })
}

/**
 * 微信手机号授权登录
 * - 正常登录（code=200）：返回 IAuthLoginRes
 * - 关联多账号（code=2004）：抛出 MultiAccountError，包含 authTicket 和 accountList
 * @param data 微信登录参数，包含code, encryptedData, iv
 * @returns Promise 包含登录结果
 */
export function wxMpPhoneLogin(data: { loginCode: string, phoneCode?: string }): Promise<IAuthLoginRes> {
  return new Promise<IAuthLoginRes>((resolve, reject) => {
    const baseUrl = getEnvBaseUrl()
    uni.request({
      url: `${baseUrl}/auth/weChatOneClickLogin`,
      method: 'POST',
      data,
      header: { 'Content-Type': 'application/json' },
      success(res) {
        const resp = res.data as ApiResponse<any>
        if (resp.code === 200 && resp.success) {
          resolve(resp.result as IAuthLoginRes)
        }
        else if (resp.code === 2004) {
          // 手机号关联多个账号，需要用户选择
          reject(new MultiAccountError(resp.result as ISmsLoginMultiAccountResult))
        }
        else {
          // 其他业务错误，正常弹 toast
          showCustomToast({ icon: 'none', title: resp.message || '登录失败，请重试' })
          reject(new Error(resp.message || '登录失败'))
        }
      },
      fail(err) {
        showCustomToast({ icon: 'none', title: '网络错误，换个网络试试' })
        reject(err)
      },
    })
  })
}

/**
 * 抖音小程序端授权登录
 * @param data 包含 code, encryptedData, iv
 * @returns Promise 包含登录结果（token信息）
 */
export function douYinMpLogin(data: { code: string, encryptedData: string, iv: string }) {
  return http.post<IAuthLoginRes>('/auth/douYinMpLogin', data)
}

/**
 * 抖音小程序端手机号授权登录
 * @param data 包含获取手机号的凭证code
 * @returns Promise 包含登录结果（token信息）
 */
export function douYinMpPhoneLogin(data: { code: string }) {
  return http.post<IAuthLoginRes>('/auth/douYinMpPhoneLogin', data)
}

/**
 * 发送短信验证码
 * @param data 包含手机号、验证码标识、滑块验证码Token（可选）
 * @returns Promise
 */
export function sendSmsCode(data: { phone: string, codeFlag: 'LOGIN' | 'BIND_PHONE', captchaToken?: string }) {
  return http.post<void>('/auth/sms/sendCode', data)
}

/**
 * 短信验证码登录
 * - 正常登录（code=200）：返回 IAuthLoginRes
 * - 关联多账号（code=2004）：抛出 MultiAccountError，包含 authTicket 和 accountList
 * @param data 包含手机号和验证码
 */
export function smsLogin(data: { phone: string, code: string }): Promise<IAuthLoginRes> {
  return new Promise<IAuthLoginRes>((resolve, reject) => {
    const baseUrl = getEnvBaseUrl()
    uni.request({
      url: `${baseUrl}/auth/smsLogin`,
      method: 'POST',
      data,
      header: { 'Content-Type': 'application/json' },
      success(res) {
        const resp = res.data as ApiResponse<any>
        if (resp.code === 200 && resp.success) {
          resolve(resp.result as IAuthLoginRes)
        }
        else if (resp.code === 2004) {
          // 手机号关联多个账号，需要用户选择
          reject(new MultiAccountError(resp.result as ISmsLoginMultiAccountResult))
        }
        else {
          // 其他业务错误，正常弹 toast
          showCustomToast({ icon: 'none', title: resp.message || '登录失败，请重试' })
          reject(new Error(resp.message || '登录失败'))
        }
      },
      fail(err) {
        showCustomToast({ icon: 'none', title: '网络错误，换个网络试试' })
        reject(err)
      },
    })
  })
}

/**
 * 选择账号登录
 * 手机号关联多账号时，用户选择其中一个账号登录
 * @param data 包含 authTicket（票据）和 accountId（账号ID）
 * @returns Promise 包含登录结果（token信息）
 */
export function selectAccount(data: { authTicket: string, accountId: string | number }) {
  return http.post<IAuthLoginRes>('/auth/selectAccount', data)
}

/**
 * 查询当前用户关联的账号列表
 */
export function getAssociatedAccounts() {
  return http.get<any[]>('/me/associatedAccounts', undefined, undefined, { hideErrorToast: true })
}

/**
 * 切换账号登录（已登录状态下）
 * @param data 目标账号ID
 */
export function switchAccountLogin(data: { targetAccountId: number | string }) {
  return http.post<IAuthLoginRes>('/me/switchAccount', data)
}
