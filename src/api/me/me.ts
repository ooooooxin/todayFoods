/**
 * 我的页面相关接口
 */
import type { CursorPageResult, PageResult } from '@/http/types'
import { httpGet, httpPost } from '@/http/http'

/**
 * 合集内素材缩略信息
 */
export interface CollectionAssetItem {
  id: number
  thumbUrl: string
  hotScore: number
  category: number
  createTime: string
}

/**
 * 我的合集项
 */
export interface MyCollectionItem {
  /** 合集ID */
  id: number
  /** 合集名称 */
  title: string
  /** 合集简介 */
  intro: string
  /** 合集封面图 */
  coverUrl: string
  /** 合集头像图 */
  avatarImgUrl: string
  /** 口令（搜索码） */
  shareCode: string
  /** 关联素材总数 */
  assetCount: number
  /** 格式化后的关联素材总数 */
  assetCountFormatted: string
  /** 格式化后的人气值 */
  popularityStr: string
  /** 可见性: 1-公开, 0-私密 */
  isPublic: number
  /** 创建时间 */
  createTime: string
  /** 合集内排序后的前4条素材缩略图 */
  topAssets: CollectionAssetItem[]
}

/**
 * 我的素材项
 */
export interface MyAssetItem {
  /** 素材ID */
  id: string
  /** 素材ID（收藏/赞过列表使用） */
  interactionStateId: string
  assetsId: number
  /** 合集素材关联表ID */
  relationId: string
  /** 缩略图URL */
  thumbUrl: string
  /** 静态缩略图URL */
  staticThumbUrl: string
  /** 热度分数 */
  hotScore: number
  /** 分类 */
  category: number
  /** 分类名称 */
  categoryName: string
  /** 点赞数 */
  likeCount: number
  /** 格式化后的点赞数 */
  likeCountFormatted: string
  /** 下载数 */
  downloadCount: number
  /** 格式化后的下载数 */
  downloadCountFormatted: string
  /** 是否置顶 */
  isTop: number
  /** 排序值 */
  sort: number
  /** 创建时间 */
  createTime: string
  /** 上下架状态：0-上架, 1-未上架, 2-已下架, 3-用户已删除 */
  saleStatus?: number
}

/**
 * 4515 收藏列表单个项数据结构 (entityType = 5 即 IP系列)
 */
export interface MyCollectItem {
  contentId: number
  title: string
  description: string
  imgUrl: string
  coverImgUrl: string
  authorId: number | null
  authorName: string | null
  authorAvatar: string | null
  categoryFirstName: string | null
  categorySecondaryId: string | null
  categorySecondaryName: string | null
  popularity: number | null
  popularityStr: string | null
  tags: Array<{ id: number | null, name: string }>
  ratingActive: boolean
  updateTime: string
  version: string | null
}

export interface MyFavoriteOrLikeItem {
  assetsId: string
  interactionStateId: string
  thumbUrl: string
  /** 上下架状态：0-上架, 1-未上架, 2-已下架, 3-用户已删除 */
  saleStatus?: number
}

/**
 * 4515 获取我的收藏 参数
 */
export interface MyCollectParams {
  pageNum?: number
  pageSize?: number
  isDesensitize?: number // 0-加密 1-不加密 (默认1)
  memberId?: number
  entityType: number // 5 表示 IP 系列
}

/**
 * 6328 我的点赞/收藏素材 请求参数
 */
export interface FavoriteOrLikeListParams {
  /** 游标ID（上一页最后一条记录ID） */
  cursorId?: number | string
  /** 每页条数 */
  pageSize?: number
  /** 分类：1-表情, 2-头像, 3-背景, 4-壁纸 */
  assetsCategory?: number
  /** 文件类型ID/二级分类 1-图片、2-GIF、3-视频 （可选） */
  fileType?: number
  /** 列表类型：1-点赞列表，2-收藏列表 */
  type: 1 | 2
  /** 查询方向：next-往后查，prev-往前查 */
  direction?: 'NEXT' | 'PREV'
}

/**
 * 我的素材列表请求参数
 */
export interface MyAssetListParams {
  /** 创作者ID（可选） */
  creatorId?: number
  /** 分类 */
  category?: number
  /** 文件类型ID/二级分类 1-图片、2-GIF、3-视频 （可选） */
  fileType?: number
  /** 游标ID */
  cursorId?: number | string
  /** 排序值游标 */
  sortOrder?: number
  /** 每页条数，默认10 */
  pageSize?: number
  /** 查询方向：next-往后查，prev-往前查 */
  direction?: 'NEXT' | 'PREV'
  /** 排除的合集ID（用于筛选出不在指定合集内的素材列表） */
  excludeCollectionId?: string | number
  /** 是否仅显示已审核通过的素材 */
  onlyApproved?: boolean
  /** 是否置顶 */
  cursorIsTop?: number
}

/**
 * 关注统计响应数据 (7220)
 */
export interface FollowStatsRes {
  /** 用户关注数 */
  followedCountStr: string
  /** 用户粉丝数 */
  fansCountStr: string
  /** 收到点赞总数（作品 + 素材） */
  receivedLikeCountStr: string
  /** 收到收藏总数（作品 + 素材） */
  receivedCollectCountStr: string
  /** 收到点赞+收藏总数展示 */
  likeAndCollectCountStr: string
  /** 作品数 */
  contentCountStr: string
  /** 素材数 */
  assetCountStr: string
}

