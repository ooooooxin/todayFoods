<script lang="ts" setup>
import { computed, ref } from 'vue'
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

const birthday = ref(userInfo.value.birthday || '')
const showPublic = ref(userInfo.value.setting?.birthdayPublic ?? false)
// 多选：展示年龄 / 展示生肖，初始读取已保存的设置
const showAge = ref(userInfo.value.setting?.showAge ?? false)
const showZodiac = ref(userInfo.value.setting?.showZodiac ?? false)
const showConstellation = ref(userInfo.value.setting?.showConstellation ?? false)

// 保存初始状态，用于判断是否有变更
const _saved = {
  birthday: userInfo.value.birthday || '',
  showPublic: userInfo.value.setting?.birthdayPublic ?? false,
  showAge: userInfo.value.setting?.showAge ?? false,
  showZodiac: userInfo.value.setting?.showZodiac ?? false,
  showConstellation: userInfo.value.setting?.showConstellation ?? false,
}

// picker 日期范围：1950 – 当前年份
const today = new Date()
const maxDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const minDate = '1950-01-01'
// 未选择时 picker 打开的默认时间
const pickerDefault = '2000-01-01'
const minYear = Number(minDate.slice(0, 4))
const maxYear = Number(maxDate.slice(0, 4))

const showBirthdayPopup = ref(false)
const pickerValue = ref([0, 0, 0])
const draftYear = ref(Number(pickerDefault.slice(0, 4)))
const draftMonth = ref(Number(pickerDefault.slice(5, 7)))
const draftDay = ref(Number(pickerDefault.slice(8, 10)))

const years = computed(() => {
  return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index)
})

const months = computed(() => {
  const end = draftYear.value === maxYear ? today.getMonth() + 1 : 12
  return Array.from({ length: end }, (_, index) => index + 1)
})

const days = computed(() => {
  const maxDayOfMonth = new Date(draftYear.value, draftMonth.value, 0).getDate()
  const end = draftYear.value === maxYear && draftMonth.value === today.getMonth() + 1
    ? Math.min(maxDayOfMonth, today.getDate())
    : maxDayOfMonth

  return Array.from({ length: end }, (_, index) => index + 1)
})

// 保存可点击：有生日且与已保存状态不完全一致
const canSave = computed(() => {
  if (!birthday.value?.trim())
    return false
  return birthday.value !== _saved.birthday
    || showPublic.value !== _saved.showPublic
    || showAge.value !== _saved.showAge
    || showZodiac.value !== _saved.showZodiac
    || showConstellation.value !== _saved.showConstellation
})

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function clampDraftDate() {
  const validMonths = months.value
  const lastMonth = validMonths[validMonths.length - 1]
  if (!validMonths.includes(draftMonth.value))
    draftMonth.value = lastMonth

  const validDays = days.value
  const lastDay = validDays[validDays.length - 1]
  if (!validDays.includes(draftDay.value))
    draftDay.value = lastDay
}

function syncPickerValue() {
  clampDraftDate()
  const yearIndex = Math.max(0, years.value.indexOf(draftYear.value))
  const monthIndex = Math.max(0, months.value.indexOf(draftMonth.value))
  const dayIndex = Math.max(0, days.value.indexOf(draftDay.value))
  pickerValue.value = [yearIndex, monthIndex, dayIndex]
}

function openBirthdayPopup() {
  const [year, month, day] = (birthday.value || pickerDefault).split('-').map(Number)
  draftYear.value = year
  draftMonth.value = month
  draftDay.value = day
  syncPickerValue()
  showBirthdayPopup.value = true
}

function onBirthdayPickerChange(e: any) {
  const [yearIndex, monthIndex, dayIndex] = e.detail.value
  draftYear.value = years.value[yearIndex] ?? draftYear.value
  draftMonth.value = months.value[monthIndex] ?? draftMonth.value
  draftDay.value = days.value[dayIndex] ?? draftDay.value
  syncPickerValue()
}

function confirmBirthday() {
  birthday.value = `${draftYear.value}-${padDatePart(draftMonth.value)}-${padDatePart(draftDay.value)}`
  showBirthdayPopup.value = false
}

async function onSave() {
  if (!canSave.value)
    return

  try {
    uni.showLoading({ title: '保存中...' })
    await updateUserInfo({
      birthday: {
        value: birthday.value,
        showPublic: showPublic.value,
        showAge: showAge.value,
        showZodiac: showZodiac.value,
        showConstellation: showConstellation.value,
      },
    })
    await userStore.fetchUserInfo()
    uni.hideLoading()
    showCustomToast({ title: '保存成功', icon: 'success' })
    setTimeout(() => uni.navigateBack(), 800)
  }
  catch (e: any) {
    uni.hideLoading()
    const msg = e?.message || '保存失败，请重试'
    showCustomToast({ title: msg, icon: 'none' })
  }
}
</script>

