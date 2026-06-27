<script lang="ts" setup>
/**
 * 全局自定义 Toast，依赖 useCustomToast 状态
 * 仅做展示，业务侧调用 showCustomToast / hideCustomToast
 */
import { customToastState } from '@/composables/useCustomToast'
</script>

<template>
  <view
    v-if="customToastState.visible"
    class="fg-custom-toast pointer-events-none fixed left-0 top-0 z-[100000] box-border h-full w-full flex items-center justify-center px-60rpx"
  >
    <view
      class="pointer-events-none max-w-[560rpx] min-w-[200rpx] rounded-16rpx px-40rpx py-28rpx"
      style="background-color: rgba(0, 0, 0, 0.82);"
    >
      <!-- <view v-if="customToastState.icon === 'success'" class="mb-12rpx flex justify-center">
        <text class="text-48rpx text-primary font-bold leading-none">✓</text>
      </view>
      <view v-else-if="customToastState.icon === 'error'" class="mb-12rpx flex justify-center">
        <text class="text-48rpx leading-none text-[#ff4d4f] font-bold">✕</text>
      </view> -->
      <text class="block text-center text-24rpx text-white leading-[40rpx]">
        {{ customToastState.title }}
      </text>
    </view>
  </view>
</template>
