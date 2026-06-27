import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 全局页面滚动距离（px），供 ToTop 等根级组件使用。
 * uni-app 的 onPageScroll 只在 pages 路由页生效，App.ku.vue 中无法收到。
 */
export const usePageScrollStore = defineStore('pageScroll', () => {
  const scrollTop = ref(0)
  /** 全屏弹层等需盖住 App.ku 内「回到顶部」时置为 true（页面内 z-index 无法压过根级 fixed） */
  const backToTopSuppressed = ref(false)
  /** 页面内容是否超出一页需要滚动，由父级页面判断后传入 */
  const canScroll = ref(false)
  /** 触发回到顶部的计数器（用于通知页面执行回到顶部操作） */
  const backToTopTrigger = ref(0)
  /** ToTop 组件的 bottom 值，页面可动态设置以避免被底部固定元素遮挡 */
  const toTopBottom = ref('')
  /** 全屏弹层等需禁止页面下拉刷新和触摸穿透时置为 true */
  const interactionDisabled = ref(false)

  function setScrollTop(y: number) {
    scrollTop.value = Math.max(0, y)
  }

  function setBackToTopSuppressed(v: boolean) {
    backToTopSuppressed.value = v
  }

  function setCanScroll(v: boolean) {
    canScroll.value = v
  }

  /** 触发回到顶部操作 */
  function triggerBackToTop() {
    backToTopTrigger.value++
  }

  function setToTopBottom(v: string) {
    toTopBottom.value = v
  }

  function setInteractionDisabled(v: boolean) {
    interactionDisabled.value = v
  }

  return {
    scrollTop,
    backToTopSuppressed,
    canScroll,
    backToTopTrigger,
    toTopBottom,
    interactionDisabled,
    setScrollTop,
    setBackToTopSuppressed,
    setCanScroll,
    triggerBackToTop,
    setToTopBottom,
    setInteractionDisabled,
  }
})
