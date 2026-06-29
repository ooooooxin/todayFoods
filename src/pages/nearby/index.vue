<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useAppStore } from '@/store/appMode'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

defineOptions({
  name: 'Nearby',
})

definePage({
  style: {
    navigationBarTitleText: '附近吃啥',
    navigationStyle: 'custom',
  },
})

const appStore = useAppStore()

// 状态栏与导航栏高度计算
const statusBarHeight = ref(systemInfo.statusBarHeight || 0)
const navBarHeight = ref(statusNavTotalHeight - statusBarHeight.value)

const isHealth = computed(() => appStore.mode === 'health')
const themeColor = computed(() => appStore.themeColor)

// 定位状态模拟
const locationName = ref('北京市朝阳区大望路 SOHO现代城')
const isLocating = ref(false)

function refreshLocation() {
  isLocating.value = true
  setTimeout(() => {
    isLocating.value = false
    locationName.value = '北京市朝阳区三里屯 SOHO 办公区'
    uni.showToast({
      title: '定位刷新成功',
      icon: 'success',
    })
  }, 1000)
}

interface Restaurant {
  name: string
  logo: string
  score: number
  distance: string
  avgPrice: number
  tag: string
  kcal?: string
  recommend: string
  avoid: string
}

// 模拟餐厅池
const normalRestaurants: Restaurant[] = [
  {
    name: '聚点串串香火锅（大望路店）',
    logo: 'i-carbon-restaurant',
    score: 4.8,
    distance: '320m',
    avgPrice: 65,
    tag: '人气火锅',
    recommend: '招牌秘制牛油锅底、大刀毛肚',
    avoid: '重油锅底、油炸小酥肉（热量爆表）',
  },
  {
    name: '杨国福麻辣烫（万达广场店）',
    logo: 'i-carbon-restaurant',
    score: 4.5,
    distance: '580m',
    avgPrice: 28,
    tag: '中式快餐',
    recommend: '骨汤麻辣烫、粉丝、冻豆腐',
    avoid: '泡面、油面筋、油炸丸子',
  },
  {
    name: '老北京铜锅涮肉（金地广场店）',
    logo: 'i-carbon-restaurant',
    score: 4.9,
    distance: '890m',
    avgPrice: 98,
    tag: '老字号铜锅',
    recommend: '清水锅底、手切鲜羊肉、大白菜',
    avoid: '麻酱蘸料过多、高热量烧饼',
  },
  {
    name: '麦当劳 (大望路商场餐厅)',
    logo: 'i-carbon-restaurant',
    score: 4.7,
    distance: '210m',
    avgPrice: 32,
    tag: '美式快餐',
    recommend: '板烧鸡腿堡、零度可乐',
    avoid: '双层吉士堡、大薯条、麦旋风',
  },
]

const healthRestaurants: Restaurant[] = [
  {
    name: '绿野仙踪·轻食低卡沙拉（大望路店）',
    logo: 'i-carbon-sprout',
    score: 4.9,
    distance: '150m',
    avgPrice: 35,
    tag: '主打减脂沙拉',
    kcal: '约380-450kcal',
    recommend: '经典香煎鸡胸肉沙拉 + 意式黑醋汁',
    avoid: '避雷千岛酱、凯撒酱（含高油脂）',
  },
  {
    name: '沙野轻食（SOHO现代城店）',
    logo: 'i-carbon-sprout',
    score: 4.7,
    distance: '420m',
    avgPrice: 32,
    tag: '国潮健康减脂',
    kcal: '约400-500kcal',
    recommend: '黑椒牛柳紫米饭 + 白灼秋葵',
    avoid: '避开精制白米饭，尽量选择紫米/糙米',
  },
  {
    name: 'Wagas 沃歌斯（太古里店）',
    logo: 'i-carbon-cafe',
    score: 4.8,
    distance: '1.1km',
    avgPrice: 78,
    tag: '西式健康简餐',
    kcal: '约450-550kcal',
    recommend: '能量牛油果鸡肉面 + 纤体羽衣甘蓝汁',
    avoid: '奶酪厚多士、芝士蛋糕',
  },
  {
    name: '健康食刻·Poke能量碗',
    logo: 'i-carbon-restaurant',
    score: 4.6,
    distance: '620m',
    avgPrice: 42,
    tag: '夏威夷波奇饭',
    kcal: '约350-480kcal',
    recommend: '三文鱼波奇饭 + 藜麦基底',
    avoid: '油炸天妇罗碎、沙拉酱',
  },
]

const activeRestaurants = computed(() => {
  return isHealth.value ? healthRestaurants : normalRestaurants
})

