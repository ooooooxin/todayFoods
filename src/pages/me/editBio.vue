<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { updateUserInfo } from '@/api/common'
import { showCustomToast, showCustomToastAfterHideLoading } from '@/composables/useCustomToast'
import { useUserStore } from '@/store/user'

definePage({
  style: {
    navigationBarTitleText: '',
  },
})

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

// 优先从 store 读取，若读不到则直接从持久化存储读取（兼容抖音安卓小程序 store hydration 时序问题）
function getInitialBio(): string {
  const fromStore = userInfo.value.bio ?? ''
  if (fromStore)
    return fromStore
  // 直接从 Storage 读取
  try {
    const raw = uni.getStorageSync('user')
    if (raw) {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw
      return data?.userInfo?.bio ?? data?.bio ?? ''
    }
  }
  catch (e) {
    console.warn('getStorageSync fallback failed', e)
  }
  return ''
}

const initialBio = getInitialBio()
const bio = ref<string>(initialBio)
const maxLen = 100
const isSaving = ref(false)
let _initialValue = initialBio
let _userHasTyped = false

// 处理输入事件（过滤抖音安卓原生组件挂载时触发的空值 input 事件）
function onBioInput(e: any) {
  let val = e.detail.value ?? ''
  // 拦截：组件挂载时触发的空值事件，不覆盖已有值
  if (!_userHasTyped && val === '' && bio.value !== '') {
    return
  }
  _userHasTyped = true
  // 粘贴导致超限时截断并提示
  if (val.length > maxLen) {
    val = val.slice(0, maxLen)
    showCustomToast({ title: '已达最大字数限制', icon: 'none', duration: 2500 })
  }
  bio.value = val
}

// 兜底：抖音安卓某些键盘清除操作不触发 @input，blur 时强制同步实际值
function onBioBlur(e: any) {
  let val = e.detail.value ?? ''
  _userHasTyped = true
  if (val.length > maxLen) {
    val = val.slice(0, maxLen)
  }
  bio.value = val
}

// 备用：若同步初始化时仍未获取到，通过 watch 等 store 就绪后填充
if (!initialBio) {
  const stopWatch = watch(
    () => userInfo.value.bio ?? '',
    (val) => {
      if (val && !bio.value) {
        bio.value = val
        _initialValue = val
        stopWatch()
      }
    },
  )
}

const charCount = computed(() => bio.value.length)

// 是否已编辑过
const hasEdited = computed(() => bio.value.trim() !== _initialValue)

// 简介格式校验：禁止 emoji、非常用字符
function validateBioFormat(val: string): boolean {
  // 禁止 emoji 和非常用字符
  // 允许：中文、英文、数字、常用标点符号（。，、；：？！""''（）《》【】—…·）
  // 检测常见 emoji 范围
  // eslint-disable-next-line no-misleading-character-class
  const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF]+|[\u2600-\u27BF]/
  if (emojiPattern.test(val)) {
    return false
  }

  // 检查是否只包含允许的字符
  const allowedRegex = /^[\u4E00-\u9FA5a-z0-9\s.,;:?!"'()《》【】—…·、，。；：？！（）]*$/i
  return allowedRegex.test(val)
}

// 检查是否包含联系方式/引流信息（前端初筛）
function containsContactInfo(val: string): boolean {
  // 简单的前端初筛，检测常见引流关键词
  const patterns = [
    /微信|wx|weixin|vx/i,
    /qq|q群|扣扣/i,
    /电话|手机|tel|phone/i,
    /加我|联系我|私聊/,
    /http|www\.|.com|.cn/i,
  ]
  return patterns.some(pattern => pattern.test(val))
}

async function onSave() {
  // 未编辑过或正在保存中，不允许保存
  if (!hasEdited.value || isSaving.value) {
    return
  }

  const val = bio.value.trim()

  // 1. 前端格式校验
  if (val.length > maxLen) {
    showCustomToast({ title: '已达最大字数限制', icon: 'none', duration: 2500 })
    return
  }

  if (!validateBioFormat(val)) {
    showCustomToast({ title: '包含不支持的字符，请修改后再保存', icon: 'none', duration: 2500 })
    return
  }

  if (containsContactInfo(val)) {
    showCustomToast({ title: '包含不合规内容，请修改后再保存', icon: 'none', duration: 2500 })
    return
  }

  // 2. 提交后端校验（包含敏感词、引流词检测）
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    isSaving.value = true
    uni.showLoading({ title: '保存中...' })

    const savePromise = (async () => {
      await updateUserInfo({ bio: val })
      await userStore.fetchUserInfo()
    })()
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('TIMEOUT')), 10000)
    })
    await Promise.race([savePromise, timeoutPromise])
    clearTimeout(timeoutId)

    uni.hideLoading()
    showCustomToastAfterHideLoading({ title: '保存成功', icon: 'none', duration: 2500 })
    setTimeout(() => uni.navigateBack(), 800)
  }
  catch (error: any) {
    clearTimeout(timeoutId)
    uni.hideLoading()
    const errorMsg = error?.message || ''
    if (errorMsg === 'TIMEOUT') {
      showCustomToastAfterHideLoading({ title: '检测超时，请重试', icon: 'none', duration: 2500 })
    }
    else if (errorMsg.includes('敏感词') || errorMsg.includes('违规') || errorMsg.includes('联系方式') || errorMsg.includes('引流') || errorMsg.includes('不合规')) {
      showCustomToastAfterHideLoading({ title: '包含不合规内容，请修改后再保存', icon: 'none', duration: 2500 })
    }
    else {
      showCustomToastAfterHideLoading({ title: '保存失败，请稍后重试', icon: 'none', duration: 2500 })
    }
  }
  finally {
    isSaving.value = false
  }
}
</script>

<template>
  <view class="min-h-screen bg-[#f5f5f5]">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="编辑简介" text-color="text-main" />

    <!-- 文本域 -->
    <view class="relative mx-30rpx mt-30rpx overflow-hidden rounded-20rpx bg-white px-30rpx py-32rpx">
      <textarea
        :value="bio"
        class="min-h-[420rpx] w-full text-30rpx text-[#181818] leading-relaxed"
        :maxlength="maxLen"
        placeholder="介绍一下自己"
        placeholder-class="text-[#999]"
        auto-height
        @input="onBioInput"
        @blur="onBioBlur"
      />
      <text class="absolute bottom-24rpx right-30rpx text-24rpx text-[#999]">{{ charCount }}/{{ maxLen }}</text>
    </view>

    <!-- 保存按钮 -->
    <view class="mt-32rpx w-full">
      <view
        class="mx-30rpx h-96rpx flex items-center justify-center rounded-full text-center" :class="[
          hasEdited && !isSaving ? 'bg-primary' : 'bg-[#ECECEC]',
        ]"
        @click="onSave"
      >
        <text
          class="block w-full text-center text-32rpx font-bold" :class="[
            hasEdited && !isSaving ? 'text-[#fff]' : 'text-[#999]',
          ]"
        >
          {{ isSaving ? '保存中...' : '保存' }}
        </text>
      </view>
    </view>
  </view>
</template>
