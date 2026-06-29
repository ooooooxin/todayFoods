<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useAppStore } from '@/store/appMode'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

defineOptions({
  name: 'Me',
})

definePage({
  style: {
    navigationBarTitleText: '个人中心',
    navigationStyle: 'custom',
  },
})

const appStore = useAppStore()

// 状态栏与导航栏高度计算
const statusBarHeight = ref(systemInfo.statusBarHeight || 0)
const navBarHeight = ref(statusNavTotalHeight - statusBarHeight.value)

const isHealth = computed(() => appStore.mode === 'health')
const themeColor = computed(() => appStore.themeColor)

// 新加黑/白名单输入框
const newWhite = ref('')
const newBlack = ref('')

function addWhite() {
  if (!newWhite.value.trim())
    return
  appStore.addToWhitelist(newWhite.value.trim())
  newWhite.value = ''
  uni.showToast({
    title: '添加喜爱成功',
    icon: 'success',
  })
}

function addBlack() {
  if (!newBlack.value.trim())
    return
  appStore.addToBlacklist(newBlack.value.trim())
  newBlack.value = ''
  uni.showToast({
    title: '拉黑食物成功',
    icon: 'success',
  })
}

// 统计分析
const stats = computed(() => {
  const list = appStore.history
  const total = list.length
  if (total === 0) {
    return { healthRate: 0, takeawayCount: 0, savedMoney: 0, fatLoss: 0 }
  }

  const healthCount = list.filter(item => item.mode === 'health').length
  const healthRate = Math.round((healthCount / total) * 100)

  // 模拟外卖率 (普通模式算外卖，健康模式算轻食自炊)
  const takeawayCount = list.filter(item => item.mode === 'normal').length
  const savedMoney = healthCount * 15 // 每顿轻食/自煮省钱15元
  const fatLoss = (healthCount * 0.1).toFixed(1) // 每顿轻食减脂约0.1kg

  return {
    healthRate,
    takeawayCount,
    savedMoney,
    fatLoss,
  }
})

// 客服与反馈
const feedbackText = ref('')
const feedbackContact = ref('')

function submitFeedback() {
  if (!feedbackText.value.trim()) {
    uni.showToast({
      title: '请输入反馈内容',
      icon: 'none',
    })
    return
  }

  uni.showModal({
    title: '反馈已提交',
    content: '您的宝贵建议已上传！开发组会在24小时内与您联系回复。',
    showCancel: false,
    confirmText: '好的',
  })

  feedbackText.value = ''
  feedbackContact.value = ''
}
</script>

