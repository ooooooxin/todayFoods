<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '@/store/appMode'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

defineOptions({
  name: 'Index',
})

definePage({
  type: 'home',
  style: {
    navigationBarTitleText: '今天吃啥',
    navigationStyle: 'custom',
    enablePullDownRefresh: false,
  },
})

const appStore = useAppStore()

// 状态栏与导航栏高度计算
const statusBarHeight = ref(systemInfo.statusBarHeight || 0)
const navBarHeight = ref(statusNavTotalHeight - statusBarHeight.value)

// 模式与主题
const isHealth = computed(() => appStore.mode === 'health')
const themeColor = computed(() => appStore.themeColor)

// 决策方式选项卡: 'wheel' | 'shake' | 'coin'
const activeTool = ref<'wheel' | 'shake' | 'coin'>('wheel')

// 基础食物池定义
const normalFoods = [
  '火锅',
  '烤肉',
  '麻辣拌',
  '黄焖鸡米饭',
  '日式拉面',
  '汉堡炸鸡',
  '柳州螺蛳粉',
  '红烧牛肉面',
  '窑烤披萨',
  '香辣木桶饭',
  '水饺',
  '麻辣香锅',
  '韩式炸鸡',
  '小龙虾',
]

const healthFoods = [
  '鸡胸肉牛油果沙拉',
  '香煎牛肉糙米饭',
  '清蒸三文鱼时蔬',
  '魔芋丝鸡丝拌面',
  '茄汁豆腐荞麦面',
  '藤椒鸡肉卷饼',
  '清蒸南瓜紫薯杂粮',
  '低脂无糖燕麦粥',
  '金枪鱼全麦三明治',
  '白灼虾仁西兰花',
  '黑椒牛柳杏鲍菇',
]

interface CloudFood {
  name: string
  mode: 'normal' | 'health'
  image?: string
}

const cloudFoods = ref<CloudFood[]>([])

const cloudNormalFoods = computed(() => {
  return cloudFoods.value.filter(item => item.mode === 'normal').map(item => item.name)
})

const cloudHealthFoods = computed(() => {
  return cloudFoods.value.filter(item => item.mode === 'health').map(item => item.name)
})

const activeNormalFoods = computed(() => {
  return cloudNormalFoods.value.length > 0 ? cloudNormalFoods.value : normalFoods
})

const activeHealthFoods = computed(() => {
  return cloudHealthFoods.value.length > 0 ? cloudHealthFoods.value : healthFoods
})

const foodImageMap: Record<string, string> = {
  火锅: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&q=80',
  烤肉: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=400&q=80',
  麻辣拌: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=400&q=80',
  黄焖鸡米饭: 'https://images.unsplash.com/photo-1627308595229-7830a5c91f9f?auto=format&fit=crop&w=400&q=80',
  日式拉面: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
  汉堡炸鸡: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  意式披萨: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
  窑烤披萨: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
  水饺: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=400&q=80',
  小龙虾: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=400&q=80',
  鸡胸肉牛油果沙拉: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=400&q=80',
  香煎牛肉糙米饭: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
  清蒸三文鱼时蔬: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=400&q=80',
  魔芋丝鸡丝拌面: 'https://images.unsplash.com/photo-1547928576-a4a3323d8b36?auto=format&fit=crop&w=400&q=80',
  金枪鱼全麦三明治: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=400&q=80',
  白灼虾仁西兰花: 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=400&q=80',
}

const defaultFoodImage = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80'

// 结果弹窗
const showResult = ref(false)
const selectedFood = ref('')
const resultType = ref<'food' | 'coin'>('food')
const coinResult = ref<'eat' | 'not'>('eat')

const currentFoodImage = computed(() => {
  if (!selectedFood.value)
    return defaultFoodImage
  const matched = cloudFoods.value.find(f => f.name === selectedFood.value)
  if (matched?.image)
    return matched.image
  return foodImageMap[selectedFood.value] || defaultFoodImage
})

