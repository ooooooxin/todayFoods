<script lang="ts" setup>
import { computed } from 'vue'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const isVisible = computed({
  get: () => props.show,
  set: val => emit('update:show', val),
})

function handleConfirm() {
  emit('confirm')
  isVisible.value = false
}

function handleCancel() {
  emit('cancel')
  isVisible.value = false
}
</script>

<template>
  <view v-if="isVisible" class="fixed inset-0 z-[9999] flex items-center justify-center">
    <!-- Mask -->
    <view class="absolute inset-0 bg-black/50 transition-opacity" @click="handleCancel" />

    <!-- Popup Content -->
    <view class="relative z-10 h-[544rpx] w-[580rpx] rounded-b-[32rpx] bg-white">
      <image
        src="/static/images/login_popup_top.png"
        mode="scaleToFill"
        class="absolute left-0 top-[-138rpx] h-[140rpx] w-full"
      />

      <!-- Top Image -->
      <view class="relative left-40rpx top-[-106rpx] w-full flex items-center">
        <view class="mt-[70rpx] flex flex-col text-[44rpx] text-[#333] font-semibold line-height-[60rpx]">
          <text>手机号登录后</text>
          <text>即可创作</text>
        </view>
        <image
          src="/static/images/logo3d.png"
          mode="aspectFit"
          class="block h-[260rpx] w-[260rpx]"
        />
      </view>

      <view class="relative left-40rpx top-[-106rpx] w-[500rpx] center text-[28rpx] text-[#666] line-height-[44rpx]">
        <text>当前账号为第三方授权登录，创作功能仅支持手机号登录用户使用，请使用手机号登录后进行创作。</text>
      </view>

      <!-- Bottom Content -->
      <view class="relative top-[-66rpx] px-[48rpx]">
        <view class="flex flex-col gap-[32rpx]">
          <!-- Login Button -->
          <view
            class="h-[88rpx] flex items-center justify-center rounded-full bg-primary"
            @click="handleConfirm"
          >
            <text class="text-[32rpx] text-[#fff] font-semibold">去登录</text>
          </view>

          <!-- Cancel Button -->
          <view
            class="center pt-16rpx"
            @click="handleCancel"
          >
            <text class="text-[28rpx] text-[#999] line-height-[44rpx]">取消</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
</style>
