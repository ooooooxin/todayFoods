<script setup lang="ts">
import { ref, watch } from 'vue'
import { createCollection, updateCollection } from '@/api/creativeSpace/creativeSpace'
import { showCustomToast } from '@/composables/useCustomToast'
import { usePageScrollStore } from '@/store/pageScroll'
import { debounce } from '@/utils/debounce'

interface Props {
  visible: boolean
  type?: 'create' | 'edit'
  collectionName?: string
  collectionId?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'create',
  collectionName: '',
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'cancel'): void
  (e: 'success'): void
}>()

const pageScrollStore = usePageScrollStore()

const showPopup = defineModel<boolean>('visible', { default: false })

/** 请求进行中，避免并发重复提交 */
const isSubmitting = ref(false)
const TAP_DEBOUNCE_MS = 300

// 输入框值
const inputValue = ref('')

// 监听visible变化，初始化输入框
watch(() => props.visible, (val) => {
  if (val) {
    inputValue.value = props.type === 'edit' ? props.collectionName : ''
  }
}, { immediate: true })

// 蒙层展示期间隐藏 App.ku 内「回到顶部」并禁止页面下拉刷新和触摸穿透
watch(showPopup, (v) => {
  pageScrollStore.setBackToTopSuppressed(v)
  pageScrollStore.setInteractionDisabled(v)
})

// 关闭弹窗
function handleClose() {
  emit('update:visible', false)
  emit('cancel')
}

// 无效字符正则表达式
const invalidCharsRegex = /[#@%&\s]/

// 确认
async function handleConfirm() {
  if (isSubmitting.value)
    return

  const name = inputValue.value.trim()
  if (!name) {
    showCustomToast({ title: '请输入合集名称', icon: 'none' })
    return
  }

  // 校验字符长度（2-12个字符）
  if (name.length < 2 || name.length > 12) {
    showCustomToast({ title: '合集名称需为2-12个字符', icon: 'none' })
    return
  }

  // 校验无效字符
  if (invalidCharsRegex.test(name)) {
    showCustomToast({ title: '名称不能包含#@%&空格等无效字符', icon: 'none' })
    return
  }

  isSubmitting.value = true

  try {
    if (props.type === 'create') {
      // 创建合集
      await createCollection({ title: name })
      showCustomToast({ title: '创建成功', icon: 'success' })
    }
    else {
      // 编辑合集
      if (!props.collectionId) {
        showCustomToast({ title: '合集ID不存在', icon: 'none' })
        isSubmitting.value = false
        return
      }
      await updateCollection({ id: props.collectionId, title: name })
      showCustomToast({ title: '修改成功', icon: 'success' })
    }
    emit('update:visible', false)
    emit('success')
  }
  catch (error) {
    console.error(props.type === 'create' ? '创建合集失败' : '修改合集失败', error)
    showCustomToast({ title: error, icon: 'none' })
  }
  finally {
    isSubmitting.value = false
  }
}

const debouncedConfirm = debounce(
  () => void handleConfirm(),
  TAP_DEBOUNCE_MS,
  { edges: ['leading'] },
)

// 清除输入
function handleClear() {
  inputValue.value = ''
}
</script>

<template>
  <!-- 使用 u-popup 组件 -->
  <u-popup
    v-model="showPopup"
    mode="bottom"
    :zoom="false"
    :mask-close-able="true"
    :closeable="false"
    border-radius="24"
    height="76%"
    @close="handleClose"
  >
    <view class="h-full flex flex-col bg-[#f5f5f5]">
      <!-- 顶部标题栏 -->
      <view class="h-96rpx center px-32rpx">
        <text class="text-32rpx text-[#181818] font-bold">
          {{ type === 'create' ? '创建合集' : '编辑合集名称' }}
        </text>
      </view>

      <!-- 输入区域 -->
      <view class="px-32rpx">
        <!-- 合集名称输入 -->
        <view>
          <view class="h-104rpx flex items-center rounded-16rpx bg-[#fff] px-24rpx">
            <input
              v-model="inputValue"
              class="flex-1 text-28rpx text-[#181818]"
              :placeholder="type === 'create' ? '请输入合集名称' : '请输入新的合集名称'"
              placeholder-class="text-[#999]"
              maxlength="12"
              minlength="2"
              cursor-spacing="30"
            >
            <view class="ml-16rpx flex items-center gap-16rpx">
              <!-- 清除图标 -->
              <image
                v-if="inputValue"
                src="/static/images/ic_clear.png"
                class="h-32rpx w-32rpx"
                @click="handleClear"
              />
              <!-- 字数统计 -->
              <text class="text-28rpx text-[#999]">{{ inputValue.length }}/12</text>
            </view>
          </view>
        </view>

        <view class="mt-24rpx">
          <text class="text-24rpx text-[#666]">请设置2-12个字符，不包括#@%&空格等无效字符</text>
        </view>

        <!-- 底部按钮区域 -->
        <view class="mt-40rpx flex items-center gap-20rpx">
          <!-- 确认按钮 -->
          <view
            class="box-border h-100rpx w-full flex items-center justify-center rounded-full bg-primary"
            @click="debouncedConfirm"
          >
            <text class="text-32rpx text-white font-bold">{{ type === 'create' ? '确认创建' : '确认修改' }}</text>
          </view>
        </view>

        <!-- 创建模式：显示提示文字 -->
        <view v-if="type === 'create'" class="mt-30rpx pb-40rpx">
          <text class="text-24rpx text-[#666] line-height-40rpx">创建合集后会生成该合集唯一口令。口令是合集的专属分享入口，用户可通过口令直接访问你的合集。</text>
        </view>
      </view>
    </view>
  </u-popup>
</template>
