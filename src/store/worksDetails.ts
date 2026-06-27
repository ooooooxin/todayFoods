import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 入口来源类型
 */
export type EntrySource
  = | 'home' // 首页推荐
    | 'creator' // 创作者主页
    | 'me' // 我的页面
    | 'history' // 浏览记录
    | 'collection' // 合集详情
    | 'ipCollection' // IP合集详情

/**
 * 接口参数类型
 */
export interface ApiParams {
  // 首页推荐参数
  home?: {
    sortType: 'hot' | 'latest'
    category?: number
    id?: number
    hotScore?: number
  }
  // 创作者主页参数
  creator?: {
    creatorId: number
    category?: number
  }
  // 我的页面参数
  me?: {
    tabType: 'creation' | 'favorite' | 'like'
    category?: number
  }
  // 浏览记录参数
  history?: {
    lastUpdateTime?: number
  }
  // 合集详情参数
  collection?: {
    collectionId: string
    titleName: string
  }
  // IP合集详情参数
  ipCollection?: {
    seriesId: string
    ipId: string
    category?: number
    sortType?: string
  }
}

/**
 * WorksDetails 专用 Store
 * 仅用于存储：
 * 1. 用户输入的参数数据
 * 2. 用户点击的item数据
 * 3. 入口类型信息
 */
export const useWorksDetailsStore = defineStore(
  'worksDetails',
  () => {
    // ==================== State ====================
    /** 入口来源 */
    const entrySource = ref<EntrySource | null>(null)
    /** 接口参数 */
    const apiParams = ref<ApiParams | null>(null)
    /** 当前点击的item数据 */
    const currentItem = ref<any | null>(null)
    /** 当前item在列表中的索引 */
    const currentIndex = ref<number>(0)
    /** 预加载的详情数据（从瀑布流组件获取） */
    const preloadedDetail = ref<any | null>(null)
    /** 预加载的tab列表数据（从历史记录页面获取） */
    const preloadedTabList = ref<any[] | null>(null)

    // ==================== Actions ====================

    /**
     * 设置入口来源
     * @param source 入口来源类型
     */
    const setEntrySource = (source: EntrySource) => {
      entrySource.value = source
    }

    /**
     * 设置接口参数
     * @param params 接口参数对象
     */
    const setApiParams = (params: ApiParams) => {
      apiParams.value = params
    }

    /**
     * 设置当前点击的item数据
     * @param item item数据
     * @param index item在列表中的索引
     * @param detail 预加载的详情数据（可选）
     */
    const setCurrentItem = (item: any, index: number = 0, detail: any = null) => {
      currentItem.value = item
      currentIndex.value = index
      preloadedDetail.value = detail
    }

    /**
     * 设置预加载的tab列表数据
     * @param list tab列表数据
     */
    const setPreloadedTabList = (list: any[]) => {
      preloadedTabList.value = list
    }

    /**
     * 清空所有数据
     * 在页面退出时调用，防止内存泄漏和数据污染
     */
    const clearAll = () => {
      entrySource.value = null
      apiParams.value = null
      currentItem.value = null
      currentIndex.value = 0
      preloadedDetail.value = null
      preloadedTabList.value = null
    }

    return {
      // State
      entrySource,
      apiParams,
      currentItem,
      currentIndex,
      preloadedDetail,
      preloadedTabList,
      // Actions
      setEntrySource,
      setApiParams,
      setCurrentItem,
      setPreloadedTabList,
      clearAll,
    }
  },
  {
    // 不持久化存储，页面退出后数据自动清除
    persist: false,
  },
)
