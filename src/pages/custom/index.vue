<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useAppStore } from '@/store/appMode'
import { statusNavTotalHeight, systemInfo } from '@/utils/systemInfo'

defineOptions({
  name: 'Custom',
})

definePage({
  style: {
    navigationBarTitleText: '定制筛选',
    navigationStyle: 'custom',
  },
})

const appStore = useAppStore()

// 状态栏与导航栏高度计算
const statusBarHeight = ref(systemInfo.statusBarHeight || 0)
const navBarHeight = ref(statusNavTotalHeight - statusBarHeight.value)

const isHealth = computed(() => appStore.mode === 'health')
const themeColor = computed(() => appStore.themeColor)

// 1. 条件漏斗筛选
const distanceOptions = ['不限', '< 1km', '< 2km', '< 5km']
const selectedDistance = ref('不限')

const priceOptions = ['不限', '< 20元', '20-50元', '> 50元']
const selectedPrice = ref('不限')

const tasteOptions = ['重口味', '清淡', '麻辣', '免辣', '高蛋白', '低卡路里', '面食']
const selectedTastes = ref<string[]>(['清淡', '高蛋白'])

function toggleTaste(taste: string) {
  if (selectedTastes.value.includes(taste)) {
    selectedTastes.value = selectedTastes.value.filter(t => t !== taste)
  }
  else {
    selectedTastes.value.push(taste)
  }
}

// 2. 极简身体档案与目标计算
const editProfile = ref(false)
const gender = ref<'male' | 'female'>(appStore.bodyProfile.gender || 'male')
const age = ref(appStore.bodyProfile.age || 24)
const height = ref(appStore.bodyProfile.height || 175)
const weight = ref(appStore.bodyProfile.weight || 68)
const target = ref<'lose' | 'gain' | 'maintain'>(appStore.bodyProfile.target || 'lose')

// 今日摄入进度（模拟数据）
const consumedCalories = ref(1150)
const consumedProtein = ref(78)

function saveProfile() {
  appStore.updateBodyProfile({
    gender: gender.value,
    age: age.value,
    height: height.value,
    weight: weight.value,
    target: target.value,
  })
  editProfile.value = false
  uni.showToast({
    title: '档案保存成功，宏量目标已更新',
    icon: 'success',
  })
}

function addMockMeal() {
  consumedCalories.value = Math.min((appStore.bodyProfile.calGoal || 1800), consumedCalories.value + 450)
  consumedProtein.value = Math.min((appStore.bodyProfile.proteinGoal || 120), consumedProtein.value + 25)
  uni.showToast({
    title: '打卡记录一餐：+450kcal, +25g蛋白质',
    icon: 'none',
  })
}

function resetMockProgress() {
  consumedCalories.value = 0
  consumedProtein.value = 0
  uni.showToast({
    title: '今日卡路里已归零',
    icon: 'success',
  })
}

// 3. 冰箱食材匹配
const ingredientList = ['鸡蛋', '西红柿', '鸡胸肉', '西兰花', '洋葱', '土豆', '牛肉', '豆腐', '胡萝卜']

function toggleIngredient(item: string) {
  if (appStore.fridgeIngredients.includes(item)) {
    appStore.removeFridgeIngredient(item)
  }
  else {
    appStore.addFridgeIngredient(item)
  }
}