// CPS 优惠券模拟
const coupons = [
  {
    platform: 'meituan',
    title: '美团外卖天天领红包',
    desc: '最高可领 56 元无门槛大额红包',
    bg: 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)',
    tag: '美团官方',
    btnText: '一键领券点美团',
  },
  {
    platform: 'eleme',
    title: '饿了么天天专享红包',
    desc: '每日首单最高可免 20 元',
    bg: 'linear-gradient(135deg, #0288D1 0%, #0091EA 100%)',
    tag: '饿了么官方',
    btnText: '一键领券点饿了么',
  },
]

const showCouponModal = ref(false)
const selectedCoupon = ref<any>(null)
const couponLoading = ref(false)

function grabCoupon(coupon: any) {
  selectedCoupon.value = coupon
  showCouponModal.value = true
  couponLoading.value = true

  setTimeout(() => {
    couponLoading.value = false
    // 模拟CPS领券成功，复制推广链接等操作
    // #ifdef MP-WEIXIN
    uni.setClipboardData({
      data: 'https://cps.meituan.com/gift_token_xxxx',
      showToast: false,
    })
    // #endif
  }, 1200)
}

function redirectToPlatform() {
  showCouponModal.value = false
  uni.showToast({
    title: '已复制优惠码，正在为您拉起小程序...',
    icon: 'none',
    duration: 2000,
  })
}
</script>

