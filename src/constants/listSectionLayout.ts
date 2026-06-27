import { statusNavTotalHeight } from '@/utils/systemInfo'

/**
 * 列表区 min-height：`100vh - statusNavTotalHeight - sticky区域 - 可选底部占位`
 * sticky 高度用 rpx 与模板 class 对齐，再转为 px 参与 calc（与导航栏 px 一致）。
 */

/** 首页：筛选栏 sticky（Tab + 排序 + padding），与 `.custom-tabs__nav` 42px 及上下边距大致对应 */
export const HOME_STICKY_HEIGHT_RPX = 100

/**
 * 我的 / 创作者主页：第一行主 Tab `h-84rpx` + 第二行分类 `py-16rpx` + chip 行
 */
export const PROFILE_STICKY_HEIGHT_RPX = 168

/** 创作空间：仅主 Tab（合集 Tab，无次级行） */
export const CREATIVE_STICKY_ONE_ROW_RPX = 84

/** 创作空间：主 Tab + 次级分类行（创作 Tab） */
export const CREATIVE_STICKY_TWO_ROWS_RPX = 168

/**
 * 切 Tab 时「筛选栏已吸顶」判定与滚动目标（与首页 `uni.upx2px(686 + 202 - 76) - statusNavTotalHeight` 同类写法）
 */

/**
 * 创作空间：CommonHeader 之下头图区（`h-246rpx` + `pt-20rpx`）+ 内容区 `mt-16rpx` 至吸顶 Tab 上沿。
 * 原先漏加 pt-20rpx 对应文档高度，切 Tab 会多往上滚一截。
 */
export const CREATIVE_TAB_FILTER_BAR_RPX = 246 + 20 + 16

export function getCreativeSpaceTabFilterBarTopPx(): number {
  return uni.upx2px(CREATIVE_TAB_FILTER_BAR_RPX)
}

/**
 * 我的页：无 Banner 时 Header 下至吸顶 Tab（含创作管理/浏览记录等，比创作者页更长）
 */
export const PROFILE_ME_TAB_FILTER_BAR_RPX_NO_BANNER = 540

/**
 * 创作者详情：无「创作管理/浏览记录」等块，若与我的页共用同一 rpx，阈值偏大导致难以达到 isFilterSticky，切 Tab 不会 pageScrollTo
 */
export const PROFILE_CREATOR_TAB_FILTER_BAR_RPX_NO_BANNER = 470

export const PROFILE_TAB_FILTER_BAR_EXTRA_RPX_WITH_BANNER = 240

export function getProfileMeTabFilterBarTopPx(hasBanner: boolean): number {
  return uni.upx2px(
    PROFILE_ME_TAB_FILTER_BAR_RPX_NO_BANNER
    + (hasBanner ? PROFILE_TAB_FILTER_BAR_EXTRA_RPX_WITH_BANNER : 0),
  )
}

export function getProfileCreatorTabFilterBarTopPx(hasBanner: boolean): number {
  return uni.upx2px(
    PROFILE_CREATOR_TAB_FILTER_BAR_RPX_NO_BANNER
    + (hasBanner ? PROFILE_TAB_FILTER_BAR_EXTRA_RPX_WITH_BANNER : 0),
  )
}

export interface GetListSectionMinHeightStyleOptions {
  /** sticky 区域总高度（rpx） */
  stickyHeightRpx: number
  /** 底部固定条等额外占用（rpx），如创作空间底部操作区 */
  bottomReserveRpx?: number
}

/**
 * @returns 用于列表容器的 style，例如 `{ minHeight: 'calc(100vh - 148px)' }`
 */
export function getListSectionMinHeightStyle(options: GetListSectionMinHeightStyleOptions) {
  const stickyPx = uni.upx2px(options.stickyHeightRpx)
  const bottomPx = options.bottomReserveRpx ? uni.upx2px(options.bottomReserveRpx) : 0
  const subPx = statusNavTotalHeight + stickyPx + bottomPx
  return {
    minHeight: `calc(100vh - ${subPx}px)`,
  }
}