// 冰箱菜谱匹配库
const recipeDB = [
  {
    name: '经典番茄炒蛋',
    ingredients: ['西红柿', '鸡蛋'],
    time: '10分钟',
    difficulty: '新手级',
    steps: [
      '鸡蛋打散，加少许盐和水淀粉拌匀。西红柿洗净切块。',
      '热锅凉油，倒入蛋液快速炒散，凝固后即刻盛出备用。',
      '锅内少许底油，下西红柿块翻炒出沙，加入一勺糖调味。',
      '倒入炒好的鸡蛋，大火翻炒均匀，撒上葱花即可出锅。',
    ],
  },
  {
    name: '西兰花炒香煎鸡胸肉',
    ingredients: ['西兰花', '鸡胸肉'],
    time: '15分钟',
    difficulty: '初学者',
    steps: [
      '鸡胸肉切丁，用少许盐、黑胡椒、料酒和淀粉腌制10分钟。',
      '西兰花切小朵，沸水下锅焯水30秒捞出冲凉，保持翠绿。',
      '热锅喷少许橄榄油，下蒜片炒香，放入鸡胸肉翻煎至两面金黄。',
      '倒入西兰花翻炒，加入适量生抽和黑胡椒，大火炒匀即可出锅。',
    ],
  },
  {
    name: '洋葱爆炒牛肉片',
    ingredients: ['洋葱', '牛肉'],
    time: '15分钟',
    difficulty: '家庭日常',
    steps: [
      '牛肉切薄片，加入生抽、老抽、淀粉、食用油抓匀腌制锁水。',
      '洋葱剥皮切丝。热锅热油，快速滑炒牛肉片至变色，盛出。',
      '原锅下洋葱丝煸炒至变软出甜味。',
      '倒回牛肉片，加入盐、少许蚝油，大火快速爆炒30秒即可。',
    ],
  },
  {
    name: '小葱小煎豆腐',
    ingredients: ['豆腐'],
    time: '10分钟',
    difficulty: '新手级',
    steps: [
      '豆腐切成厚约1cm的方块，用厨房纸巾吸干表面水分。',
      '平底锅喷少许油，中小火将豆腐块两面煎至金黄焦脆。',
      '淋入适量生抽、少许白糖和水调成的酱汁焖煮1分钟入味。',
      '撒上大量小葱段，大火收干汁水即可。',
    ],
  },
]

const showRecipeResult = ref(false)
const matchedRecipes = computed(() => {
  const selected = appStore.fridgeIngredients
  if (selected.length === 0)
    return []

  return recipeDB.filter((recipe) => {
    // 菜谱所需的主要食材，用户冰箱里都包含即匹配
    return recipe.ingredients.every(item => selected.includes(item))
  })
})
</script>