<template>
  <view class="me-container min-h-screen pb-20 transition-all duration-500" :style="{ background: appStore.themeGradient }">
    <!-- 自定义顶部状态栏 -->
    <view :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="flex items-center px-4" :style="{ height: `${navBarHeight}px` }">
        <text class="text-xl text-gray-800 font-black">个人中心</text>
      </view>
    </view>

    <!-- 个人头部卡片 -->
    <view class="px-4 py-2">
      <view class="flex items-center gap-4 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
        <image
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
          class="h-16 w-16 border-2 rounded-full shadow-sm"
          :style="{ borderColor: themeColor }"
        />
        <view class="flex-1">
          <text class="block text-base text-gray-800 font-black">干饭达人小杰</text>
          <view class="mt-1 flex items-center gap-1.5">
            <view class="text-4xs flex items-center rounded px-2 py-0.5 text-white font-bold" :style="{ background: themeColor }">
              <view v-if="isHealth" class="i-carbon-sprout mr-1 inline-block h-3 w-3 align-middle text-xs text-white" />
              <view v-else class="i-carbon-restaurant mr-1 inline-block h-3 w-3 align-middle text-xs text-white" />
              {{ isHealth ? '减脂模范生' : '资深干饭人' }}
            </view>
            <text class="text-3xs text-gray-500 font-semibold">健康指数: {{ stats.healthRate }}%</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 饮食数据仪表盘 -->
    <view class="mx-4 mb-6 mt-2 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <view class="mb-4 block flex items-center text-sm text-gray-800 font-black">
        <view class="i-carbon-chart-bar mr-1.5 inline-block h-4 w-4 align-middle text-blue-600" />
        近期干饭周报分析
      </view>

      <view class="grid grid-cols-2 gap-4">
        <view class="flex flex-col border border-gray-100/50 rounded-2xl bg-gray-50 p-3">
          <text class="text-3xs text-gray-400 font-bold">轻食健康率</text>
          <text class="mt-1 text-lg text-green-700 font-black">{{ stats.healthRate }}%</text>
          <text class="text-4xs mt-0.5 text-gray-400">多吃轻食对身体好哦</text>
        </view>

        <view class="flex flex-col border border-gray-100/50 rounded-2xl bg-gray-50 p-3">
          <text class="text-3xs text-gray-400 font-bold">本周外卖频次</text>
          <text class="mt-1 text-lg text-orange-600 font-black">{{ stats.takeawayCount }} 次</text>
          <text class="text-4xs mt-0.5 text-gray-400">外卖重油重盐注意避坑</text>
        </view>

        <view class="flex flex-col border border-gray-100/50 rounded-2xl bg-gray-50 p-3">
          <text class="text-3xs text-gray-400 font-bold">累计省钱 (自煮估算)</text>
          <text class="mt-1 text-lg text-gray-800 font-black">¥{{ stats.savedMoney }}</text>
          <text class="text-4xs mt-0.5 text-gray-400">每顿健康自煮均省¥15</text>
        </view>

        <view class="flex flex-col border border-gray-100/50 rounded-2xl bg-gray-50 p-3">
          <text class="text-3xs text-gray-400 font-bold">轻食预计减脂</text>
          <text class="mt-1 text-lg text-emerald-600 font-black">-{{ stats.fatLoss }} kg</text>
          <text class="text-4xs mt-0.5 text-gray-400">离完美身材又进一步</text>
        </view>
      </view>
    </view>

    <!-- 黑白名单管理 (偏好避坑) -->
    <view class="mx-4 mb-6 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <view class="mb-4 block flex items-center text-sm text-gray-800 font-black">
        <view class="i-carbon-favorite mr-1.5 inline-block h-4 w-4 align-middle text-red-500" />
        个人偏好管理
      </view>

      <!-- 白名单：最爱吃 -->
      <view class="mb-5">
        <view class="mb-2 block flex items-center text-xs text-gray-700 font-bold">
          <view class="i-carbon-star-filled mr-1 inline-block h-3.5 w-3.5 align-middle text-yellow-500" />
          白名单（必定会优先推荐）：
        </view>
        <view class="mb-2.5 flex flex-wrap gap-1.5">
          <view
            v-for="item in appStore.whitelist"
            :key="item"
            class="flex items-center gap-1 border border-green-100 rounded-lg bg-green-50 px-2 py-1 text-3xs text-green-700 font-extrabold"
          >
            {{ item }}
            <text class="cursor-pointer text-red-500 font-bold" @click="appStore.removeFromWhitelist(item)">×</text>
          </view>
          <view v-if="appStore.whitelist.length === 0" class="text-4xs text-gray-400 font-bold">
            暂无偏好菜品
          </view>
        </view>
        <view class="flex gap-2">
          <input v-model="newWhite" placeholder="输入你想吃的美食 (如：牛肉炒面)" class="flex-1 border rounded-xl bg-gray-50 px-3 py-1.5 text-xs">
          <button class="shadow-xs rounded-xl bg-green-600 px-3.5 text-3xs text-white font-black" @click="addWhite">
            添加
          </button>
        </view>
      </view>

      <!-- 黑名单：绝不吃 -->
      <view>
        <view class="mb-2 block flex items-center text-xs text-gray-700 font-bold">
          <view class="i-carbon-misuse mr-1 inline-block h-3.5 w-3.5 align-middle text-red-500" />
          黑名单（绝不出现在推荐中）：
        </view>
        <view class="mb-2.5 flex flex-wrap gap-1.5">
          <view
            v-for="item in appStore.blacklist"
            :key="item"
            class="flex items-center gap-1 border border-red-100 rounded-lg bg-red-50 px-2 py-1 text-3xs text-red-700 font-extrabold"
          >
            {{ item }}
            <text class="cursor-pointer text-red-500 font-bold" @click="appStore.removeFromBlacklist(item)">×</text>
          </view>
          <view v-if="appStore.blacklist.length === 0" class="text-4xs text-gray-400 font-bold">
            暂无拉黑菜品
          </view>
        </view>
        <view class="flex gap-2">
          <input v-model="newBlack" placeholder="输入你讨厌的食物 (如：香菜)" class="flex-1 border rounded-xl bg-gray-50 px-3 py-1.5 text-xs">
          <button class="shadow-xs rounded-xl bg-red-500 px-3.5 text-3xs text-white font-black" @click="addBlack">
            拉黑
          </button>
        </view>
      </view>
    </view>

    <!-- 历史干饭记录 -->
    <view class="mx-4 mb-6 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <view class="mb-3 flex items-center justify-between">
        <view class="flex items-center text-sm text-gray-800 font-black">
          <view class="i-carbon-time mr-1.5 inline-block h-4 w-4 align-middle text-orange-600" />
          历史干饭卡片（日历流）
        </view>
        <text class="text-4xs text-gray-400 font-bold">共记录{{ appStore.history.length }}餐</text>
      </view>

      <view class="flex flex-col gap-3">
        <view
          v-for="(hist, idx) in appStore.history"
          :key="idx"
          class="flex items-center justify-between border border-gray-100 rounded-2xl bg-gray-50 p-3"
        >
          <view class="flex items-center gap-2">
            <view class="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-xl" :class="[hist.mode === 'health' ? 'i-carbon-sprout text-green-500' : 'i-carbon-restaurant text-orange-500']" />
            <view>
              <view class="flex items-center gap-1.5">
                <text class="text-xs text-gray-700 font-black">{{ hist.food }}</text>
                <text class="text-4xs rounded bg-gray-400 px-1 py-0.2 text-white font-bold">{{ hist.mode === 'health' ? '轻食' : '大众' }}</text>
              </view>
              <text class="mt-0.5 block text-3xs text-gray-400">{{ hist.date }} · {{ hist.restaurant || '默认商家' }}</text>
            </view>
          </view>

          <view class="flex items-center gap-2.5">
            <view v-if="hist.rating" class="flex items-center text-3xs text-orange-500 font-black">
              <view class="i-carbon-star-filled mr-0.5 inline-block h-3 w-3 align-middle text-orange-500" />
              {{ hist.rating }}
            </view>
            <text class="h-5 w-5 flex cursor-pointer items-center justify-center rounded-full bg-gray-200/50 text-xs text-red-500 font-black hover:bg-gray-200" @click="appStore.deleteHistory(idx)">×</text>
          </view>
        </view>
        <view v-if="appStore.history.length === 0" class="py-6 text-center text-2xs text-gray-400 font-bold">
          暂无历史干饭记录
        </view>
      </view>
    </view>

    <!-- 客服与反馈意见 -->
    <view class="mx-4 mb-6 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <view class="mb-4 block flex items-center text-sm text-gray-800 font-black">
        <view class="i-carbon-chat-bot mr-1.5 inline-block h-4 w-4 align-middle text-yellow-600" />
        客服与 Bug 反馈
      </view>

      <view class="flex flex-col gap-3">
        <textarea v-model="feedbackText" placeholder="请输入您的Bug反馈、建议或对小程序的期望..." class="h-20 w-full border rounded-xl bg-gray-50 p-3 text-xs" />
        <input v-model="feedbackContact" placeholder="您的手机号或微信号 (方便开发小哥联系你)" class="w-full border rounded-xl bg-gray-50 px-3 py-2 text-xs">

        <button
          class="w-full rounded-2xl py-3 text-sm text-white font-black shadow-md transition-transform active:scale-95"
          :style="{ background: themeColor }"
          @click="submitFeedback"
        >
          提交反馈并联系客服
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
</style>