<template>
  <view class="min-h-screen bg-[#f5f5f5]">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="编辑生日" text-color="text-main" />

    <!-- 公历生日 -->
    <view class="mx-30rpx mt-30rpx overflow-hidden rounded-20rpx bg-white" @tap="openBirthdayPopup">
      <view class="flex items-center justify-between px-30rpx py-40rpx">
        <text class="text-30rpx text-[#181818]">
          公历生日
        </text>
        <view class="flex items-center gap-12rpx">
          <text class="text-28rpx text-[#999]">
            {{ birthday || '选择你的生日' }}
          </text>
          <i class="iconfont icon-a-shuxingxianxingmingchengtiaozhuanzhuangtaioff inline-block rotate-180 text-28rpx text-[#999]" />
        </view>
      </view>
    </view>

    <!-- 是否公开 + 多选项（同一卡片） -->
    <view class="mx-30rpx mt-24rpx overflow-hidden rounded-20rpx bg-white px-32rpx pb-32rpx">
      <!-- 是否公开展示生日标签 -->
      <view class="flex items-center justify-between py-40rpx">
        <text class="text-30rpx text-[#181818]">是否公开展示生日标签</text>
        <switch
          class="switch-small"
          :checked="showPublic"
          color="#333"
          @change="showPublic = $event.detail.value"
        />
      </view>

      <!-- 多选项，仅在开启公开时显示 -->
      <view v-if="showPublic" class="w-full flex flex-col gap-24rpx">
        <!-- 展示年龄 -->
        <view
          class="flex items-center justify-between rounded-24rpx bg-[#f5f5f5] px-32rpx py-40rpx"
          @click="showAge = !showAge"
        >
          <text
            class="text-30rpx"
            :class="showAge ? 'text-[#181818] font-bold' : 'text-[#666]'"
          >
            展示年龄
          </text>
          <fg-checkbox v-model="showAge" size="44rpx" />
        </view>

        <!-- 展示生肖 -->
        <view
          class="flex items-center justify-between rounded-24rpx bg-[#f5f5f5] px-32rpx py-40rpx"
          @click="showZodiac = !showZodiac"
        >
          <text
            class="text-30rpx"
            :class="showZodiac ? 'text-[#181818] font-bold' : 'text-[#666]'"
          >
            展示生肖
          </text>
          <fg-checkbox v-model="showZodiac" size="44rpx" />
        </view>

        <!-- 展示星座 -->
        <view
          class="flex items-center justify-between rounded-24rpx bg-[#f5f5f5] px-32rpx py-40rpx"
          @click="showConstellation = !showConstellation"
        >
          <text
            class="text-30rpx"
            :class="showConstellation ? 'text-[#181818] font-bold' : 'text-[#666]'"
          >
            展示星座
          </text>
          <fg-checkbox v-model="showConstellation" size="44rpx" />
        </view>
      </view>
    </view>

    <!-- 保存 -->
    <view class="fixed bottom-0 left-0 w-full pb-[calc(30rpx+env(safe-area-inset-bottom))]">
      <view
        class="mx-30rpx h-96rpx flex items-center justify-center rounded-full text-center transition-opacity"
        :class="canSave ? 'bg-primary' : 'bg-[#ECECEC] opacity-80'"
        @click="canSave && onSave()"
      >
        <text
          class="block w-full text-center text-32rpx font-bold"
          :class="canSave ? 'text-[#fff]' : 'text-[#999]'"
        >
          保存
        </text>
      </view>
    </view>

    <u-popup
      v-model="showBirthdayPopup"
      mode="bottom"
      :zoom="false"
      :mask-close-able="true"
      :closeable="false"
      border-radius="32"
      height="auto"
    >
      <view class="rounded-t-32rpx bg-[#f5f5f5] px-30rpx pb-[calc(30rpx+env(safe-area-inset-bottom))] pt-18rpx">
        <!-- <view class="mx-auto h-8rpx w-54rpx rounded-full bg-[#EBEBEB]" /> -->
        <text class="mt-32rpx block text-center text-34rpx text-[#181818] font-bold">
          选择你的生日
        </text>

        <view class="relative mt-28rpx h-480rpx rounded-24rpx bg-white">
          <view class="pointer-events-none absolute left-0 right-0 top-[198rpx] z-0 h-88rpx rounded-16rpx bg-[#F7F7F7]" />
          <picker-view
            class="relative z-1 h-480rpx"
            :value="pickerValue"
            indicator-style="height: 88rpx; background: transparent;"
            @change="onBirthdayPickerChange"
          >
            <picker-view-column>
              <view
                v-for="year in years"
                :key="year"
                class="h-88rpx flex items-center justify-center text-34rpx text-[#181818]"
              >
                {{ year }}年
              </view>
            </picker-view-column>
            <picker-view-column>
              <view
                v-for="month in months"
                :key="month"
                class="h-88rpx flex items-center justify-center text-34rpx text-[#181818]"
              >
                {{ month }}月
              </view>
            </picker-view-column>
            <picker-view-column>
              <view
                v-for="day in days"
                :key="day"
                class="h-88rpx flex items-center justify-center text-34rpx text-[#181818]"
              >
                {{ day }}日
              </view>
            </picker-view-column>
          </picker-view>
        </view>

        <view class="mt-40rpx h-96rpx flex items-center justify-center rounded-full bg-[#333]" @tap="confirmBirthday">
          <text class="text-32rpx text-white font-bold">
            保存
          </text>
        </view>
      </view>
    </u-popup>
  </view>
</template>

<style lang="scss" scoped>
.switch-small {
  transform: scale(0.7);
  transform-origin: right center;
}
</style>