<template>
  <view class="custom-container min-h-screen pb-20 transition-all duration-500" :style="{ background: appStore.themeGradient }">
    <!-- 自定义顶部状态栏 -->
    <view :style="{ paddingTop: `${statusBarHeight}px` }">
      <view class="flex items-center px-4" :style="{ height: `${navBarHeight}px` }">
        <text class="text-xl text-gray-800 font-black">定制与条件筛选</text>
      </view>
    </view>

    <!-- 1. 条件漏斗筛选 -->
    <view class="mx-4 mb-6 mt-2 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <text class="mb-4 block text-sm text-gray-800 font-black">🔍 决策范围过滤</text>

      <!-- 距离过滤 -->
      <view class="mb-4">
        <text class="mb-2 block text-xs text-gray-600 font-bold">服务距离：</text>
        <view class="flex gap-2">
          <view
            v-for="dist in distanceOptions"
            :key="dist"
            class="cursor-pointer border rounded-full px-3.5 py-1.5 text-2xs font-bold transition-all"
            :class="selectedDistance === dist
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-200'"
            @click="selectedDistance = dist"
          >
            {{ dist }}
          </view>
        </view>
      </view>

      <!-- 均价过滤 -->
      <view class="mb-4">
        <text class="mb-2 block text-xs text-gray-600 font-bold">人均预算：</text>
        <view class="flex gap-2">
          <view
            v-for="price in priceOptions"
            :key="price"
            class="cursor-pointer border rounded-full px-3.5 py-1.5 text-2xs font-bold transition-all"
            :class="selectedPrice === price
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-200'"
            @click="selectedPrice = price"
          >
            {{ price }}
          </view>
        </view>
      </view>

      <!-- 口味过滤 -->
      <view>
        <text class="mb-2 block text-xs text-gray-600 font-bold">倾向口味/营养标签：</text>
        <view class="flex flex-wrap gap-2">
          <view
            v-for="taste in tasteOptions"
            :key="taste"
            class="cursor-pointer border rounded-full px-3.5 py-1.5 text-2xs font-bold transition-all"
            :class="selectedTastes.includes(taste)
              ? 'bg-white text-gray-800 border-gray-800 ring-1 ring-gray-800'
              : 'bg-white text-gray-500 border-gray-200'"
            @click="toggleTaste(taste)"
          >
            {{ taste }} {{ selectedTastes.includes(taste) ? '✓' : '' }}
          </view>
        </view>
      </view>
    </view>

    <!-- 2. 极简身体档案 (轻食健康模式强提醒) -->
    <view class="mx-4 mb-6 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <view class="mb-4 flex items-center justify-between">
        <view>
          <text class="block text-sm text-gray-800 font-black">🥗 极简身体档案</text>
          <text class="mt-0.5 block text-3xs text-gray-400">自动推导每日热量及主要元素摄入目标</text>
        </view>
        <button
          class="shadow-xs border border-gray-200 rounded-full bg-white/80 px-3 py-1 text-3xs font-black transition-transform active:scale-95"
          @click="editProfile = !editProfile"
        >
          {{ editProfile ? '取消修改' : '修改档案' }}
        </button>
      </view>

      <!-- 表单编辑 -->
      <view v-if="editProfile" class="mb-4 flex flex-col animate-fade-in gap-4 border border-gray-100 rounded-2xl bg-gray-50 p-4">
        <view class="flex items-center justify-between">
          <text class="text-xs text-gray-600 font-bold">性别：</text>
          <view class="flex gap-2">
            <button
              class="border rounded-full px-3.5 py-1 text-2xs font-bold"
              :class="gender === 'male' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200'"
              @click="gender = 'male'"
            >
              👦 男生
            </button>
            <button
              class="border rounded-full px-3.5 py-1 text-2xs font-bold"
              :class="gender === 'female' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200'"
              @click="gender = 'female'"
            >
              👧 女生
            </button>
          </view>
        </view>

        <view class="flex items-center justify-between">
          <text class="text-xs text-gray-600 font-bold">年龄 (岁)：</text>
          <input v-model="age" type="number" class="w-24 border rounded-lg bg-white px-3 py-1 text-right text-xs">
        </view>

        <view class="flex items-center justify-between">
          <text class="text-xs text-gray-600 font-bold">身高 (cm)：</text>
          <input v-model="height" type="number" class="w-24 border rounded-lg bg-white px-3 py-1 text-right text-xs">
        </view>

        <view class="flex items-center justify-between">
          <text class="text-xs text-gray-600 font-bold">体重 (kg)：</text>
          <input v-model="weight" type="number" class="w-24 border rounded-lg bg-white px-3 py-1 text-right text-xs">
        </view>

        <view class="flex items-center justify-between">
          <text class="text-xs text-gray-600 font-bold">管理目标：</text>
          <view class="flex gap-1.5">
            <button
              class="border rounded-lg px-2.5 py-1 text-3xs font-bold"
              :class="target === 'lose' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200'"
              @click="target = 'lose'"
            >
              🔥 减脂
            </button>
            <button
              class="border rounded-lg px-2.5 py-1 text-3xs font-bold"
              :class="target === 'gain' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200'"
              @click="target = 'gain'"
            >
              💪 增肌
            </button>
            <button
              class="border rounded-lg px-2.5 py-1 text-3xs font-bold"
              :class="target === 'maintain' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-700 border-gray-200'"
              @click="target = 'maintain'"
            >
              ⚖️ 维持
            </button>
          </view>
        </view>

        <button
          class="mt-2 w-full rounded-xl bg-green-600 py-2.5 text-xs text-white font-bold shadow-md"
          @click="saveProfile"
        >
          计算并更新宏量营养目标
        </button>
      </view>

      <!-- 营养素仪表盘显示 -->
      <view class="flex items-center justify-between border border-green-100 rounded-2xl from-green-50 to-emerald-50 bg-gradient-to-r p-4">
        <view class="flex flex-col">
          <text class="text-3xs text-gray-500 font-bold">目标热量预算</text>
          <text class="mt-1 text-2xl text-green-700 font-black">{{ appStore.bodyProfile.calGoal }} <text class="text-xs font-bold">kcal</text></text>
          <view class="mt-2 flex gap-2.5">
            <text class="text-3xs text-gray-600 font-medium">💪 蛋白: {{ appStore.bodyProfile.proteinGoal }}g</text>
            <text class="text-3xs text-gray-600 font-medium">🍙 碳水: {{ appStore.bodyProfile.carbsGoal }}g</text>
            <text class="text-3xs text-gray-600 font-medium">🥑 脂肪: {{ appStore.bodyProfile.fatGoal }}g</text>
          </view>
        </view>

        <!-- 卡路里圆环打卡指示 -->
        <view class="text-right">
          <text class="text-3xs text-gray-500 font-black">今日摄入打卡进度</text>
          <text class="mt-1 block text-sm text-gray-800 font-extrabold">
            {{ consumedCalories }} / {{ appStore.bodyProfile.calGoal }} kcal
          </text>

          <view class="mt-2 flex justify-end gap-1.5">
            <button class="shadow-xs rounded-full bg-green-600 px-2.5 py-1 text-3xs text-white font-bold" @click="addMockMeal">
              + 记录一餐
            </button>
            <button class="rounded-full bg-gray-200 px-2.5 py-1 text-3xs text-gray-600 font-bold" @click="resetMockProgress">
              重置
            </button>
          </view>
        </view>
      </view>
    </view>

    <!-- 3. 冰箱食材匹配 -->
    <view class="mx-4 mb-6 rounded-3xl bg-white/70 p-5 shadow-sm backdrop-blur">
      <view class="mb-3 flex items-center justify-between">
        <view>
          <text class="text-sm text-gray-800 font-black">🍳 冰箱食材匹配 (自炊党)</text>
          <text class="mt-0.5 block text-3xs text-gray-400">勾选已有的生鲜食材，为您自动配菜</text>
        </view>
      </view>

      <view class="mb-5 flex flex-wrap gap-2.5">
        <view
          v-for="item in ingredientList"
          :key="item"
          class="flex cursor-pointer items-center border rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all"
          :class="appStore.fridgeIngredients.includes(item)
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-600 border-gray-200'"
          @click="toggleIngredient(item)"
        >
          <text class="mr-1">{{ appStore.fridgeIngredients.includes(item) ? '🟢' : '⚪' }}</text>
          {{ item }}
        </view>
      </view>

      <button
        class="w-full rounded-2xl py-3 text-sm text-white font-black shadow-md transition-transform active:scale-95"
        :style="{ background: themeColor }"
        @click="showRecipeResult = true"
      >
        🍳 匹配智能家常菜谱 (已配出 {{ matchedRecipes.length }} 个)
      </button>
    </view>

    <!-- 智能菜谱展示弹窗 -->
    <view v-if="showRecipeResult" class="backdrop-blur-xs fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/60 p-6">
      <view class="animate-scale-in max-h-85% max-w-sm w-full flex flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-2xl">
        <view class="mb-4 flex shrink-0 items-center justify-between">
          <text class="text-base text-gray-800 font-black">🍳 智能配菜结果</text>
          <button class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500 font-bold" @click="showRecipeResult = false">
            关闭
          </button>
        </view>

        <!-- 滚动列表 -->
        <scroll-view :scroll-y="true" class="flex-1 overflow-y-auto">
          <view v-if="matchedRecipes.length === 0" class="py-12 text-center text-gray-400">
            <text class="mb-3 block text-4xl">🥘</text>
            <text class="text-xs font-bold">未能匹配出可用菜谱</text>
            <text class="mt-1 block text-3xs">请尝试勾选更多食材（如西红柿、鸡蛋、鸡胸肉等）</text>
          </view>

          <view v-else class="flex flex-col gap-4 pb-4">
            <view
              v-for="(recipe, idx) in matchedRecipes"
              :key="idx"
              class="border border-gray-100 rounded-2xl bg-gray-50 p-4"
            >
              <view class="mb-2 flex items-center justify-between">
                <text class="text-sm text-gray-800 font-black">{{ recipe.name }}</text>
                <text class="border border-orange-100 rounded bg-orange-50 px-1.5 py-0.5 text-3xs text-orange-600 font-extrabold">
                  ⏱️ {{ recipe.time }} · {{ recipe.difficulty }}
                </text>
              </view>

              <view class="mb-3 flex items-center gap-1">
                <text class="text-3xs text-gray-400 font-bold">原料: </text>
                <text
                  v-for="ing in recipe.ingredients"
                  :key="ing"
                  class="rounded bg-gray-200/60 px-1.5 py-0.5 text-3xs text-gray-600 font-semibold"
                >
                  {{ ing }}
                </text>
              </view>

              <view class="mb-3 h-px w-full bg-gray-200/50" />

              <view class="flex flex-col gap-1.5">
                <view
                  v-for="(step, sIdx) in recipe.steps"
                  :key="sIdx"
                  class="flex items-start text-2xs text-gray-600 leading-relaxed"
                >
                  <text class="mr-1.5 mt-0.5 h-4 w-4 flex shrink-0 items-center justify-center rounded-full bg-gray-200 text-3xs text-gray-800 font-extrabold">
                    {{ sIdx + 1 }}
                  </text>
                  <text class="flex-1">{{ step }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
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
