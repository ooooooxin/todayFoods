import type { OnShelfIpItem } from '@/api/ip/ip'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type UploadStatus = 'uploading' | 'failed' | 'completed'

export type MaterialType = 'image' | 'video' | 'gif'

export interface MaterialItem {
  id: string
  type: MaterialType
  name: string
  size: string
  progress: number
  status: UploadStatus
  failReason?: string
  thumbnail: string
  path?: string
  width?: number
  height?: number
  duration?: number
}

export interface ModelItem {
  type: number
  name: string
  tips: string
  img: string
}

export const useUploadStore = defineStore(
  'upload',
  () => {
    const materialList = ref<MaterialItem[]>([])

    const modelList = ref<ModelItem[]>([
      {
        type: 1,
        name: '表情',
        tips: '推荐比例1:1、支持图片/GIF/视频',
        img: '/static/images/ic_upload_emoji.png',
      },
      {
        type: 2,
        name: '头像',
        tips: '仅支持比例1:1、支持图片',
        img: '/static/images/ic_upload_avatar.png',
      },
      {
        type: 3,
        name: '背景',
        tips: '推荐比例 9:16/16:9、支持图片/视频',
        img: '/static/images/ic_upload_background.png',
      },
      {
        type: 4,
        name: '壁纸',
        tips: '推荐比例 9:16/16:9、支持图片/视频',
        img: '/static/images/ic_upload_wallpaper.png',
      },
    ])

    const currentType = ref<number>(1)

    function setCurrentType(type: number) {
      currentType.value = type
    }

    function addMaterials(files: MaterialItem[]) {
      materialList.value.push(...files)
    }

    function removeMaterial(id: string) {
      const index = materialList.value.findIndex(item => item.id === id)
      if (index > -1) {
        materialList.value.splice(index, 1)
      }
    }

    function getMaterialById(id: string) {
      return materialList.value.find(item => item.id === id)
    }

    function updateMaterialProgress(id: string, progress: number, status?: UploadStatus) {
      const index = materialList.value.findIndex(m => m.id === id)
      if (index > -1) {
        materialList.value[index] = {
          ...materialList.value[index],
          progress,
          ...(status && { status }),
        }
      }
    }

    function setMaterialFailed(id: string, failReason: string) {
      const index = materialList.value.findIndex(m => m.id === id)
      if (index > -1) {
        materialList.value[index] = {
          ...materialList.value[index],
          status: 'failed',
          failReason,
        }
      }
    }

    function updateMaterialThumbnail(id: string, thumbnail: string) {
      const index = materialList.value.findIndex(m => m.id === id)
      if (index > -1) {
        materialList.value[index] = {
          ...materialList.value[index],
          thumbnail,
        }
      }
    }

    function clearMaterials() {
      materialList.value = []
    }

    function getMaterials() {
      return materialList.value
    }

    const hasUploading = computed(() => materialList.value.some(item => item.status === 'uploading'))
    const hasCompleted = computed(() => materialList.value.some(item => item.status === 'completed'))
    const isButtonActive = computed(() => !hasUploading.value && hasCompleted.value)

    // 选中的关联IP（单选，存储整个对象）
    const selectedIp = ref<OnShelfIpItem | null>(null)
    // 标记是否从选择IP页面返回
    const isFromSelectIp = ref(false)

    function setSelectedIp(ip: OnShelfIpItem | null) {
      selectedIp.value = ip
    }

    function clearSelectedIp() {
      selectedIp.value = null
    }

    function setFromSelectIp(flag: boolean) {
      isFromSelectIp.value = flag
    }

    function clearSelectedIpState() {
      selectedIp.value = null
      isFromSelectIp.value = false
    }

    return {
      materialList,
      modelList,
      currentType,
      setCurrentType,
      addMaterials,
      removeMaterial,
      getMaterialById,
      updateMaterialProgress,
      setMaterialFailed,
      updateMaterialThumbnail,
      clearMaterials,
      getMaterials,
      hasUploading,
      hasCompleted,
      isButtonActive,
      selectedIp,
      setSelectedIp,
      clearSelectedIp,
      isFromSelectIp,
      setFromSelectIp,
      clearSelectedIpState,
    }
  },
  {
    persist: false,
  },
)