// 过滤黑白名单后的候选菜池
const currentCandidates = computed(() => {
  const basePool = isHealth.value ? activeHealthFoods.value : activeNormalFoods.value
  // 过滤掉黑名单中的食物
  let filtered = basePool.filter(food => !appStore.blacklist.includes(food))
  // 如果白名单里有匹配模式的食物，将其混入其中以增加概率（双倍权重）
  const validWhitelist = appStore.whitelist.filter((food) => {
    // 简单判断分类，健康模式下白名单含“沙拉”、“低脂”、“鸡胸”、“牛肉”、“清爽”等归为健康类
    if (isHealth.value) {
      return /沙拉|低脂|鸡胸|牛肉|糙米|荞麦|清蒸|西兰花/.test(food)
    }
    else {
      return !(/沙拉|低卡|无糖/.test(food))
    }
  })

  if (validWhitelist.length > 0) {
    filtered = [...filtered, ...validWhitelist, ...validWhitelist]
  }

  // 兜底防止全被过滤了
  if (filtered.length === 0) {
    filtered = basePool
  }

  // 去重但保留加权
  return filtered.slice(0, 10) // 取最多10个，转盘效果最好
})

// 大转盘 CSS Conic Gradient 背景与计算
const angleStep = computed(() => 360 / currentCandidates.value.length)
const gradientString = computed(() => {
  const list = currentCandidates.value
  const len = list.length
  if (len === 0)
    return ''
  const step = 360 / len
  const colors = list.map((_, i) => {
    let color = ''
    if (isHealth.value) {
      color = i % 2 === 0 ? '#E8F5E9' : '#C8E6C9'
    }
    else {
      color = i % 2 === 0 ? '#FFF3E0' : '#FFE0B2'
    }
    return `${color} ${i * step}deg ${(i + 1) * step}deg`
  })
  return `conic-gradient(${colors.join(', ')})`
})

// 激励广告弹窗
const showAdDialog = ref(false)
const adCountdown = ref(3)
const adTimer = ref<any>(null)

// 1. 大转盘逻辑
const wheelRotation = ref(0)
const isSpinning = ref(false)
const wheelTargetIndex = ref(0)

function spinWheel() {
  if (isSpinning.value)
    return

  if (appStore.drawLimit.count <= 0) {
    showAdDialog.value = true
    startAdCountdown()
    return
  }

  isSpinning.value = true
  appStore.useDraw()

  // 随机目标
  const list = currentCandidates.value
  const targetIdx = Math.floor(Math.random() * list.length)
  wheelTargetIndex.value = targetIdx

  // 计算旋转度数：多转5圈 (1800度) + 选中目标所需的度数
  const step = 360 / list.length
  // 目标的中心角度应该指向正上方(即-90度或270度方向的指针)
  // 指针在顶部(90度)，所以旋转角度 = 360 - (targetIdx * step + step / 2)
  const targetAngle = 360 - (targetIdx * step + step / 2)

  // 增加基础圈数
  const baseSpins = 5 * 360
  wheelRotation.value += baseSpins + targetAngle - (wheelRotation.value % 360)

  setTimeout(() => {
    isSpinning.value = false
    selectedFood.value = list[targetIdx]
    resultType.value = 'food'
    showResult.value = true

    // 写入干饭历史
    appStore.addHistory({
      food: list[targetIdx],
      mode: appStore.mode,
      restaurant: '推荐餐厅',
    })
  }, 4000)
}

// 2. 摇一摇逻辑
const isShaking = ref(false)
const shakeResult = ref('')

function runShake() {
  if (isShaking.value)
    return

  if (appStore.drawLimit.count <= 0) {
    showAdDialog.value = true
    startAdCountdown()
    return
  }

  isShaking.value = true
  appStore.useDraw()

  // 微信晃动感应
  // #ifdef MP-WEIXIN
  uni.vibrateShort({})
  // #endif

  setTimeout(() => {
    isShaking.value = false
    const list = currentCandidates.value
    const idx = Math.floor(Math.random() * list.length)
    selectedFood.value = list[idx]
    resultType.value = 'food'
    showResult.value = true

    appStore.addHistory({
      food: list[idx],
      mode: appStore.mode,
      restaurant: '推荐餐厅',
    })
  }, 1500)
}

