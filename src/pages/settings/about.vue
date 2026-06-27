<script lang="ts" setup>
import type { SystemConfig } from '@/api/common'
import { onMounted, ref } from 'vue'
import { getSystemConfig } from '@/api/common'
import { showCustomToast } from '@/composables/useCustomToast'

definePage({
  style: {
    navigationBarTitleText: '',
  },
})

const config = ref<SystemConfig | null>(null)

// 获取app版本号
const appVersion = ref('V2.0.0')

onMounted(async () => {
  try {
    config.value = await getSystemConfig()
  }
  catch (error) {
    console.error('获取配置失败', error)
  }
})

function openWebView(url: string, title: string) {
  if (!url) {
    showCustomToast({ title: '暂未配置', icon: 'none' })
    return
  }
  uni.navigateTo({
    url: `/pages/settings/webview?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`,
  })
}

const menuItems = [
  {
    label: '服务协议',
    key: 'userAgreementUrl',
  },
  {
    label: '隐私政策',
    key: 'privacyPolicyUrl',
  },
  //   {
  //     label: '未成年人个人信息保护规则',
  //     key: 'minorsPersonalInfoProtectionUrl',
  //   },
  // {
  //   label: '侵权联系',
  //   key: 'customerServiceEmail',
  //   isEmail: true,
  // },
]

function handleMenuClick(item: typeof menuItems[0]) {
  const url = config.value?.[item.key as keyof SystemConfig]
  // if (item.isEmail) {
  //   // 侵权联系用邮件
  //   uni.showModal({
  //     title: '侵权联系',
  //     content: `请发送邮件至：${url || config.value?.customerServiceEmail || '暂未配置'}`,
  //     showCancel: false,
  //     confirmText: '知道了',
  //   })
  //   return
  // }
  openWebView(url as string, item.label)
}
</script>

<template>
  <view class="relative min-h-screen">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="关于KANOO" text-color="text-main" />

    <!-- App 图标和版本 -->
    <view class="relative z-10 flex flex-col items-center pb-60rpx pt-60rpx">
      <view class="mb-24rpx h-180rpx w-180rpx overflow-hidden rounded-36rpx">
        <image class="h-full w-full" src="/static/images/login_about.png" mode="aspectFill" />
      </view>
      <text class="text-28rpx text-[#333]">版本号：{{ appVersion }}</text>
    </view>

    <!-- 菜单列表 -->
    <view class="relative z-10 mx-30rpx overflow-hidden rounded-20rpx bg-white">
      <view
        v-for="(item, index) in menuItems"
        :key="item.key"
        class="flex items-center justify-between px-30rpx py-40rpx"
        :class="{ 'border-t-[1rpx] border-t-[#f5f5f5] border-t-solid': index > 0 }"
        @click="handleMenuClick(item)"
      >
        <text class="text-32rpx text-[#666]">{{ item.label }}</text>
        <i class="iconfont icon-a-shuxingxianxingmingchengtiaozhuanzhuangtaioff inline-block rotate-180 text-40rpx text-[#999]" />
      </view>
    </view>
  </view>
</template>