/**
 * 获取我的合集列表
 * @param params - 请求参数
 * @param params.pageSize - 每页条数，默认50
 *
 * @description GET /assetsCollection/myList
 * 返回当前登录用户创建的全部合集（未删除），每条包含：
 * 合集名称、口令（shareCode）、素材总数、排序后前4条素材缩略图
 */
export function getMyCollectionList() {
  return httpPost<CursorPageResult<MyCollectionItem>>('/assetsCollection/myList', { pageSize: 50 })
}

/**
 * 获取我的素材列表（瀑布流）
 *
 * @description POST /assets/myList
 * 支持分类筛选，按后台配置排序
 *
 * @param params - 请求参数
 */
export function getMyAssetList(params: MyAssetListParams = {}) {
  return httpPost<CursorPageResult<MyAssetItem>>('/assets/myList', params, {})
}

/**
 * 查询用户统计信息：关注数、粉丝数、收到赞+收藏 (7220)
 *
 * @description GET /me/getMemberStats
 * 支持根据用户ID查询，不传或为0时查询当前登录用户
 *
 * @param memberId 会员ID（可选）
 */
export function getFollowStats(memberId?: number) {
  return httpGet<FollowStatsRes>('/me/getMemberStats', memberId ? { memberId } : {})
}

/**
 * 获取我的收藏列表 (如 IP系列 等)
 *
 * @description POST /collect/listMyCollect
 */
export function listMyCollect(params: MyCollectParams) {
  return httpPost<PageResult<MyCollectItem>>('/collect/listMyCollect', params)
}

/**
 * 我的点赞/收藏素材列表（瀑布流）
 *
 * @description POST /assets/favoriteOrLikeList
 */
export function getFavoriteOrLikeList(params: FavoriteOrLikeListParams) {
  return httpPost<CursorPageResult<MyFavoriteOrLikeItem>>('/assets/favoriteOrLikeList', params)
}

/**
 * 批量清理失效素材（取消收藏或取消点赞）
 *
 * @param type - 类型：1-取消点赞，2-取消收藏
 *
 * @description POST /assets/batchCancelLikeOrFavorite
 */
export function cleanInvalidFavoriteOrLike(type: 1 | 2) {
  return httpPost('/assets/batchCancelLikeOrFavorite', {
    actionType: type,
  })
}

// ============ 创作者主页相关接口 ============

/**
 * 其他用户公开信息
 */
export interface CreatorPublicInfo {
  id: number
  nickname: string
  avatar: string
  bio: string
  constellation: string | null
  /** 性别: 0-未知;1-男;2-女（null代表不公开） */
  gender: number | null
  uniqueCode: string
  /** 年龄（null代表不公开） */
  age: number | null
  /** 生肖（null代表不公开） */
  zodiac: string | null
  /** 会员等级 1-普通用户; 2-认证作者; 3-签约创作者; 4-官方账号 */
  level: number
  /** 自定义背景图 */
  backgroundUrl?: string
  /** 所属 IP 系列名称 */
  seriesName?: string
  /** 所属 IP 系列 ID */
  seriesId?: string | number
  /** IP 系列 Banner 图 */
  bannerUrl?: string
}

/**
 * 创作者素材列表参数
 */
export interface CreatorAssetListParams {
  creatorId: number
  category?: number
  fileType?: number
  cursorId?: number
  cursorIsTop?: number
  sortOrder?: number
  pageSize?: number
  /** 查询方向：next-往后查，prev-往前查 */
  direction?: 'NEXT' | 'PREV'
}

/**
 * 查询其他用户公开信息 (2827)
 * POST /me/publicInfo
 */
export function getCreatorPublicInfo(id: number) {
  return httpPost<CreatorPublicInfo>('/me/publicInfo', { id: String(id) })
}

/**
 * 创作者素材列表（访问创作者主页）(6285)
 * POST /assets/creator/list
 * 只返回审核通过的公开素材，支持分类筛选
 */
export function getCreatorAssetList(params: CreatorAssetListParams) {
  return httpPost<CursorPageResult<MyAssetItem>>('/assets/creator/list', params)
}

/**
 * 创作者的公开合集列表（访问创作者主页）(6297)
 * POST /assetsCollection/creator/list
 */
export function getCreatorCollectionList(creatorId: number | string) {
  return httpPost<CursorPageResult<MyCollectionItem>>('/assetsCollection/creator/list', { creatorId, pageSize: 50, thumbnailCount: 4 })
}

/**
 * 浏览历史记录项
 */
export interface BrowsingHistoryItem {
  id: number
  entityId: number
  title: string
  intro: string
  /** 素材分类：1-表情, 2-头像, 3-背景, 4-壁纸 */
  category: number
  /** 素材格式：1-静态图, 2-动态图(GIF), 3-视频 */
  fileType: number
  url: string
  thumbUrl: string
  likeCount: number
  favoriteCount: number
  downloadCount: number
  authorId: number
  /** 最近浏览时间 */
  viewTime: string
}

/**
 * 素材浏览历史 (6276)
 * POST /browsing-history/list
 */
export function getBrowsingHistoryList(params: {
  pageNum?: number
  entityType?: number
  pageSize?: number
  lastUpdateTime?: number
  direction?: 'NEXT' | 'PREV'
}) {
  return httpPost<CursorPageResult<BrowsingHistoryItem>>('/browsing-history/list', params)
}

/**
 * 获取个人二维码 (7232)
 * GET /me/getQrCode
 */
export function getQrCode() {
  return httpGet('/me/getQrCode')
}