// 3. 抛硬币逻辑
const isFlipping = ref(false)
const coinFlips = ref(0)
const coinRotateY = ref(0)

function flipCoin() {
  if (isFlipping.value)
    return

  if (appStore.drawLimit.count <= 0) {
    showAdDialog.value = true
    startAdCountdown()
    return
  }

  isFlipping.value = true
  appStore.useDraw()

  const outcome = Math.random() > 0.5 ? 'eat' : 'not'
  coinResult.value = outcome

  // 抛硬币翻转数
  const baseFlips = 10 * 180 // 翻转10次
  const finalAngle = outcome === 'eat' ? 0 : 180
  coinRotateY.value += baseFlips + finalAngle - (coinRotateY.value % 360)

  setTimeout(() => {
    isFlipping.value = false
    resultType.value = 'coin'
    showResult.value = true
  }, 1500)
}

// 激励视频广告模拟
function startAdCountdown() {
  adCountdown.value = 3
  if (adTimer.value)
    clearInterval(adTimer.value)

  adTimer.value = setInterval(() => {
    adCountdown.value--
    if (adCountdown.value <= 0) {
      clearInterval(adTimer.value)
      adTimer.value = null
    }
  }, 1000)
}

function completeAd() {
  if (adCountdown.value > 0)
    return
  showAdDialog.value = false
  appStore.resetDrawLimit()
  uni.showToast({
    title: '额度已恢复！获得5次机会',
    icon: 'success',
  })
}

// 导航快捷跳转
function goToNearby() {
  showResult.value = false
  uni.switchTab({
    url: '/pages/nearby/index',
  })
}

function goToSocial() {
  showResult.value = false
  uni.switchTab({
    url: '/pages/social/index',
  })
}

// 摇一摇微信加速度监听
onMounted(() => {
  // #ifdef MP-WEIXIN
  if ((wx as any).cloud) {
    const db = (wx as any).cloud.database()
    db.collection('Foods').get().then((res: any) => {
      const data = res.data as CloudFood[]
      console.log('获取云端菜池成功', data)
      if (data && data.length > 0) {
        cloudFoods.value = data
      }
    }).catch((err: any) => {
      console.warn('获取云端菜池失败，使用本地默认菜池：', err)
    })
  }
  // #endif

  // #ifdef MP-WEIXIN
  let lastX = 0
  let lastY = 0
  let lastZ = 0
  let lastTime = 0

  uni.onAccelerometerChange((res) => {
    const currentTime = Date.now()
    if (currentTime - lastTime > 100) {
      const diffTime = currentTime - lastTime
      lastTime = currentTime

      const x = res.x
      const y = res.y
      const z = res.z

      const speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000

      if (speed > 80 && activeTool.value === 'shake' && !isShaking.value && !showResult.value && !showAdDialog.value) {
        runShake()
      }

      lastX = x
      lastY = y
      lastZ = z
    }
  })
  // #endif
})
</script>

