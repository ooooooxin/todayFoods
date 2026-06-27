<script setup lang="ts">
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { hideCustomToast } from '@/composables/useCustomToast'
import { applyRouteInterceptor } from '@/router/interceptor'

// 监听页面栈变化，处理返回按钮场景
let lastPageLength = 0
let checkTimer: ReturnType<typeof setInterval> | null = null

onLaunch((options) => {
  console.log('App.vue onLaunch', options)
})
onShow((options) => {
  console.log('App.vue onShow', options)
  // 处理直接进入页面路由的情况：如h5直接输入路由、微信小程序分享后进入等
  // https://github.com/unibest-tech/unibest/issues/192
  if (options?.path) {
    applyRouteInterceptor({ url: `/${options.path}`, query: options.query })
  }
  else {
    applyRouteInterceptor({ url: '/' })
  }

  // 启动定时器检查页面栈变化（处理返回按钮场景）
  lastPageLength = getCurrentPages().length
  checkTimer = setInterval(() => {
    const pages = getCurrentPages()
    const currentLength = pages.length
    // 页面栈长度变化时（返回或跳转），隐藏 toast
    if (currentLength !== lastPageLength) {
      hideCustomToast()
      lastPageLength = currentLength
    }
  }, 100)
})
onHide(() => {
  console.log('App Hide')
  // 清除定时器
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
})
</script>

<style lang="scss">
@import 'uview-pro/index.scss';
</style>