<template>
  <view class="nearby-container min-h-screen pb-20 transition-all duration-500" :style="{ background: appStore.themeGradient }">
    <!-- 自定义顶部状态栏 -->
    <view :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="flex items-center px-4" :style="{ height: `${navBarHeight}px` }">
        <text class="text-xl text-gray-800 font-black">附近美食</text>
      </view>
    </view>

    <!-- 定位栏 -->
    <view class="px-4 py-2">
      <view class="flex items-center justify-between">
        <view class="max-w-70% flex items-center rounded-full bg-white/70 px-4 py-2 shadow-sm backdrop-blur">
          <view class="i-carbon-location mr-1.5 inline-block h-3.5 w-3.5 align-middle text-red-500" />
          <text class="flex-1 truncate text-xs text-gray-700 font-bold">{{ locationName }}</text>
        </view>
        <button
          class="shadow-xs flex items-center border border-gray-200 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold transition-transform active:scale-95"
          :disabled="isLocating"
          @click="refreshLocation"
        >
          <view class="mr-1 inline-block h-3.5 w-3.5 align-middle" :class="[isLocating ? 'i-carbon-renew animate-spin' : 'i-carbon-renew']" />
          {{ isLocating ? '重定位...' : '刷新定位' }}
        </button>
      </view>
    </view>

    <!-- CPS 淘客外卖优惠券大广告位 -->
    <view class="mb-6 px-4">
      <view class="mb-3 block flex items-center text-sm text-gray-800 font-black">
        <view class="i-carbon-ticket mr-1.5 inline-block h-4 w-4 align-middle text-yellow-600" />
        专享外卖CPS优惠券
      </view>
      <view class="flex flex-col gap-3">
        <view
          v-for="(coupon, idx) in coupons"
          :key="idx"
          class="coupon-card relative overflow-hidden rounded-2xl p-4 text-white shadow-sm transition-transform active:scale-99"
          :style="{ background: coupon.bg }"
          @click="grabCoupon(coupon)"
        >
          <!-- 水印装饰 -->
          <view class="pointer-events-none absolute bottom-0 right-0 select-none text-7xl font-black tracking-widest opacity-10">
            COUPON
          </view>

          <view class="flex items-start justify-between">
            <view>
              <view class="flex items-center">
                <text class="mr-1.5 rounded bg-white/20 px-1.5 py-0.5 text-3xs font-extrabold">{{ coupon.tag }}</text>
                <text class="text-sm font-black">{{ coupon.title }}</text>
              </view>
              <text class="mt-1 block text-xs font-medium opacity-90">{{ coupon.desc }}</text>
            </view>
            <view class="coupon-dot-line h-full flex flex-col justify-between py-1" />
            <button class="self-center rounded-full bg-white px-3.5 py-2 text-3xs text-gray-800 font-black shadow">
              {{ coupon.btnText }}
            </button>
          </view>
        </view>
      </view>
    </view>

    <!-- 附近商户推荐列表 -->
    <view class="px-4">
      <view class="mb-3 flex items-center justify-between">
        <view class="flex items-center text-sm text-gray-800 font-black">
          <view class="i-carbon-restaurant mr-1.5 inline-block h-4 w-4 align-middle text-orange-500" />
          附近吃啥推荐卡片
        </view>
        <text class="text-3xs text-gray-500 font-bold">按 {{ isHealth ? '轻食健康度' : '人均偏好' }} 推荐</text>
      </view>

      <!-- 商家推荐卡片流 -->
      <view class="flex flex-col gap-4">
        <view
          v-for="(rest, idx) in activeRestaurants"
          :key="idx"
          class="border border-gray-100/50 rounded-3xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <!-- 第一行：商户名与图标 -->
          <view class="flex items-start justify-between">
            <view class="flex items-center gap-2">
              <view class="h-8 w-8 flex items-center justify-center rounded-full bg-gray-100 text-2xl" :class="[rest.logo, isHealth ? 'text-green-600' : 'text-orange-500']" />
              <view>
                <text class="line-clamp-1 block text-sm text-gray-800 font-black">{{ rest.name }}</text>
                <view class="mt-0.5 flex items-center gap-1.5">
                  <text class="rounded px-1.5 py-0.5 text-3xs font-bold" :style="{ background: `${themeColor}12`, color: themeColor }">
                    {{ rest.tag }}
                  </text>
                  <view v-if="rest.kcal" class="flex items-center border border-green-100 rounded bg-green-50 px-1.5 py-0.5 text-3xs text-green-700 font-bold">
                    <view class="i-carbon-flash mr-0.5 inline-block h-3 w-3 align-middle text-green-700" />
                    {{ rest.kcal }}
                  </view>
                </view>
              </view>
            </view>

            <view class="flex flex-col items-end text-right">
              <view class="flex items-center text-xs text-orange-500 font-extrabold">
                <view class="i-carbon-star-filled mr-0.5 inline-block h-3 w-3 align-middle text-orange-500" />
                {{ rest.score }}
              </view>
              <text class="mt-0.5 block text-3xs text-gray-400">{{ rest.distance }} · ¥{{ rest.avgPrice }}/人</text>
            </view>
          </view>

          <!-- 虚线分隔线 -->
          <view class="my-4 w-full border-t border-gray-100 border-dashed" />

          <!-- 指南区域 -->
          <view class="flex flex-col gap-2 border border-gray-100/50 rounded-2xl bg-gray-50 p-3">
            <!-- 推荐红榜 -->
            <view class="flex items-start">
              <text class="mr-2 mt-0.5 shrink-0 rounded bg-green-500 px-1.5 py-0.5 text-3xs text-white font-black">
                推荐 (红榜)
              </text>
              <text class="text-xs text-gray-700 font-medium leading-relaxed">{{ rest.recommend }}</text>
            </view>
            <!-- 避坑黑榜 -->
            <view class="flex items-start">
              <text class="mr-2 mt-0.5 shrink-0 rounded bg-red-500 px-1.5 py-0.5 text-3xs text-white font-black">
                避坑 (黑榜)
              </text>
              <text class="text-xs text-gray-600 leading-relaxed">{{ rest.avoid }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- CPS 领券跳转模拟弹出层 -->
    <view v-if="showCouponModal" class="backdrop-blur-xs fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-6">
      <view class="animate-scale-in max-w-sm w-full overflow-hidden rounded-3xl bg-white p-6 text-center shadow-2xl">
        <view class="i-carbon-gift mx-auto my-4 text-5xl text-orange-500" />
        <text class="block text-base text-gray-800 font-extrabold">优惠码领取成功！</text>
        <text class="mt-2 block text-xs text-gray-400">专享 CPS 隐藏推广链接已自动为您激活</text>

        <view class="my-6 border border-gray-100 rounded-2xl bg-gray-50 p-4 text-left">
          <view class="mb-1 flex items-center">
            <text class="mr-2 text-xs text-gray-700 font-bold">卡券类型:</text>
            <text class="text-xs text-orange-600 font-black">{{ selectedCoupon?.title }}</text>
          </view>
          <view class="flex items-center">
            <text class="mr-2 text-xs text-gray-700 font-bold">返利分成:</text>
            <text class="text-xs text-gray-500 font-bold">已启用微信分佣CPS（首单返现高至5%）</text>
          </view>
        </view>

        <!-- 模拟加载 -->
        <view v-if="couponLoading" class="mb-6 flex items-center justify-center gap-2">
          <view class="h-3.5 w-3.5 animate-spin border-3 border-gray-300 border-t-orange-500 rounded-full" />
          <text class="text-3xs text-gray-500 font-bold">正在拉起小程序链接...</text>
        </view>

        <button
          class="w-full rounded-2xl py-3 text-sm text-white font-black shadow-md transition-transform active:scale-95"
          :style="{ background: themeColor }"
          :disabled="couponLoading"
          @click="redirectToPlatform"
        >
          立即跳转小程序领券并下单
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.coupon-card {
  height: 90px;
}

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
