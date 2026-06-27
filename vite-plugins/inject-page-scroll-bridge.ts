import type { Plugin } from 'vite'

/**
 * 为每个 pages 路由页注入 usePageScrollBridge()，
 * 否则 onPageScroll 只在页面组件内生效，App.ku.vue 无法监听滚动。
 */
const SCRIPT_OPEN_RE = /<script\s[^>]+>/g

export function injectPageScrollBridgePlugin(): Plugin {
  return {
    name: 'inject-page-scroll-bridge',
    enforce: 'pre',
    transform(code, id) {
      // 去掉 query（如 index.vue?vue&type=script），否则 endsWith('.vue') 失败导致未注入
      const normalized = id.replace(/\\/g, '/').split('?')[0]
      if (!normalized.includes('/src/pages/') || !normalized.endsWith('.vue'))
        return null
      if (code.includes('usePageScrollBridge'))
        return null

      SCRIPT_OPEN_RE.lastIndex = 0
      let match: RegExpExecArray | null = null
      for (const m of code.matchAll(SCRIPT_OPEN_RE)) {
        if (m[0].includes('setup')) {
          match = m
          break
        }
      }
      if (!match || match.index === undefined)
        return null

      const inject = `\nimport { usePageScrollBridge } from '@/hooks/usePageScrollBridge'\nusePageScrollBridge()\n`
      const end = match.index + match[0].length
      return code.slice(0, end) + inject + code.slice(end)
    },
  }
}
