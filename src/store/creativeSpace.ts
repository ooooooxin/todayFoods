import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 合集项接口
 */
export interface CollectionItem {
  id: string
  name: string
  count: number
  bg: string
  images: string[]
  shareCode?: string
  selected?: boolean
}

/**
 * 创作空间状态管理
 */
export const useCreativeSpaceStore = defineStore(
  'creativeSpace',
  () => {
    // 合集列表数据
    const collectionList = ref<CollectionItem[]>([])

    // 设置合集列表
    const setCollectionList = (list: CollectionItem[]) => {
      collectionList.value = list
    }

    // 清空合集列表
    const clearCollectionList = () => {
      collectionList.value = []
    }

    // 根据ID删除合集
    const removeCollectionById = (id: string) => {
      collectionList.value = collectionList.value.filter(item => item.id !== id)
    }

    // 批量删除合集
    const removeCollectionsByIds = (ids: string[]) => {
      collectionList.value = collectionList.value.filter(item => !ids.includes(item.id))
    }

    return {
      collectionList,
      setCollectionList,
      clearCollectionList,
      removeCollectionById,
      removeCollectionsByIds,
    }
  },
)
