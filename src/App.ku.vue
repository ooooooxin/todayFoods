<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import CustomLogo from '@/components/custom-logo/custom-logo.vue'
import FgCustomToast from '@/components/fg-custom-toast/fg-custom-toast.vue'
import ToTop from '@/components/to-top/to-top.vue'
import { usePageScrollStore } from '@/store/pageScroll'
import FgTabbar from '@/tabbar/index.vue'
import { isPageTabbar } from './tabbar/store'
import { currRoute } from './utils'

const pageScrollStore = usePageScrollStore()
const { toTopBottom } = storeToRefs(pageScrollStore)

const isCurrentPageTabbar = ref(true)
const isLoginPage = ref(false)

onShow(() => {
  console.log('App.ku.vue onShow', currRoute())
  const { path } = currRoute()
  // 本地是 '/pages/index/index'，线上是 '/' 导致线上 tabbar 不见了
  // 所以这里需要判断一下，如果是 '/' 就当做首页，也要显示 tabbar
  if (path === '/') {
    isCurrentPageTabbar.value = true
  }
  else {
    isCurrentPageTabbar.value = isPageTabbar(path)
  }
  // 判断是否是登录页面
  isLoginPage.value = path === '/pages/login/index'
})

const helloKuRoot = ref('Hello AppKuVue')

const exposeRef = ref('this is form app.Ku.vue')

defineExpose({
  exposeRef,
})
</script>

<template>
  <view class="h-full flex flex-1 flex-col">
    <!-- 这个先隐藏了，知道这样用就行 -->
    <view class="hidden text-center">
      {{ helloKuRoot }}，这里可以配置全局的东西
      用法参考：https://github.com/uni-ku/root
    </view>

    <!-- 微信小程序自定义导航栏Logo -->
    <!-- #ifdef MP-WEIXIN || H5 -->
    <CustomLogo :is-login-page="isLoginPage" />
    <!-- #endif -->

    <KuRootView />

    <FgTabbar v-if="isCurrentPageTabbar" />

    <!-- 回到顶部按钮 -->
    <ToTop :bottom="toTopBottom" />

    <!-- 全局自定义 Toast（各端小程序 + H5） -->
    <FgCustomToast />
  </view>
</template>
