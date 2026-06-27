<script lang="ts" setup>
import { computed } from 'vue'
// import { showCustomToast } from '@/composables/useCustomToast'
import { useUserStore } from '@/store/user'

definePage({
  style: {
    navigationBarTitleText: '',
  },
})

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

// 选择头像
function chooseAvatar() {
  uni.navigateTo({ url: '/pages/me/editAvatar' })
}

// 复制Kanoo号
function copyUniqueCode() {
  uni.setClipboardData({
    data: userInfo.value.uniqueCode,
    success: () => {
      // 复制的toast必须用uni提供的，否则无法覆盖原生toast
      uni.showToast({ title: '已复制', icon: 'success' })
    },
    fail: (err) => {
      console.log('复制失败', err)
      // 复制的toast必须用uni提供的，否则无法覆盖原生toast
      uni.showToast({ title: '复制失败', icon: 'none' })
    },
  })
}

function goEditNickname() {
  uni.navigateTo({ url: '/pages/me/editNickname' })
}

function goEditUniqueCode() {
  uni.navigateTo({ url: '/pages/me/editUniqueCode' })
}

function goEditBio() {
  uni.navigateTo({ url: '/pages/me/editBio' })
}

function goEditGender() {
  uni.navigateTo({ url: '/pages/me/editGender' })
}

function goEditBirthday() {
  uni.navigateTo({ url: '/pages/me/editBirthday' })
}
</script>

<template>
  <view class="min-h-screen bg-[#f5f5f5]">
    <CommonHeader mode="auto" :scroll-top="0" />
    <custom-title text="编辑资料" text-color="text-main" />

    <!-- 头像 -->
    <view class="flex flex-col items-center py-48rpx">
      <view class="relative h-160rpx w-160rpx" @click="chooseAvatar">
        <image
          class="h-full w-full overflow-hidden rounded-full"
          :src="userInfo.avatar || '/static/images/default_picture.png'"
          mode="aspectFill"
        />
        <view class="absolute bottom-0 right-0 flex items-center justify-center rounded-full shadow-md">
          <image class="h-56rpx w-56rpx" src="/static/images/ic_avatar_replace.png" mode="aspectFit" />
        </view>
      </view>
    </view>

    <!-- 信息列表 -->
    <view class="mx-32rpx overflow-hidden rounded-24rpx bg-white">
      <!-- 名字 -->
      <view class="flex items-center justify-between px-32rpx py-32rpx" @click="goEditNickname">
        <text class="text-32rpx text-[#999]">名字</text>
        <view class="flex items-center gap-24rpx">
          <text class="max-w-[300rpx] truncate text-32rpx text-[#333]">{{ userInfo.nickname || '' }}</text>
          <i class="iconfont icon-a-shuxingxianxingmingchengtiaozhuanzhuangtaioff inline-block rotate-180 text-32rpx text-[#999]" />
        </view>
      </view>

      <view class="h-[1rpx] bg-[rgba(102,102,102,0.1)]" />

      <!-- Kanoo号 -->
      <view class="flex items-center justify-between px-32rpx py-32rpx" @click="goEditUniqueCode">
        <text class="text-32rpx text-[#999]">Kanoo号</text>
        <view class="flex items-center gap-24rpx">
          <text class="text-32rpx text-[#333]">{{ userInfo.uniqueCode || '-' }}</text>
          <i class="iconfont icon-a-shuxingxianxingmingchengtiaozhuanzhuangtaioff inline-block rotate-180 text-32rpx" />
        </view>
      </view>
    </view>

    <!-- 简介 -->
    <view
      class="mx-32rpx mt-24rpx flex items-center justify-between overflow-hidden rounded-24rpx bg-white px-32rpx py-32rpx"
      @click="goEditBio"
    >
      <text class="text-32rpx text-[#999]">简介</text>
      <view class="flex items-center gap-24rpx">
        <text class="max-w-[300rpx] truncate text-32rpx" :class="userInfo.bio ? 'text-[#333]' : 'text-[#999]'">{{ userInfo.bio || '点击这里，填写简介' }}</text>
        <i class="iconfont icon-a-shuxingxianxingmingchengtiaozhuanzhuangtaioff inline-block rotate-180 text-32rpx text-[#999]" />
      </view>
    </view>

    <!-- 第二组 -->
    <view class="mx-32rpx mt-24rpx overflow-hidden rounded-24rpx bg-white">
      <!-- 性别 -->
      <view class="flex items-center justify-between px-32rpx py-32rpx" @click="goEditGender">
        <text class="text-32rpx text-[#999]">性别</text>
        <view class="flex items-center gap-24rpx">
          <text class="text-32rpx" :class="userInfo.gender ? 'text-[#333]' : 'text-[#999]'">
            {{ userInfo.gender === 1 ? '男' : userInfo.gender === 2 ? '女' : '编辑性别' }}
          </text>
          <i class="iconfont icon-a-shuxingxianxingmingchengtiaozhuanzhuangtaioff inline-block rotate-180 text-32rpx text-[#999]" />
        </view>
      </view>

      <view class="h-[1rpx] bg-[rgba(102,102,102,0.1)]" />

      <!-- 生日 -->
      <view class="flex items-center justify-between px-32rpx py-32rpx" @click="goEditBirthday">
        <text class="text-32rpx text-[#999]">生日</text>
        <view class="flex items-center gap-24rpx">
          <text class="text-32rpx" :class="userInfo.birthday ? 'text-[#333]' : 'text-[#999]'">{{ userInfo.birthday || '选择生日' }}</text>
          <i class="iconfont icon-a-shuxingxianxingmingchengtiaozhuanzhuangtaioff inline-block rotate-180 text-32rpx text-[#999]" />
        </view>
      </view>
    </view>

    <!-- <view class="w-full bg-white">
      <image
        class="grayscale-image block w-full"
        src="@/static/images/test.png"
        mode="widthFix"
      />
    </view> -->
  </view>
</template>

<style scoped>
/* 灰度去色 + 白底透出：深色变浅灰，亮部保持清晰，不压高光细节 */
/* .grayscale-image {
  filter: grayscale(100%);
  opacity: 0.5;
} */
</style>
