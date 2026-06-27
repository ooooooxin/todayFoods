import type { AssetsTabItem } from '@/api/common'
import { computed, ref, watch } from 'vue'

/**
 * 二级分类项
 */
export interface SubTabItem {
  id: string
  name: string
}

// 一级分类默认数据
const DEFAULT_TABS: AssetsTabItem[] = [
  { id: '', name: '全部' },
  { id: '1', name: '表情' },
  { id: '2', name: '头像' },
  { id: '3', name: '背景' },
  { id: '4', name: '壁纸' },
]

// 二级分类映射关系
const SUB_TABS_MAP: Record<string, SubTabItem[]> = {
  // 全部
  '': [
    { id: '', name: '全部' },
    { id: '1', name: '图片' },
    { id: '2', name: 'GIF' },
    { id: '3', name: '视频' },
  ],
  // 表情
  '1': [
    { id: '', name: '全部' },
    { id: '1', name: '图片' },
    { id: '2', name: 'GIF' },
    { id: '3', name: '视频' },
  ],
  // 头像 - 无二级分类
  '2': [],
  // 背景
  '3': [
    { id: '', name: '全部' },
    { id: '1', name: '图片' },
    { id: '3', name: '视频' },
  ],
  // 壁纸
  '4': [
    { id: '', name: '全部' },
    { id: '1', name: '图片' },
    { id: '3', name: '视频' },
  ],
}

/**
 * 分类筛选组合式函数
 * 每个页面调用时创建独立的状态实例
 */
export function useCategoryFilter(options?: {
  defaultTabId?: string
  defaultSubTabId?: string
  // 是否启用二级分类跟随一级分类变更
  enableSubTabSync?: boolean
}) {
  // 是否启用二级分类跟随
  const enableSubTabSync = options?.enableSubTabSync ?? false

  // 一级分类列表
  const tabs = ref<AssetsTabItem[]>(DEFAULT_TABS)
  // 二级分类列表（动态）
  const subTabs = ref<SubTabItem[]>(SUB_TABS_MAP[options?.defaultTabId ?? ''] ?? SUB_TABS_MAP[''])

  // 当前激活的一级分类ID
  const currentTabId = ref<string>(options?.defaultTabId ?? '')
  // 当前激活的二级分类ID
  const currentSubTabId = ref<string>(options?.defaultSubTabId ?? '')

  // 当前激活的一级分类索引
  const currentTabIndex = computed(() => {
    return tabs.value.findIndex(t => t.id === currentTabId.value)
  })

  // 当前激活的二级分类索引
  const currentSubTabIndex = computed(() => {
    return subTabs.value.findIndex(t => t.id === currentSubTabId.value)
  })

  // 当前激活的一级分类名称
  const currentTabName = computed(() => {
    return tabs.value.find(t => t.id === currentTabId.value)?.name ?? '全部'
  })

  // 当前激活的二级分类名称
  const currentSubTabName = computed(() => {
    return subTabs.value.find(t => t.id === currentSubTabId.value)?.name ?? '全部'
  })

  // 二级分类显示文本（用于排序筛选按钮）
  const subTabDisplayText = computed(() => {
    return currentSubTabId.value ? currentSubTabName.value : '筛选'
  })

  // 是否已选择二级分类（用于红点提示）
  const hasSubTabSelected = computed(() => !!currentSubTabId.value)

  // 当前一级分类是否有二级分类
  const hasSubTabs = computed(() => subTabs.value.length > 0)

  // 监听一级分类变化，动态更新二级分类列表
  watch(
    currentTabId,
    (newTabId, oldTabId) => {
      if (!enableSubTabSync || newTabId === oldTabId)
        return

      // 更新二级分类列表
      const newSubTabs = SUB_TABS_MAP[newTabId] ?? []
      subTabs.value = newSubTabs

      // 如果切换到"头像"（id为'2'），二级tab重置为空
      if (newTabId === '2') {
        currentSubTabId.value = ''
      }
      // 如果新的二级分类列表中不包含当前选中的二级分类，重置为空
      else if (newSubTabs.length === 0) {
        currentSubTabId.value = ''
      }
      else if (!newSubTabs.some(t => t.id === currentSubTabId.value)) {
        // 如果当前选中的二级分类不在新的列表中，重置为"全部"
        currentSubTabId.value = ''
      }
    },
    { immediate: false },
  )

  // 切换一级分类
  function selectTab(id: string) {
    // 切换一级分类时，同步重置二级分类
    currentSubTabId.value = ''
    currentTabId.value = id
  }

  // 切换二级分类
  function selectSubTab(id: string) {
    currentSubTabId.value = id
  }

  // 重置一级分类
  function resetTab() {
    currentTabId.value = options?.defaultTabId ?? ''
    if (enableSubTabSync) {
      subTabs.value = SUB_TABS_MAP[currentTabId.value] ?? SUB_TABS_MAP['']
    }
  }

  // 重置二级分类
  function resetSubTab() {
    currentSubTabId.value = options?.defaultSubTabId ?? ''
  }

  // 重置所有分类
  function resetAll() {
    resetTab()
    resetSubTab()
  }

  // 获取请求参数（用于API调用）
  function getRequestParams() {
    return {
      category: currentTabId.value ? Number(currentTabId.value) : undefined,
      fileType: currentSubTabId.value ? Number(currentSubTabId.value) : undefined,
    }
  }

  return {
    // 分类数据
    tabs,
    subTabs,
    // 当前激活状态
    currentTabId,
    currentSubTabId,
    currentTabIndex,
    currentSubTabIndex,
    currentTabName,
    currentSubTabName,
    // 显示相关
    subTabDisplayText,
    hasSubTabSelected,
    hasSubTabs,
    // 配置
    enableSubTabSync,
    // 操作方法
    selectTab,
    selectSubTab,
    resetTab,
    resetSubTab,
    resetAll,
    getRequestParams,
  }
}

export default useCategoryFilter
