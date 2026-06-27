import type { IUpdateInfo, IUserInfoRes } from '@/api/types/login'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  getAssociatedAccounts,
  getUserInfo,
  updateInfo,
} from '@/api/login'

// 初始化状态
const userInfoState: IUserInfoRes = {
  id: 0,
  phone: '',
  nickname: '',
  avatar: '',
  gender: 0,
  uniqueCode: '',
  level: 1,
  type: 1,
  wechatBindStatus: 0,
  createTime: '',
  isRealName: 0,
  status: 1,
  seriesId: '',
  canUpdateNickname: false,
  canUpdateUniqueCode: false,
  nextNicknameUpdateTime: null,
}

export const useUserStore = defineStore(
  'user',
  () => {
    // 定义用户信息
    const userInfo = ref<IUserInfoRes>({ ...userInfoState })
    // 设置用户信息
    const setUserInfo = (val: IUserInfoRes) => {
      console.log('设置用户信息', val)
      // 若头像为空 则使用默认头像
      if (!val.avatar) {
        val.avatar = userInfoState.avatar
      }
      userInfo.value = val
    }
    const setUserAvatar = (avatar: string) => {
      userInfo.value.avatar = avatar
      console.log('设置用户头像', avatar)
      console.log('userInfo', userInfo.value)
    }
    const accountList = ref<any[]>([])
    const authTicket = ref('')
    const hasMultiAccount = computed(() => accountList.value.length > 1)

    // 删除用户信息
    const clearUserInfo = () => {
      userInfo.value = { ...userInfoState }
      accountList.value = []
      uni.removeStorageSync('user')
    }

    /**
     * 本地更新当前选中的账号状态（切换账号时使用，避免多余接口请求）
     */
    const updateCurrentAccountLocally = (accountId: string | number) => {
      accountList.value = accountList.value.map(item => ({
        ...item,
        current: Number(item.id) === Number(accountId) || Number(item.accountId) === Number(accountId),
      }))
    }

    let fetchAssociatedAccountsPromise: Promise<any> | null = null
    /**
     * 获取关联账号信息
     */
    const fetchAssociatedAccounts = async (force = false) => {
      if (!force && accountList.value.length > 0) {
        return accountList.value
      }
      if (fetchAssociatedAccountsPromise)
        return fetchAssociatedAccountsPromise

      fetchAssociatedAccountsPromise = (async () => {
        try {
          const res = await getAssociatedAccounts()
          accountList.value = res || []
        }
        catch (e) {
          console.error('获取关联账号失败', e)
          accountList.value = []
        }
        finally {
          fetchAssociatedAccountsPromise = null
        }
        return accountList.value
      })()
      return fetchAssociatedAccountsPromise
    }
    let fetchUserInfoPromise: Promise<any> | null = null
    /**
     * 获取用户信息
     */
    const fetchUserInfo = async (forceAccounts = false) => {
      if (fetchUserInfoPromise)
        return fetchUserInfoPromise

      fetchUserInfoPromise = (async () => {
        try {
          const res = await getUserInfo()
          setUserInfo(res)
          await fetchAssociatedAccounts(forceAccounts)
          return res
        }
        finally {
          fetchUserInfoPromise = null
        }
      })()
      return fetchUserInfoPromise
    }

    /**
     * 更新用户信息
     */
    const updateUserInfo = async (data: IUpdateInfo) => {
      await updateInfo(data)
      // 更新成功后重新获取用户信息
      await fetchUserInfo()
    }

    return {
      userInfo,
      accountList,
      authTicket,
      hasMultiAccount,
      clearUserInfo,
      fetchUserInfo,
      setUserInfo,
      setUserAvatar,
      updateUserInfo,
      fetchAssociatedAccounts,
      updateCurrentAccountLocally,
    }
  },
  {
    persist: true,
  },
)
