/**
 * 路由拦截，通常也是登录拦截
 * 黑、白名单的配置，请看 config.ts 文件， EXCLUDE_LOGIN_PATH_LIST
 */
import { hideCustomToast } from '@/composables/useCustomToast'
import { tabbarStore } from '@/tabbar/store'
import { getAllPages, getLastPage, parseUrlToObj } from '@/utils/index'
import { isNavigationDuplicateBlocked } from '@/utils/navigationGuard'

export const FG_LOG_ENABLE = false

function applyRouteInterceptorImpl(
  { url, query }: { url: string, query?: Record<string, string> },
  /** 为 true 时在校验通过后拦截同 url 短间隔重复跳转（uni 路由 API）；App onShow 仅同步 tabbar 应传 false */
  useNavigationDuplicateGuard: boolean,
): false | void {
  if (url === undefined) {
    return
  }
  let { path, query: _query } = parseUrlToObj(url)

  FG_LOG_ENABLE && console.log('\n\n路由拦截器:-------------------------------------')
  FG_LOG_ENABLE && console.log('路由拦截器 1: url->', url, ', query ->', query)
  const myQuery = { ..._query, ...query }
  // /pages/route-interceptor/index?name=feige&age=30
  FG_LOG_ENABLE && console.log('路由拦截器 2: path->', path, ', _query ->', _query)
  FG_LOG_ENABLE && console.log('路由拦截器 3: myQuery ->', myQuery)

  // 处理相对路径
  if (!path.startsWith('/')) {
    const currentPath = getLastPage()?.route || ''
    const normalizedCurrentPath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`
    const baseDir = normalizedCurrentPath.substring(0, normalizedCurrentPath.lastIndexOf('/'))
    path = `${baseDir}/${path}`
  }

  // 处理路由不存在的情况
  if (path !== '/' && !getAllPages().some(page => page.path !== path)) {
    console.warn('路由不存在:', path)
    return false // 明确表示阻止原路由继续执行
  }

  // 插件页面
  if (url.startsWith('plugin://')) {
    FG_LOG_ENABLE && console.log('路由拦截器 4: plugin:// 路径 ==>', url)
    path = url
  }

  if (useNavigationDuplicateGuard && isNavigationDuplicateBlocked(url))
    return false

  // 处理直接进入路由非首页时，tabbarIndex 不正确的问题
  tabbarStore.setAutoCurIdx(path)
}

/**
 * App 冷启动 / onShow 等仅校正 tabbar，不参与「防重复跳转」。
 */
export function applyRouteInterceptor(args: { url: string, query?: Record<string, string> }): false | void {
  return applyRouteInterceptorImpl(args, false)
}

export const navigateToInterceptor = {
  // 注意，这里的url是 '/' 开头的，如 '/pages/index/index'，跟 'pages.json' 里面的 path 不同
  // 增加对相对路径的处理，BY 网友 @ideal
  invoke(args: { url: string, query?: Record<string, string> }) {
    // 页面跳转前隐藏 toast
    hideCustomToast()
    return applyRouteInterceptorImpl(args, true)
  },
}

export const routeInterceptor = {
  install() {
    uni.addInterceptor('navigateTo', navigateToInterceptor)
    uni.addInterceptor('reLaunch', navigateToInterceptor)
    uni.addInterceptor('redirectTo', navigateToInterceptor)
    uni.addInterceptor('switchTab', navigateToInterceptor)
  },
}