<template>
  <view class="home-container min-h-screen pb-20 transition-all duration-500" :style="{ background: appStore.themeGradient }">
    <!-- 自定义顶部状态栏 -->
    <view :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="flex items-center px-4" :style="{ height: `${navBarHeight}px` }">
        <!-- 标志标题 -->
        <view class="flex flex-col">
          <text class="text-xl font-extrabold tracking-wide" :class="isHealth ? 'text-green-700' : 'text-orange-700'">今天吃啥</text>
          <text class="text-3xs opacity-75" :class="isHealth ? 'text-green-600' : 'text-orange-600'">Decision Maker Tool</text>
        </view>
      </view>
    </view>

    <!-- 双模式切换区 -->
    <view class="mx-4 my-2 flex justify-center">
      <view
        class="mode-switch-container relative flex cursor-pointer items-center rounded-full bg-gray-200/60 p-1 backdrop-blur"
        @click="appStore.toggleMode"
      >
        <view
          class="mode-switch-active-bg absolute h-7 w-20 rounded-full shadow-sm transition-all duration-300"
          :style="{
            transform: isHealth ? 'translateX(80px)' : 'translateX(0px)',
            background: isHealth ? '#00C853' : '#FF7A00',
          }"
        />

        <view class="z-10 h-7 w-20 flex items-center justify-center text-xs font-bold transition-colors" :class="!isHealth ? 'text-white' : 'text-gray-600'">
          <view class="i-carbon-fire mr-0.5 inline-block h-3.5 w-3.5 align-middle" />大众模式
        </view>
        <view class="z-10 h-7 w-20 flex items-center justify-center text-xs font-bold transition-colors" :class="isHealth ? 'text-white' : 'text-gray-600'">
          <view class="i-carbon-sprout mr-0.5 inline-block h-3.5 w-3.5 align-middle" />轻食增肌
        </view>
      </view>
    </view>

    <!-- 顶栏状态通知 -->
    <view class="mx-4 mb-4 mt-2 flex items-center justify-between rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur">
      <view class="flex items-center">
        <view class="i-carbon-flash mr-1.5 inline-block h-4 w-4 align-middle text-yellow-500" />
        <text class="text-xs text-gray-700 font-medium">今日剩余抽取次数：</text>
        <text class="text-sm font-black" :class="appStore.drawLimit.count > 0 ? 'text-gray-800' : 'text-red-500'">
          {{ appStore.drawLimit.count }}次
        </text>
      </view>
      <button
        v-if="appStore.drawLimit.count === 0"
        class="ad-restore-btn rounded-full px-2.5 py-1 text-3xs text-white font-bold shadow-sm"
        :style="{ background: themeColor }"
        @click="showAdDialog = true; startAdCountdown()"
      >
        看视频恢复
      </button>
    </view>

    <!-- 决策方式切换 Tabs -->
    <view class="mx-4 mb-6 flex justify-around rounded-2xl bg-white/40 p-1.5 shadow-sm backdrop-blur">
      <view
        class="tab-item flex flex-1 flex-col items-center rounded-xl py-2.5 text-center text-xs font-bold transition-all"
        :class="activeTool === 'wheel' ? 'bg-white shadow text-gray-800' : 'text-gray-600'"
        @click="activeTool = 'wheel'"
      >
        <view class="i-carbon-chart-ring mb-1 text-lg" />
        大转盘
      </view>
      <view
        class="tab-item flex flex-1 flex-col items-center rounded-xl py-2.5 text-center text-xs font-bold transition-all"
        :class="activeTool === 'shake' ? 'bg-white shadow text-gray-800' : 'text-gray-600'"
        @click="activeTool = 'shake'"
      >
        <view class="i-carbon-mobile mb-1 text-lg" />
        摇一摇
      </view>
      <view
        class="tab-item flex flex-1 flex-col items-center rounded-xl py-2.5 text-center text-xs font-bold transition-all"
        :class="activeTool === 'coin' ? 'bg-white shadow text-gray-800' : 'text-gray-600'"
        @click="activeTool = 'coin'"
      >
        <view class="i-carbon-currency mb-1 text-lg" />
        抛硬币
      </view>
    </view>

    <!-- 工具展示区域 -->
    <view class="my-8 flex items-center justify-center px-4">
      <!-- 1. 大转盘 -->
      <view v-if="activeTool === 'wheel'" class="wheel-box relative flex items-center justify-center">
        <!-- 指针 -->
        <view class="wheel-pointer absolute z-20" :style="{ borderBottomColor: themeColor }" />
        <!-- 转盘外部光环 -->
        <view
          class="wheel-outer relative shadow-2xl transition-all duration-300"
          :style="{
            boxShadow: `0 0 0 8px ${themeColor}, 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`,
            background: gradientString,
            transform: `rotate(${wheelRotation}deg)`,
            transition: 'transform 4s cubic-bezier(0.15, 0.85, 0.35, 1.02)',
          }"
        >
          <!-- 转盘扇区文字 -->
          <view
            v-for="(food, idx) in currentCandidates"
            :key="idx"
            class="wheel-item"
            :style="{
              transform: `translateX(-50%) rotate(${idx * angleStep + angleStep / 2}deg)`,
            }"
          >
            <text class="wheel-item-text">{{ food }}</text>
          </view>
        </view>
        <!-- 中间启动按钮 -->
        <view
          class="wheel-btn absolute z-10 h-16 w-16 flex cursor-pointer select-none items-center justify-center rounded-full text-sm text-white font-extrabold shadow-lg transition-transform active:scale-95"
          :style="{ background: themeColor }"
          @click="spinWheel"
        >
          {{ isSpinning ? 'SPIN...' : '抽一个' }}
        </view>
      </view>

      <!-- 2. 摇一摇 -->
      <view v-if="activeTool === 'shake'" class="shake-box flex flex-col items-center">
        <view
          class="shake-phone-icon h-36 w-36 flex items-center justify-center border-4 rounded-full bg-white/80 shadow-xl"
          :class="{ 'animate-shake': isShaking }"
          :style="{ borderColor: themeColor }"
          @click="runShake"
        >
          <view class="i-carbon-mobile text-6xl text-gray-400" />
        </view>
        <text class="mt-6 animate-pulse text-sm text-gray-700 font-bold">点击手机或物理摇晃手机决定</text>
      </view>

      <!-- 3. 抛硬币 -->
      <view v-if="activeTool === 'coin'" class="coin-box flex flex-col items-center">
        <!-- 3D 翻转硬币 -->
        <view class="coin-wrapper" @click="flipCoin">
          <view
            class="coin transition-transform duration-1500"
            :class="{ 'animate-toss': isFlipping }"
            :style="{
              transform: `rotateY(${coinRotateY}deg)`,
              transitionTimingFunction: 'cubic-bezier(0.15, 0.85, 0.35, 1.02)',
            }"
          >
            <!-- 正面 (吃) -->
            <view class="coin-face coin-front flex flex-col items-center justify-center text-xl text-white font-black" :style="{ background: themeColor }">
              <view class="i-carbon-face-satisfied mb-1 text-3xl text-yellow-300" />
              <text>吃！</text>
            </view>
            <!-- 反面 (不吃) -->
            <view class="coin-face coin-back flex flex-col items-center justify-center bg-gray-300 text-xl text-gray-600 font-black">
              <view class="i-carbon-face-neutral mb-1 text-3xl text-gray-500" />
              <text>不吃！</text>
            </view>
          </view>
        </view>
        <text class="mt-6 text-sm text-gray-700 font-bold">点击硬币进行二选一（吃与不吃）</text>
      </view>
    </view>

    <!-- 食物候选栏列表预览 -->
    <view class="mx-4 mt-6 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <view class="mb-3 flex items-center justify-between">
        <view class="flex items-center text-sm text-gray-800 font-extrabold">
          <view class="i-carbon-catalog mr-1 inline-block h-4 w-4 align-middle text-lg text-red-500" />
          当前决策池 (共{{ currentCandidates.length }}类)
        </view>
        <text class="text-3xs text-gray-500">根据模式及黑白名单自动筛选</text>
      </view>

      <view class="flex flex-wrap gap-2">
        <view
          v-for="(food, idx) in currentCandidates"
          :key="idx"
          class="rounded-full px-3 py-1.5 text-xs font-medium"
          :class="isHealth ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-orange-50 text-orange-700 border border-orange-100'"
        >
          {{ food }}
        </view>
      </view>
    </view>

    <!-- 结果弹出层 -->
    <view v-if="showResult" class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <view class="animate-scale-in max-w-sm w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
        <!-- 头部装饰 -->
        <view class="h-28 flex flex-col items-center justify-center text-white" :style="{ background: themeColor }">
          <view class="i-carbon-badge mb-1 text-3xl text-yellow-300" />
          <text class="mt-1 text-lg font-black">恭喜！结果已经为你选出</text>
        </view>

        <view class="p-6 text-center">
          <template v-if="resultType === 'food'">
            <text class="block text-xs text-gray-400 font-bold tracking-widest uppercase">今天建议你吃：</text>
            <!-- 菜品图片展示 -->
            <image :src="currentFoodImage" class="shadow-xs my-3 h-32 w-full border border-gray-100 rounded-2xl bg-gray-50" mode="aspectFill" />
            <text class="my-2 block text-2xl text-gray-800 font-black">{{ selectedFood }}</text>

            <!-- 宏量营养素估算（仅轻食模式显示） -->
            <view v-if="isHealth" class="my-4 flex justify-around border border-green-100 rounded-2xl bg-green-50 p-3 text-center">
              <view>
                <text class="block text-2xs text-gray-500 font-medium">预估热量</text>
                <text class="text-sm text-green-700 font-black">~420 kcal</text>
              </view>
              <view class="w-px bg-green-200/50" />
              <view>
                <text class="block text-2xs text-gray-500 font-medium">高蛋白质</text>
                <text class="text-sm text-green-700 font-black">~28 g</text>
              </view>
              <view class="w-px bg-green-200/50" />
              <view>
                <text class="block text-2xs text-gray-500 font-medium">低碳水</text>
                <text class="text-sm text-green-700 font-black">~38 g</text>
              </view>
            </view>

            <view v-else class="my-4 flex items-center justify-center border border-orange-100 rounded-2xl bg-orange-50 p-3">
              <view class="i-carbon-restaurant mr-1 inline-block h-4 w-4 align-middle text-orange-600" />
              <text class="text-xs text-orange-700 font-semibold">今日宜享受大餐！搭配大杯冻柠茶更爽哦</text>
            </view>
          </template>

          <template v-else>
            <text class="block text-xs text-gray-400 font-bold">硬币抛掷结果：</text>
            <view class="my-5 flex items-center justify-center text-4xl text-gray-800 font-black">
              <view v-if="coinResult === 'eat'" class="i-carbon-face-satisfied mr-2 text-4xl text-yellow-500" />
              <view v-else class="i-carbon-face-neutral mr-2 text-4xl text-gray-400" />
              {{ coinResult === 'eat' ? '吃！' : '不吃！' }}
            </view>
          </template>

          <view class="my-4 h-px w-full bg-gray-100" />

          <!-- 操作区 -->
          <view class="flex flex-col gap-2.5">
            <view class="flex gap-2">
              <button
                class="flex flex-1 items-center justify-center rounded-xl py-2.5 text-xs text-white font-bold shadow-sm"
                :style="{ background: themeColor }"
                @click="goToNearby"
              >
                <view class="i-carbon-location mr-1 inline-block h-3.5 w-3.5 align-middle text-white" />
                附近去哪吃
              </button>
              <button
                class="flex flex-1 items-center justify-center border border-gray-200 rounded-xl bg-gray-100 py-2.5 text-xs text-gray-700 font-bold"
                @click="goToSocial"
              >
                <view class="i-carbon-event mr-1 inline-block h-3.5 w-3.5 align-middle text-gray-600" />
                发微信群投票
              </button>
            </view>
            <button
              class="w-full border border-gray-200 rounded-xl bg-gray-50 py-2.5 text-xs text-gray-600 font-bold hover:bg-gray-100"
              @click="showResult = false"
            >
              好啦，我知道了
            </button>
          </view>
        </view>
      </view>
    </view>

    <!-- 广告模拟对话框 -->
    <view v-if="showAdDialog" class="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/75 p-6 backdrop-blur-md">
      <view class="max-w-sm w-full flex flex-col items-center overflow-hidden rounded-3xl bg-gray-900 p-6 text-center text-white shadow-2xl">
        <view class="i-carbon-video my-4 text-5xl text-yellow-500" />
        <text class="block text-base font-extrabold">正在加载赞助商视频广告...</text>
        <text class="mt-2 text-xs text-gray-400">观看完整视频可重置今日抽取额度</text>

        <!-- 进度模拟 -->
        <view class="relative mb-4 mt-8 h-2.5 w-full overflow-hidden rounded-full bg-gray-800">
          <view
            class="h-full rounded-full transition-all duration-3000 ease-linear"
            :style="{
              width: adCountdown <= 0 ? '100%' : `${((3 - adCountdown) / 3) * 100}%`,
              background: themeColor,
            }"
          />
        </view>

        <text class="mt-2 text-sm font-bold opacity-75">
          {{ adCountdown > 0 ? `广告剩余时间: ${adCountdown}秒` : '广告播放完成' }}
        </text>

        <button
          class="mt-8 w-full rounded-2xl py-3 text-sm text-white font-black shadow-lg transition-transform active:scale-95"
          :class="adCountdown > 0 ? 'bg-gray-700 cursor-not-allowed opacity-50' : ''"
          :style="{ background: adCountdown <= 0 ? themeColor : '#374151' }"
          :disabled="adCountdown > 0"
          @click="completeAd"
        >
          {{ adCountdown > 0 ? '请耐心观看广告...' : '领取奖励并恢复额度' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* 大转盘动画与样式 */
.wheel-box {
  width: 280px;
  height: 280px;
}

.wheel-outer {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
}

.wheel-item {
  position: absolute;
  top: 0;
  left: 50%;
  width: 44px;
  height: 50%;
  transform-origin: 50% 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 14px;
  box-sizing: border-box;
}

.wheel-item-text {
  font-size: 11px;
  font-weight: bold;
  color: #2d3748;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  text-align: center;
  line-height: 1.2;
}

.wheel-pointer {
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 12px solid transparent;
  border-right: 12px solid transparent;
  border-bottom: 24px solid; /* color dynamic */
}

/* 摇一摇动画 */
@keyframes shake {
  0% {
    transform: translate(1px, 1px) rotate(0deg);
  }
  10% {
    transform: translate(-1px, -2px) rotate(-1deg);
  }
  20% {
    transform: translate(-3px, 0px) rotate(1deg);
  }
  30% {
    transform: translate(0px, 2px) rotate(0deg);
  }
  40% {
    transform: translate(1px, -1px) rotate(1deg);
  }
  50% {
    transform: translate(-1px, 2px) rotate(-1deg);
  }
  60% {
    transform: translate(-3px, 1px) rotate(0deg);
  }
  75% {
    transform: translate(2px, 1px) rotate(-2deg);
  }
  90% {
    transform: translate(-1px, -1px) rotate(1deg);
  }
  100% {
    transform: translate(1px, 2px) rotate(0deg);
  }
}

.animate-shake {
  animation: shake 0.5s infinite;
}

/* 3D抛硬币 */
.coin-wrapper {
  perspective: 1000px;
  width: 160px;
  height: 160px;
  cursor: pointer;
}

.coin {
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  position: relative;
}

.coin-face {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  backface-visibility: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  border: 6px solid #ffffff;
}

.coin-front {
  transform: rotateY(0deg);
}

.coin-back {
  transform: rotateY(180deg);
}

@keyframes toss {
  0% {
    transform: translateY(0) rotateY(0);
  }
  50% {
    transform: translateY(-120px) rotateY(900deg);
  }
  100% {
    transform: translateY(0) rotateY(1800deg);
  }
}

.animate-toss {
  animation: toss 1.5s ease-in-out;
}

/* 弹窗通用动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-fade-in {
  animation: fadeIn 0.25s ease-out forwards;
}

.animate-scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
</style>
