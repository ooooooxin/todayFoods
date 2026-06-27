import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 入口来源类型
 */
export type EntrySource
  = | 'creativeSpaceIndex' // 创作空间主页
    | 'collectionAssets' // 创作空间合集素材页
    | 'auditCenter' // 审核中心

/**
 * 接口参数类型
 */
export interface ApiParams {
  // 创作空间主页参数
  creativeSpaceIndex?: {
    category?: number
    fileType?: number
    onlyApproved?: boolean
  }
  // 创作空间合集素材页参数
  collectionAssets?: {
    collectionId: string
  }
  // 审核中心参数
  auditCenter?: {
    id: number
    auditStatus?: number | undefined
    saleStatus?: number | undefined
  }
}

/**
 * previewDetails 专用 Store
 * 仅用于存储：
 * 1. 用户输入的参数数据
 * 2. 用户点击的item数据
 * 3. 入口类型信息
 */
export const usePreviewDetailsStore = defineStore(
  'previewDetails',
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
     */
    const setCurrentItem = (item: any, index: number = 0) => {
      currentItem.value = item
      currentIndex.value = index
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
    }

    return {
      // State
      entrySource,
      apiParams,
      currentItem,
      currentIndex,
      // Actions
      setEntrySource,
      setApiParams,
      setCurrentItem,
      clearAll,
    }
  },
  {
    // 不持久化存储，页面退出后数据自动清除
    persist: false,
  },
)
