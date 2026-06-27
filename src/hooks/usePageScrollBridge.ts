import { onPageScroll, onShow } from '@dcloudio/uni-app'
import { getCurrentInstance, nextTick, onMounted, onUnmounted } from 'vue'
import { usePageScrollStore } from '@/store/pageScroll'

/** 获取应用平台信息 */
function getUniPlatform(): string | undefined {
  try {
    // #ifdef MP-WEIXIN || MP-ALIPAY
    // 微信/支付宝小程序使用新的 app base API
    return uni.getAppBaseInfo().uniPlatform
    // #endif

    // #ifndef MP-WEIXIN || MP-ALIPAY
    // 其他平台使用旧 API
    return (uni.getSystemInfoSync() as { uniPlatform?: string }).uniPlatform
    // #endif
  }
  catch {
    return undefined
  }
}

/** 是否为 H5 / Web（不要用 document 判断，抖音等小程序环境可能带不完整 document 桩） */
function isUniWebLike(): boolean {
  const p = getUniPlatform()
  return p === 'web' || p === 'h5'
}

/** 是否为头条/抖音小程序（uni 通常上报 mp-toutiao） */
function isMpToutiaoLike(): boolean {
  const p = getUniPlatform()
  return p === 'mp-toutiao'
}

/** 解析 selectViewport.scrollOffset 的 exec 结果（各端可能是数组或单对象） */
function parseViewportScrollTop(res: unknown): number | undefined {
  if (res == null)
    return undefined
  if (Array.isArray(res)) {
    const first = res[0] as { scrollTop?: number } | undefined
    if (first && typeof first.scrollTop === 'number')
      return first.scrollTop
    return undefined
  }
  const obj = res as { scrollTop?: number }
  if (typeof obj.scrollTop === 'number')
    return obj.scrollTop
  return undefined
}

/** 解析 onPageScroll 事件（部分端可能把距离放在 detail） */
function parsePageScrollEvent(e: { scrollTop?: number, detail?: { scrollTop?: number } } | null | undefined): number {
  if (e == null)
    return 0
  if (typeof e.scrollTop === 'number')
    return e.scrollTop
  if (typeof e.detail?.scrollTop === 'number')
    return e.detail.scrollTop
  return 0
}

/**
 * 将当前页面的滚动同步到全局 store，供 App.ku 中的 ToTop 等组件使用。
 * 由 vite 插件自动注入到每个 pages 下的路由页，也可在页面内手动调用。
 *
 * 抖音/头条小程序说明：
 * - 勿用 typeof document 判断 H5，否则可能误走 DOM 分支；
 * - selectViewport() 针对的是**当前原生页面**的视口，不要对字节系再 .in(页面内 Vue 组件)：
 *   页面切换/返回瞬间，原生当前页与组件树可能短暂不一致，会触发 TMA「SelectorQuery 不可跨页使用 .in」
 *   且轮询会每秒刷数十条告警；非字节端仍可对节点查询使用 .in(proxy) 以兼容部分端 scrollOffset。
 */
export function usePageScrollBridge() {
  const store = usePageScrollStore()
  const instance = getCurrentInstance()
  const isToutiao = isMpToutiaoLike()

  const syncFromViewport = () => {
    try {
      let query = uni.createSelectorQuery()
      const proxy = instance?.proxy
      if (proxy && !isToutiao)
        query = query.in(proxy as any)
      query
        .selectViewport()
        .scrollOffset((res: { scrollTop?: number }) => {

        })
        .exec((res: unknown) => {
          const top = parseViewportScrollTop(res)
          if (typeof top === 'number')
            store.setScrollTop(top)
        })
    }
    catch {
      // 忽略
    }
  }

  // 仅真实 H5：监听 uni-page-body / window（与小程序环境隔离）
  if (isUniWebLike() && typeof document !== 'undefined') {
    const cleanups: Array<() => void> = []

    const readScrollTop = (): number => {
      const pageBody = document.querySelector('uni-page-body') as HTMLElement | null
      let top = pageBody?.scrollTop ?? 0
      if (top === 0 && typeof window !== 'undefined') {
        top = window.scrollY
          || document.documentElement?.scrollTop
          || document.body?.scrollTop
          || 0
      }
      return top
    }

    const onDomScroll = () => {
      store.setScrollTop(readScrollTop())
    }

    onMounted(() => {
      nextTick(() => {
        const pageBody = document.querySelector('uni-page-body') as HTMLElement | null
        if (pageBody) {
          pageBody.addEventListener('scroll', onDomScroll, { passive: true })
          cleanups.push(() => pageBody.removeEventListener('scroll', onDomScroll))
        }
        if (typeof window !== 'undefined') {
          window.addEventListener('scroll', onDomScroll, { passive: true })
          cleanups.push(() => window.removeEventListener('scroll', onDomScroll))
        }
        onDomScroll()
      })
    })

    onUnmounted(() => {
      cleanups.forEach(fn => fn())
      cleanups.length = 0
    })
  }

  onShow(() => {
    nextTick(() => {
      const runSync = () => syncFromViewport()
      // 字节系：返回上一页时延后到原生页切换完成再读视口，避免偶发 0 或与旧页串台
      if (isToutiao) {
        setTimeout(runSync, 50)
      }
      else {
        runSync()
      }
    })
  })

  onPageScroll((e) => {
    store.setScrollTop(parsePageScrollEvent(e))
  })
}
