<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useAppStore } from '@/store/appMode'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

defineOptions({
  name: 'Social',
})

definePage({
  style: {
    navigationBarTitleText: '群组与社交',
    navigationStyle: 'custom',
  },
})

const appStore = useAppStore()

// 状态栏与导航栏高度计算
const statusBarHeight = ref(systemInfo.statusBarHeight || 0)
const navBarHeight = ref(statusNavTotalHeight - statusBarHeight.value)

const isHealth = computed(() => appStore.mode === 'health')
const themeColor = computed(() => appStore.themeColor)

// 1. 微信群投票拼单
const pollTitle = ref('研发部今天午餐吃什么？')
const pollOptions = ref([
  { text: '经典香煎鸡胸肉沙拉', votes: 4, friends: ['小明', '小林', '阿杰', '小陈'] },
  { text: '聚点串串香火锅', votes: 7, friends: ['张三', '李四', '王五', '老赵', '刘大', '马二', '陈七'] },
  { text: '麦当劳汉堡套餐', votes: 5, friends: ['小王', '小李', '小宋', '玲玲', '莹莹'] },
  { text: '杨国福麻辣烫', votes: 2, friends: ['大东', '强子'] },
])
const hasVoted = ref(false)
const isSharing = ref(false)

const totalVotes = computed(() => {
  return pollOptions.value.reduce((sum, opt) => sum + opt.votes, 0)
})

function voteFor(index: number) {
  if (hasVoted.value) {
    uni.showToast({
      title: '您已经投过票啦！',
      icon: 'none',
    })
    return
  }
  pollOptions.value[index].votes++
  pollOptions.value[index].friends.push('我')
  hasVoted.value = true
  uni.showToast({
    title: '投票成功！',
    icon: 'success',
  })
}

function generateShareCard() {
  isSharing.value = true
  setTimeout(() => {
    isSharing.value = false
    uni.showModal({
      title: '生成微信群投票卡片',
      content: '投票链接已复制！您可以将卡片转发给微信群组，群友点击即可参与联合就餐决策。',
      showCancel: false,
      confirmText: '好的',
    })
  }, 1000)
}

// 2. 好友代选与投喂
const friendHistory = ref([
  { friend: '女朋友', food: '🥑 藜麦三明治', time: '今天 11:32', type: '代选' },
  { friend: '好基友阿强', food: '🍖 聚点双人烤肉', time: '昨天 18:15', type: '投喂' },
  { friend: '部门主管', food: '🥗 鸡胸肉意面沙拉', time: '2026-06-25 12:05', type: '代选' },
])

function requestFriendSelect() {
  uni.showModal({
    title: '发起好友代选',
    content: '已生成您的专属“投喂代选链接”，快去发给你的伴侣或好友，让他们替你决定今天吃什么吧！',
    showCancel: false,
    confirmText: '复制链接',
  })
}

// 3. 吃货吐槽打卡墙
const rants = ref([
  {
    author: '干饭人小张',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80',
    restaurant: '绿野仙踪·轻食低卡沙拉',
    food: '鸡胸肉沙拉',
    rating: 2,
    tag: '避雷',
    comment: '鸡胸肉干柴的像在啃硬纸板，沙拉汁太咸了！简直是重油重盐的减脂伪科学，避雷避雷！',
    date: '今天 12:45',
  },
  {
    author: '低碳生活家',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&q=80',
    restaurant: '沙野轻食',
    food: '黑椒牛柳糙米饭',
    rating: 5,
    tag: '极力推荐',
    comment: '牛柳很嫩，糙米饭非常有嚼劲，酱汁刚好挂在牛柳上，健康美味双加分！大推！',
    date: '昨天 13:10',
  },
])

const inputRestaurant = ref('')
const inputFood = ref('')
const inputRating = ref(5)
const inputComment = ref('')
const inputTag = ref<'推荐' | '避雷'>('推荐')

function submitRant() {
  if (!inputRestaurant.value || !inputComment.value) {
    uni.showToast({
      title: '请填写商户名和评论详情',
      icon: 'none',
    })
    return
  }

  rants.value.unshift({
    author: '微信用户 (我)',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80',
    restaurant: inputRestaurant.value,
    food: inputFood.value || '招牌菜式',
    rating: inputRating.value,
    tag: inputTag.value === '推荐' ? '极力推荐' : '避雷',
    comment: inputComment.value,
    date: '刚刚',
  })

  inputRestaurant.value = ''
  inputFood.value = ''
  inputComment.value = ''

  uni.showToast({
    title: '评价发表成功！',
    icon: 'success',
  })
}
</script>

