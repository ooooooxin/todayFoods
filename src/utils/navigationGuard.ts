/**
 * 路由防重复：同一 url 在冷却时间内再次跳转会被拦截（避免连点重复打开同一页面）。
 * 说明：项目内通用防抖见 @/utils/debounce；此处按「url + 时间窗」实现，避免全局 debounce
 * 误拦截「短时间内连续跳转到不同页面」的场景。
 */
const COOLDOWN_MS = 450

let lastUrl = ''
let lastAt = 0

/**
 * @param url - uni.navigateTo / switchTab 等传入的 url
 * @returns true 表示应拦截本次跳转（重复触发）
 */
export function isNavigationDuplicateBlocked(url: string | undefined | null): boolean {
  if (url == null || url === '')
    return false

  const now = Date.now()
  if (url === lastUrl && now - lastAt < COOLDOWN_MS)
    return true

  lastUrl = url
  lastAt = now
  return false
}

export function resetNavigationGuard() {
  lastUrl = ''
  lastAt = 0
}
