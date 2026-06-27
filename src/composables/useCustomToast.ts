import { reactive } from 'vue'

/**
 * 自定义 Toast（纯 view 实现，各端小程序 + H5 + App 通用）
 * 使用：任意处调用 showCustomToast / hideCustomToast，或 useCustomToast()
 * 需在 App.ku.vue 挂载 <FgCustomToast />
 */

export type CustomToastIcon = 'none' | 'success' | 'error'

export interface ShowCustomToastOptions {
  /** 提示文案 */
  title: string
  /** 展示毫秒，默认 2000；传 0 表示不自动关闭，需手动 hideCustomToast */
  duration?: number
  icon?: CustomToastIcon
}

export const customToastState = reactive({
  visible: false,
  title: '',
  icon: 'none' as CustomToastIcon,
})

let hideTimer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

export function showCustomToast(options: ShowCustomToastOptions) {
  clearTimer()
  customToastState.title = options.title
  customToastState.icon = options.icon ?? 'none'
  customToastState.visible = true

  const duration = options.duration ?? 2500
  if (duration > 0) {
    hideTimer = setTimeout(() => {
      customToastState.visible = false
      hideTimer = null
    }, duration)
  }
}

export function hideCustomToast() {
  clearTimer()
  customToastState.visible = false
}

/**
 * 在 uni.hideLoading() 之后调用：部分小程序里立刻 show 自定义层会被原生 loading 影响，短延迟更稳
 */
export function showCustomToastAfterHideLoading(
  options: ShowCustomToastOptions,
  delayMs = 80,
) {
  setTimeout(() => showCustomToast(options), delayMs)
}

export function useCustomToast() {
  return {
    show: showCustomToast,
    hide: hideCustomToast,
    showAfterHideLoading: showCustomToastAfterHideLoading,
    state: customToastState,
  }
}
