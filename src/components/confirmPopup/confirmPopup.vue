<script setup lang="ts">
interface Props {
  visible: boolean
  title?: string
  message?: string
  cancelText?: string
  confirmText?: string
  showCancel?: boolean
}

withDefaults(defineProps<Props>(), {
  title: '确认',
  message: '',
  cancelText: '取消',
  confirmText: '确认',
  showCancel: true,
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function handleCancel() {
  emit('update:visible', false)
  emit('cancel')
}

function handleConfirm() {
  emit('confirm')
}
</script>

<template>
  <u-popup
    :model-value="visible"
    mode="center"
    :zoom="false"
    :mask-close-able="false"
    :closeable="false"
    border-radius="32"
    width="580rpx"
    height="auto"
  >
    <view class="flex flex-col items-center pa-40rpx">
      <text class="text-[36rpx] text-[#333] font-semibold">{{ title }}</text>
      <rich-text v-if="message" class="mt-16rpx w-[450rpx] text-center text-[#999] line-height-[48rpx]" :nodes="message" />
      <view class="mt-40rpx w-full flex flex-row gap-24rpx" :class="{ 'justify-center': !showCancel }">
        <view
          v-if="showCancel"
          class="flex flex-1 items-center justify-center rounded-full bg-[#F5F5F5] px-40rpx py-24rpx"
          @tap="handleCancel"
        >
          <text class="text-[32rpx] text-[#333] font-semibold">{{ cancelText }}</text>
        </view>
        <view
          class="flex flex-1 items-center justify-center rounded-full bg-[#333] px-40rpx py-24rpx"
          @tap="handleConfirm"
        >
          <text class="text-[32rpx] text-white font-semibold">{{ confirmText }}</text>
        </view>
      </view>
    </view>
  </u-popup>
</template>
