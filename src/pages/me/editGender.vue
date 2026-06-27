<script lang="ts" setup>
import { computed, ref } from 'vue'
import { updateUserInfo } from '@/api/common'
import { showCustomToast } from '@/composables/useCustomToast'
import { useUserStore } from '@/store/user'

definePage({
  style: {
    navigationBarTitleText: '',
  },
})

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

const selectedGender = ref<number>(userInfo.value.gender || 0)
const showPublic = ref(userInfo.value.setting?.genderPublic ?? true)

// 保存初始状态，用于判断是否有变更
const _saved = {
  gender: userInfo.value.gender || 0,
  showPublic: userInfo.value.setting?.genderPublic ?? true,
}

const canSave = computed(() => {
  if (!selectedGender.value)
    return false
  return selectedGender.value !== _saved.gender
    || showPublic.value !== _saved.showPublic
})

const options = [
  { label: '男', value: 1 },
  { label: '女', value: 2 },
]

async function onSave() {
  if (!canSave.value)
    return

  if (!selectedGender.value) {
    showCustomToast({ title: '请选择性别', icon: 'none' })
    return
  }
  try {
    uni.showLoading({ title: '保存中...' })
    await updateUserInfo({
      gender: { value: selectedGender.value, showPublic: showPublic.value },
    })
    await userStore.fetchUserInfo()
    uni.hideLoading()
    showCustomToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  }
  catch (e: any) {
    uni.hideLoading()
    const msg = e?.message || '保存失败，请重试'
    showCustomToast({ title: msg, icon: 'none' })
  }
}
</script>

<template>
  <view class="min-h-screen bg-[#f5f5f5]">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="编辑性别" text-color="text-main" />

    <!-- 性别选项 -->
    <view class="mx-30rpx mt-30rpx overflow-hidden rounded-20rpx bg-white">
      <view
        v-for="(opt, index) in options"
        :key="opt.value"
        class="flex items-center justify-between px-30rpx py-40rpx"
        :class="{ 'border-b-solid border-b-[2rpx] border-b-[#6666661A]': index < options.length - 1 }"
        @click="selectedGender = opt.value"
      >
        <text
          class="text-30rpx"
          :class="selectedGender === opt.value ? 'text-[#181818] font-bold' : 'text-[#999]'"
        >
          {{ opt.label }}
        </text>
        <!-- 选中时显示 ✓ -->
        <text v-if="selectedGender === opt.value" class="text-30rpx text-[#181818] font-bold">✓</text>
      </view>
    </view>

    <!-- 是否公开展示性别标签 -->
    <view class="mx-30rpx mt-24rpx overflow-hidden rounded-20rpx bg-white px-30rpx py-40rpx">
      <view class="flex items-center justify-between">
        <text class="text-30rpx text-[#666666]">是否公开展示性别标签</text>
        <switch
          class="switch-small"
          :checked="showPublic"
          color="#333"
          @change="showPublic = $event.detail.value"
        />
      </view>
    </view>

    <!-- 保存 -->
    <view class="mt-32rpx w-full">
      <view
        class="mx-30rpx h-96rpx flex items-center justify-center rounded-full text-center transition-opacity"
        :class="canSave ? 'bg-primary' : 'bg-[#ECECEC] opacity-80'"
        @click="canSave && onSave()"
      >
        <text
          class="block w-full text-center text-32rpx font-bold"
          :class="canSave ? 'text-[#fff]' : 'text-[#999]'"
        >
          保存
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.switch-small {
  transform: scale(0.7);
  transform-origin: right center;
}
</style>
