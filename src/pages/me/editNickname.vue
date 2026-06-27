<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
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

// 优先从 store 读取，若读不到则直接从持久化存储读取（兼容抖音安卓小程序 store hydration 时序问题）
function getInitialNickname(): string {
  const fromStore = userInfo.value.nickname || userInfo.value.uniqueCode || ''
  if (fromStore)
    return fromStore
  // 直接从 Storage 读取
  try {
    const raw = uni.getStorageSync('user')
    if (raw) {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      return data?.userInfo?.nickname || data?.userInfo?.uniqueCode || data?.nickname || data?.uniqueCode || ''
    }
  }
  catch (e) {
    console.warn('getStorageSync fallback failed', e)
  }
  return ''
}

const initialNickname = getInitialNickname()
const nickname = ref(initialNickname)
const maxLen = 12
let _initialValue = initialNickname
let _userHasTyped = false
const isFocused = ref(false)

// 处理输入事件（过滤抖音安卓原生组件挂载时触发的空值 input 事件）
function onNicknameInput(e: any) {
  const val = e.detail.value ?? ''
  // 拦截：组件挂载时触发的空值事件，不覆盖已有值
  if (!_userHasTyped && val === '' && nickname.value !== '') {
    return
  }
  _userHasTyped = true
  nickname.value = val
}

function onFocus() {
  isFocused.value = true
}

function onBlur() {
  // 延迟失焦，确保点击清除按钮的事件能先触发
  setTimeout(() => {
    isFocused.value = false
  }, 150)
}

// 备用：若同步初始化时仍未获取到，通过 watch 等 store 就绪后填充
if (!initialNickname) {
  const stopWatch = watch(
    () => userInfo.value.nickname || userInfo.value.uniqueCode || '',
    (val) => {
      if (val && !nickname.value) {
        nickname.value = val
        _initialValue = val
        stopWatch()
      }
    },
  )
}

const charCount = computed(() => nickname.value.length)

// 是否已编辑过
const hasEdited = computed(() => nickname.value.trim() !== _initialValue)

// 名字格式校验：中文、英文、数字、下划线（_）、中点（·）及表情
function validateNicknameFormat(val: string): boolean {
  let rest = val.replace(/[\u4E00-\u9FA5\w·]/g, '')
  rest = rest.replace(/\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF]/g, '')
  rest = rest.replace(/[\u2600-\u27BF]/g, '')
  return rest === ''
}

function onClear() {
  nickname.value = ''
  _userHasTyped = true
}

async function onSave() {
  // 未编辑过，不允许保存
  if (!hasEdited.value) {
    return
  }

  const val = nickname.value.trim()

  // 1. 前端格式校验
  if (!val) {
    showCustomToast({ title: '名字不可为空', icon: 'none' })
    return
  }

  if (val.length < 2 || val.length > 12) {
    showCustomToast({ title: '名字需为2–12字符', icon: 'none' })
    return
  }

  if (!validateNicknameFormat(val)) {
    showCustomToast({ title: '仅支持中文、英文、数字、下划线（_）、中点（·）及表情', icon: 'none' })
    return
  }

  // 2. 提交后端校验（包含敏感词检测）
  try {
    uni.showLoading({ title: '保存中...' })
    await updateUserInfo({ nickname: val })
    await userStore.fetchUserInfo()
    uni.hideLoading()
    showCustomToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  }
  catch (error: any) {
    uni.hideLoading()
    // 根据错误信息判断是否为敏感词
    const errorMsg = error?.message || ''
    if (errorMsg.includes('敏感词') || errorMsg.includes('违规')) {
      showCustomToast({ title: '名字包含敏感词语，请修改', icon: 'none' })
    }
    else {
      showCustomToast({ title: errorMsg || '保存失败，请重试', icon: 'none' })
    }
  }
}
</script>

<template>
  <view class="min-h-screen bg-[#f5f5f5]">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="编辑名字" text-color="text-main" />

    <!-- 输入区 -->
    <view class="mx-30rpx mt-30rpx overflow-hidden rounded-20rpx bg-white px-30rpx py-32rpx">
      <view class="flex items-center">
        <input
          :value="nickname"
          class="flex-1 text-30rpx text-[#181818]"
          :maxlength="maxLen"
          auto-focus
          placeholder="请输入名字"
          placeholder-class="text-[#999]"
          @input="onNicknameInput"
          @focus="onFocus"
          @blur="onBlur"
        >
        <view class="flex items-center gap-16rpx">
          <!-- 清空 -->
          <view v-if="nickname && isFocused" class="h-44rpx w-44rpx flex items-center justify-center rounded-full" @click="onClear">
            <image class="h-44rpx w-44rpx" src="/static/images/ic_clear.png" mode="aspectFit" />
          </view>
          <!-- 字数 -->
          <text class="text-26rpx text-[#999]">{{ charCount }}/{{ maxLen }}</text>
        </view>
      </view>
    </view>
    <text class="block px-56rpx pt-24rpx text-24rpx text-[#666] line-height-40rpx">请设置2–12个字符，仅支持中文、英文、数字、下划线（_）、中点（·）及表情。30天内可修改1次名字， {{ userStore.userInfo.canUpdateNickname ? '当前可修改' : `下次可修改时间为：${userStore.userInfo.nextNicknameUpdateTime}` }}</text>
    <!-- 保存按钮 -->
    <view class="mt-32rpx w-full">
      <view
        class="mx-30rpx h-96rpx flex items-center justify-center rounded-full text-center" :class="[
          hasEdited ? 'bg-primary' : 'bg-[#ECECEC]',
        ]"
        @click="onSave"
      >
        <text
          class="block w-full text-center text-32rpx font-bold" :class="[
            hasEdited ? 'text-[#fff]' : 'text-[#999]',
          ]"
        >
          保存
        </text>
      </view>
    </view>
  </view>
</template>