<template>
  <view class="social-container min-h-screen pb-20 transition-all duration-500" :style="{ background: appStore.themeGradient }">
    <!-- 自定义顶部状态栏 -->
    <view :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="flex items-center px-4" :style="{ height: `${navBarHeight}px` }">
        <text class="text-xl text-gray-800 font-black">社交与群组互动</text>
      </view>
    </view>

    <!-- 1. 微信群投票拼单 -->
    <view class="mx-4 mb-6 mt-2 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <view class="mb-3 flex items-center justify-between">
        <text class="text-sm text-gray-800 font-black">🗳️ 微信群投票拼单</text>
        <text class="text-3xs text-gray-400 font-bold">发起同事/群投票</text>
      </view>

      <!-- 投票标题输入/展示 -->
      <view class="mb-4 flex items-center border border-gray-100 rounded-2xl bg-gray-100/50 p-3">
        <text class="mr-2 text-xs text-gray-500 font-bold">投票主题:</text>
        <input v-model="pollTitle" class="flex-1 bg-transparent text-xs text-gray-700 font-bold">
      </view>

      <!-- 选项进度列表 -->
      <view class="mb-5 flex flex-col gap-3.5">
        <view v-for="(opt, idx) in pollOptions" :key="idx" class="relative flex flex-col overflow-hidden border border-gray-100 rounded-2xl bg-gray-50 p-3">
          <!-- 投票底色进度条 -->
          <view
            class="pointer-events-none absolute bottom-0 left-0 top-0 transition-all duration-1000"
            :style="{
              width: `${totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0}%`,
              background: isHealth ? '#00C8531A' : '#FF7A001A',
            }"
          />

          <view class="z-10 flex items-center justify-between">
            <text class="max-w-70% text-xs text-gray-700 font-black">{{ opt.text }}</text>
            <view class="flex items-center gap-2">
              <text class="text-xs text-gray-800 font-black">{{ opt.votes }} 票</text>
              <button
                class="shadow-xs rounded-full px-3 py-1 text-3xs text-white font-extrabold"
                :style="{ background: themeColor }"
                @click="voteFor(idx)"
              >
                投一票
              </button>
            </view>
          </view>

          <!-- 投票人姓名缩影 -->
          <view class="z-10 mt-2 flex flex-wrap items-center gap-1">
            <text class="text-3xs text-gray-400 font-bold">投选人:</text>
            <text
              v-for="friend in opt.friends"
              :key="friend"
              class="border border-gray-100 rounded bg-white/90 px-1 py-0.5 text-3xs text-gray-500 font-semibold"
            >
              {{ friend }}
            </text>
          </view>
        </view>
      </view>

      <button
        class="w-full flex items-center justify-center gap-1 rounded-2xl py-3 text-sm text-white font-black shadow-md transition-transform active:scale-95"
        :style="{ background: themeColor }"
        :disabled="isSharing"
        @click="generateShareCard"
      >
        <text v-if="isSharing" class="mr-1 h-3.5 w-3.5 animate-spin border-3 border-white border-t-transparent rounded-full" />
        {{ isSharing ? '正在生成卡片...' : '📤 微信群群发投票卡片' }}
      </button>
    </view>

    <!-- 2. 好友代选与投喂 -->
    <view class="mx-4 mb-6 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <view class="mb-3 flex items-center justify-between">
        <text class="text-sm text-gray-800 font-black">🧑‍🤝‍🧑 好友代选与投喂</text>
        <button
          class="shadow-xs border border-gray-200 rounded-full bg-white/80 px-2.5 py-1 text-3xs font-black"
          @click="requestFriendSelect"
        >
          求投喂
        </button>
      </view>

      <view class="mb-4 flex flex-col gap-3">
        <view
          v-for="(hist, idx) in friendHistory"
          :key="idx"
          class="flex items-center justify-between border border-gray-100 rounded-2xl bg-gray-50 p-3"
        >
          <view class="flex items-center gap-2">
            <text class="text-xl">{{ hist.type === '代选' ? '🔮' : '🎁' }}</text>
            <view>
              <view class="flex items-center gap-1.5">
                <text class="text-xs text-gray-700 font-black">{{ hist.friend }}</text>
                <text class="text-4xs rounded bg-gray-400 px-1 py-0.2 text-white font-bold">{{ hist.type }}</text>
              </view>
              <text class="mt-0.5 block text-3xs text-gray-400">{{ hist.time }}</text>
            </view>
          </view>

          <text class="text-xs text-gray-800 font-black">{{ hist.food }}</text>
        </view>
      </view>
    </view>

    <!-- 3. 吃货吐槽打卡墙 -->
    <view class="mx-4 mb-6 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <text class="mb-4 block text-sm text-gray-800 font-black">🗣️ 吃货避雷吐槽/打卡墙</text>

      <!-- 写帖子表单 -->
      <view class="mb-5 flex flex-col gap-3 border border-gray-100 rounded-2xl bg-gray-50 p-4">
        <view class="flex gap-2">
          <input v-model="inputRestaurant" placeholder="店铺名称 (如: 沙野轻食)" class="flex-1 border rounded-xl bg-white px-3 py-2 text-xs">
          <input v-model="inputFood" placeholder="食物名称 (如: 鸡胸肉沙拉)" class="flex-1 border rounded-xl bg-white px-3 py-2 text-xs">
        </view>

        <view class="flex items-center justify-between">
          <view class="flex items-center gap-1.5">
            <text class="text-xs text-gray-500 font-bold">评分：</text>
            <picker :range="[1, 2, 3, 4, 5]" @change="(e: any) => inputRating = Number(e.detail.value) + 1">
              <text class="cursor-pointer text-xs text-orange-500 font-extrabold">★ {{ inputRating }}星</text>
            </picker>
          </view>

          <view class="flex gap-2">
            <button
              class="border rounded-full px-3 py-1 text-3xs font-bold"
              :class="inputTag === '推荐' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200'"
              @click="inputTag = '推荐'"
            >
              👍 推荐
            </button>
            <button
              class="border rounded-full px-3 py-1 text-3xs font-bold"
              :class="inputTag === '避雷' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-700 border-gray-200'"
              @click="inputTag = '避雷'"
            >
              👎 避雷
            </button>
          </view>
        </view>

        <textarea v-model="inputComment" placeholder="发表你的干饭体验、避雷指南或安利理由..." class="h-16 w-full border rounded-xl bg-white p-3 text-xs" />

        <button
          class="shadow-xs w-full rounded-xl bg-gray-800 py-2 text-xs text-white font-bold"
          @click="submitRant"
        >
          发布打卡墙
        </button>
      </view>

      <!-- 帖子列表 -->
      <view class="flex flex-col gap-4">
        <view
          v-for="(rant, idx) in rants"
          :key="idx"
          class="flex flex-col border border-gray-100 rounded-2xl bg-white p-4"
        >
          <view class="mb-2 flex items-start justify-between">
            <view class="flex items-center gap-2">
              <image :src="rant.avatar" class="h-8 w-8 border border-gray-100 rounded-full" />
              <view>
                <text class="block text-xs text-gray-700 font-black">{{ rant.author }}</text>
                <text class="text-4xs mt-0.5 block text-gray-400">{{ rant.date }}</text>
              </view>
            </view>

            <view class="text-right">
              <text class="text-4xs rounded px-2 py-0.5 text-white font-black" :class="rant.tag.includes('推荐') ? 'bg-green-500' : 'bg-red-500'">
                {{ rant.tag }}
              </text>
              <text class="mt-0.5 block text-3xs text-orange-500 font-extrabold">★ {{ rant.rating }}</text>
            </view>
          </view>

          <view class="mb-2 border border-gray-100/50 rounded-xl bg-gray-50 p-2.5 text-2xs text-gray-500 font-semibold">
            🏬 {{ rant.restaurant }} · 🍲 {{ rant.food }}
          </view>

          <text class="text-xs text-gray-600 font-medium leading-relaxed">{{ rant.comment }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.animate-fade-in {
  animation: fadeIn 0.25s ease-out forwards;
}
</style>
