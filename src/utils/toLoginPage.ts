import { getLastPage } from '@/utils'
import { debounce } from '@/utils/debounce'

const HOME_TAB = '/pages/index/index'
const LOGIN_PATHS = ['/pages/login/index', '/pages/login/phone', '/pages/me/switchAccount']

/**
 * 登录成功后返回原页面
 * 统计页面栈顶部连续的登录页数量，navigateBack 跳过所有登录页
 * 若无可返回的非登录页，则 switchTab 跳转首页（微信小程序会报错，改为reLaunch）
 */
export function navigateAfterLogin() {
  const pages = getCurrentPages()
  let delta = 0
  for (let i = pages.length - 1; i >= 0; i--) {
    const route = `/${(pages[i] as any).route}`
    if (LOGIN_PATHS.some(p => route.startsWith(p))) {
      delta++
    }
    else {
      break
    }
  }
  if (delta > 0 && pages.length > delta) {
    uni.navigateBack({ delta })
  }
  else {
    uni.reLaunch({ url: HOME_TAB })
  }
}

interface ToLoginPageOptions {
  /**
   * 跳转模式, uni.navigateTo | uni.reLaunch
   * @default 'navigateTo'
   */
  mode?: 'navigateTo' | 'reLaunch'
  /**
   * 查询参数
   * @example '?redirect=/pages/home/index'
   */
  queryString?: string
}

// TODO: 自己增加登录页
const LOGIN_PAGE = '/pages/login/index'

/**
 * 跳转到登录页, 带防抖处理
 *
 * 如果要立即跳转，不做延时，可以使用 `toLoginPage.flush()` 方法
 */
export const toLoginPage = debounce((options: ToLoginPageOptions = {}) => {
  const { mode = 'navigateTo', queryString = '' } = options

  const url = `${LOGIN_PAGE}${queryString}`

  // 获取当前页面路径
  const currentPage = getLastPage()
  const currentPath = currentPage ? `/${currentPage.route}` : ''
  // 如果已经在登录页，则不跳转
  if (currentPath === LOGIN_PAGE) {
    return
  }

  let finalMode = mode
  // 当在“我的”页面由于接口报错导致 token 过期时，强制 reLaunch，避免可以返回到骨架屏
  if (currentPath === '/pages/me/index') {
    finalMode = 'reLaunch'
  }

  if (finalMode === 'navigateTo') {
    uni.navigateTo({ url })
  }
  else {
    uni.reLaunch({ url })
  }
}, 500)
