import { defineStore } from 'pinia'
import { ref } from 'vue'

// 简化的IP项类型（用于页面间传递）
export interface SimpleIpItem {
  id: string
  name: string
  avatarImgUrl?: string | null
  /** 综合互动量（用于分页） */
  interactionScore?: string
}

export const useIpCollectionStore = defineStore(
  'ipCollection',
  () => {
    const currentIpItem = ref<SimpleIpItem | null>(null)
    const seriesId = ref<string>('')

    const setCurrentIpItem = (item: SimpleIpItem | null) => {
      currentIpItem.value = item
    }

    const setSeriesId = (id: string) => {
      seriesId.value = id
    }

    const clearAll = () => {
      currentIpItem.value = null
      seriesId.value = ''
    }

    return {
      currentIpItem,
      seriesId,
      setCurrentIpItem,
      setSeriesId,
      clearAll,
    }
  },
  {
    persist: false,
  },
)
