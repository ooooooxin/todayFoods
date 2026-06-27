import { useTokenStore } from '@/store/token'
import { toLoginPage } from '@/utils/toLoginPage'

/**
 * 检查是否已登录。
 * 如果未登录，会自动跳转到登录页。
 * 可以传入回调函数，在已登录的情况下执行。
 * @param callback 登录校验成功后执行的回调（可选）
 * @returns 登录状态， true: 已登录, false: 未登录
 */
export function requireLogin(callback?: () => void): boolean {
  const tokenStore = useTokenStore()
  if (!tokenStore.hasLogin) {
    toLoginPage()
    return false
  }

  if (callback) {
    callback()
  }
  return true
}
