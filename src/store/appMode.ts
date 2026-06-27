import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export interface FoodRecord {
  food: string
  date: string // YYYY-MM-DD
  mode: 'normal' | 'health'
  rating?: number
  note?: string
  restaurant?: string
}

export interface BodyProfile {
  age?: number
  height?: number
  weight?: number
  gender?: 'male' | 'female'
  target?: 'lose' | 'gain' | 'maintain'
  calGoal?: number
  proteinGoal?: number
  carbsGoal?: number
  fatGoal?: number
}

export const useAppStore = defineStore(
  'appMode',
  () => {
    // 默认大众模式(normal)，轻食模式为(health)
    const mode = ref<'normal' | 'health'>('normal')

    // 黑名单与白名单
    const blacklist = ref<string[]>(['肥肉', '油炸食品'])
    const whitelist = ref<string[]>(['黄焖鸡米饭', '牛肉沙拉', '鸡胸肉意面', '清爽番茄牛腩'])

    // 默认干饭记录数据
    const history = ref<FoodRecord[]>([
      { food: '麻辣烫', date: '2026-06-26', mode: 'normal', rating: 4, restaurant: '张亮麻辣烫', note: '多加了麻酱，很香' },
      { food: '鸡胸肉沙拉', date: '2026-06-25', mode: 'health', rating: 5, restaurant: '沙野轻食', note: '低油低脂，吃完没有负担' },
      { food: '黄焖鸡米饭', date: '2026-06-24', mode: 'normal', rating: 3, restaurant: '杨铭宇黄焖鸡', note: '味道很好，就是稍微咸了一点' },
      { food: '藜麦牛肉饭', date: '2026-06-23', mode: 'health', rating: 4, restaurant: '健康食刻', note: '饱腹感很强，牛肉很多' },
    ])

    // 身体档案数据
    const bodyProfile = ref<BodyProfile>({
      age: 24,
      height: 175,
      weight: 68,
      gender: 'male',
      target: 'lose',
      calGoal: 1800,
      proteinGoal: 120,
      carbsGoal: 200,
      fatGoal: 50,
    })

    // 冰箱食材
    const fridgeIngredients = ref<string[]>(['鸡蛋', '西红柿', '鸡胸肉', '西兰花'])

    // 抽取限制，每天 5 次，超出需要看广告重置
    const drawLimit = ref({
      count: 5,
      date: new Date().toISOString().split('T')[0],
    })

    // 根据模式计算当前的主题色
    const themeColor = computed(() => (mode.value === 'health' ? '#00C853' : '#FF7A00'))
    // 主题渐变背景
    const themeGradient = computed(() =>
      mode.value === 'health'
        ? 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)'
        : 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
    )

    function toggleMode() {
      mode.value = mode.value === 'health' ? 'normal' : 'health'
    }

    function setMode(newMode: 'normal' | 'health') {
      mode.value = newMode
    }

    function addToBlacklist(item: string) {
      if (item && !blacklist.value.includes(item)) {
        blacklist.value.push(item)
        // 从白名单移除
        removeFromWhitelist(item)
      }
    }

    function removeFromBlacklist(item: string) {
      blacklist.value = blacklist.value.filter(i => i !== item)
    }

    function addToWhitelist(item: string) {
      if (item && !whitelist.value.includes(item)) {
        whitelist.value.push(item)
        // 从黑名单移除
        removeFromBlacklist(item)
      }
    }

    function removeFromWhitelist(item: string) {
      whitelist.value = whitelist.value.filter(i => i !== item)
    }

    function addHistory(record: Omit<FoodRecord, 'date'> & { date?: string }) {
      const today = new Date().toISOString().split('T')[0]
      history.value.unshift({
        ...record,
        date: record.date || today,
      })
    }

    function deleteHistory(index: number) {
      history.value.splice(index, 1)
    }

    function updateBodyProfile(profile: Partial<BodyProfile>) {
      bodyProfile.value = { ...bodyProfile.value, ...profile }
      // 根据体重年龄等自动重算参考建议
      const weight = bodyProfile.value.weight || 65
      const height = bodyProfile.value.height || 170
      const age = bodyProfile.value.age || 25
      const gender = bodyProfile.value.gender || 'male'

      // 简单 BMR (哈里斯-贝内迪克特公式)
      let bmr = 0
      if (gender === 'male') {
        bmr = 66.47 + 13.75 * weight + 5 * height - 6.76 * age
      }
      else {
        bmr = 655.1 + 9.56 * weight + 1.85 * height - 4.68 * age
      }

      // 假设轻度活动 TDEE = BMR * 1.375
      const tdee = Math.round(bmr * 1.375)

      let targetCal = tdee
      if (bodyProfile.value.target === 'lose')
        targetCal = tdee - 400
      else if (bodyProfile.value.target === 'gain')
        targetCal = tdee + 300

      bodyProfile.value.calGoal = Math.max(1200, targetCal)
      // 蛋白质：lose: 1.8g/kg, gain: 2.0g/kg, maintain: 1.5g/kg
      const protFactor = bodyProfile.value.target === 'gain' ? 2.0 : (bodyProfile.value.target === 'lose' ? 1.8 : 1.5)
      bodyProfile.value.proteinGoal = Math.round(weight * protFactor)
      // 脂肪：卡路里的 25% (1g 脂肪 = 9kcal)
      bodyProfile.value.fatGoal = Math.round((bodyProfile.value.calGoal * 0.25) / 9)
      // 碳水：剩下的卡路里 (1g 碳水 = 4kcal)
      bodyProfile.value.carbsGoal = Math.round((bodyProfile.value.calGoal - (bodyProfile.value.proteinGoal * 4) - (bodyProfile.value.fatGoal * 9)) / 4)
    }

    function addFridgeIngredient(item: string) {
      if (item && !fridgeIngredients.value.includes(item)) {
        fridgeIngredients.value.push(item)
      }
    }

    function removeFridgeIngredient(item: string) {
      fridgeIngredients.value = fridgeIngredients.value.filter(i => i !== item)
    }

    function useDraw() {
      const today = new Date().toISOString().split('T')[0]
      if (drawLimit.value.date !== today) {
        drawLimit.value.count = 5
        drawLimit.value.date = today
      }
      if (drawLimit.value.count > 0) {
        drawLimit.value.count--
        return true
      }
      return false
    }

    function resetDrawLimit() {
      drawLimit.value.count = 5
      drawLimit.value.date = new Date().toISOString().split('T')[0]
    }

    return {
      mode,
      blacklist,
      whitelist,
      history,
      bodyProfile,
      fridgeIngredients,
      drawLimit,
      themeColor,
      themeGradient,
      toggleMode,
      setMode,
      addToBlacklist,
      removeFromBlacklist,
      addToWhitelist,
      removeFromWhitelist,
      addHistory,
      deleteHistory,
      updateBodyProfile,
      addFridgeIngredient,
      removeFridgeIngredient,
      useDraw,
      resetDrawLimit,
    }
  },
  {
    persist: true,
  },
)
