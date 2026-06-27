/**
 * 创作空间相关接口
 */
import type { CursorPageResult } from '@/http/types'
import { httpPost } from '@/http/http'

/**
 * 创建合集请求参数
 */
export interface CreateCollectionParams {
  /** 合集名称：2-12个字符，支持中文、英文、数字、下划线、中点 */
  title: string
  /** 合集简介（可选） */
  intro?: string
  /** 合集封面图（可选） */
  coverUrl?: string
  /** 可见性: 1-公开, 0-私密，默认公开 */
  isPublic?: number
}

/**
 * 创建合集
 * POST /assetsCollection/create
 *
 * @param params - 请求参数
 * @param params.title - 合集名称（必填）
 * @param params.intro - 合集简介（可选）
 * @param params.coverUrl - 合集封面图（可选）
 * @param params.isPublic - 可见性（可选，默认1公开）
 *
 * @example
 * // 基础调用
 * const result = await createCollection({ title: '我的合集' })
 *
 * @example
 * // 完整参数
 * const result = await createCollection({
 *   title: '我的合集',
 *   intro: '这是一个简介',
 *   coverUrl: 'https://example.com/cover.jpg',
 *   isPublic: 1
 * })
 */
export function createCollection(params: CreateCollectionParams) {
  return httpPost('/assetsCollection/create', params)
}

/**
 * 更新合集请求参数
 */
export interface UpdateCollectionParams {
  /** 合集ID */
  id: number
  /** 合集名称：2-12个字符，支持中文、英文、数字、下划线、中点 */
  title: string
}

/**
 * 更新合集
 * POST /assetsCollection/update
 *
 * @param params - 请求参数
 * @param params.id - 合集ID（必填）
 * @param params.title - 合集名称（必填）
 *
 * @example
 * const result = await updateCollection({ id: 123, title: '新的合集名称' })
 */
export function updateCollection(params: UpdateCollectionParams) {
  return httpPost('/assetsCollection/update', params)
}

/**
 * 删除合集请求参数
 */
export interface DeleteCollectionParams {
  /** 合集ID列表 */
  ids: string[]
}

/**
 * 删除合集
/**
 * POST /assetsCollection/delete
 *
 * @param params - 请求参数
 * @param params.ids - 合集ID列表（必填）
 *
 * @example
 * await deleteCollection({ ids: ['1', '2', '3'] })
 */
export function deleteCollection(params: DeleteCollectionParams) {
  return httpPost('/assetsCollection/delete', params)
}

/**
 * 6528 查询合集内的素材列表（page分页）请求参数
 */
export interface GetCollectionAssetsByPageParams {
  /** 合集ID */
  collectionId: number
  /** 页码（从1开始） */
  page?: number
  /** 每页数量（默认20，最大100） */
  pageSize?: number
}

/**
 * 6528 合集素材项
 */
export interface CollectionAssetsByPageItem {
  /** 素材ID */
  id: number
  /** 合集素材关联表ID */
  relationId: number
  /** 缩略图URL */
  thumbUrl: string
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
}

/**
 * 6528 查询合集内的素材列表（page分页）
 * POST /assetsCollection/assetsByPage
 *
 * @description 支持多维度排序：
 * 1. 置顶标识（is_top 降序）
 * 2. 排序字段（sort 升序）
 * 3. ID（id 升序）
 *
 * @param params - 请求参数
 * @param params.collectionId - 合集ID（必填）
 * @param params.page - 页码（可选，从1开始）
 * @param params.pageSize - 每页数量（可选，默认20）
 *
 * @example
 * // 基础调用
 * const list = await getCollectionAssetsByPage({ collectionId: 123 })
 *
 * @example
 * // 带分页参数
 * const list = await getCollectionAssetsByPage({
 *   collectionId: 123,
 *   page: 1,
 *   pageSize: 20
 * })
 */
export function getCollectionAssetsByPage(params: GetCollectionAssetsByPageParams) {
  return httpPost<CursorPageResult<CollectionAssetsByPageItem>>('/assetsCollection/assetsByPage', params)
}

/**
 * 6416 添加素材到合集请求参数
 */
export interface AddAssetsToCollectionParams {
  /** 合集ID */
  collectionId: number | string
  /** 素材ID列表 */
  assetIds: (number | string)[]
}

/**
 * 6416 添加素材到合集
 * POST /assetsCollection/editRelation
 *
 * @param params - 请求参数
 * @param params.collectionId - 合集ID（必填）
 * @param params.assetIds - 素材ID列表（必填）
 *
 * @example
 * await addAssetsToCollection({ collectionId: 123, assetIds: [1, 2, 3] })
 */
export function addAssetsToCollection(params: AddAssetsToCollectionParams) {
  return httpPost('/assetsCollection/editRelation', params)
}

/**
 * 6728 对所有素材进行排序请求参数
 */
export interface SortAssetsParams {
  /** 被拖动的素材ID */
  assetId: number | string
  /** 目标位置的上一个素材ID（拖到最顶部时为 null） */
  prevAssetId?: number | string | null
  /** 目标位置的下一个素材ID（拖到最底部时为 null） */
  nextAssetId?: number | string | null
}

/**
 * 6728 对所有素材进行排序
 * POST /assets/sortAssets
 *
 * @param params - 请求参数
 * @param params.assetId - 被拖动的素材ID（必填）
 * @param params.prevAssetId - 目标位置的上一个素材ID（可选，拖到最顶部时为 null）
 * @param params.nextAssetId - 目标位置的下一个素材ID（可选，拖到最底部时为 null）
 *
 * @example
 * // 拖到中间
 * await sortAssets({ assetId: 123, prevAssetId: 100, nextAssetId: 200 })
 *
 * @example
 * // 拖到最顶部
 * await sortAssets({ assetId: 123, prevAssetId: null, nextAssetId: 200 })
 *
 * @example
 * // 拖到最底部
 * await sortAssets({ assetId: 123, prevAssetId: 100, nextAssetId: null })
 */
export function sortAssets(params: SortAssetsParams) {
  return httpPost('/assets/sortAssets', params)
}

/**
 * 6440 对合集进行排序请求参数
 */
export interface SortCollectionsParams {
  /** 合集id排序列表 */
  collections: string[]
}

/**
 * 6440 对合集进行排序
 * POST /assetsCollection/sortCollections
 *
 * @param params - 请求参数
 * @param params.collections - 合集排序列表（必填）
 *
 * @example
 * await sortCollections({
 *   collections: [
 *     { collectionId: 1 },
 *     { collectionId: 2 },
 *     { collectionId: 3 }
 *   ]
 * })
 */
export function sortCollections(params: SortCollectionsParams) {
  return httpPost('/assetsCollection/sortCollections', params)
}

/**
 * 对合集内素材进行排序请求参数
 */
export interface SortCollectionAssetsParams {
  /** 合集ID */
  collectionId?: number | string
  /** 被拖动的素材ID */
  assetId?: number | string
  /** 目标位置的上一个素材ID（拖到最顶部时为 null） */
  prevAssetId?: number | string | null
  /** 目标位置的下一个素材ID（拖到最底部时为 null） */
  nextAssetId?: number | string | null
}

/**
 * 对合集内素材进行排序
 * POST /assetsCollection/sortAssets
 *
 * @param params - 请求参数
 * @param params.collectionId - 合集ID（可选）
 * @param params.assetId - 被拖动的素材ID（可选）
 * @param params.prevAssetId - 目标位置的上一个素材ID（可选，拖到最顶部时为 null）
 * @param params.nextAssetId - 目标位置的下一个素材ID（可选，拖到最底部时为 null）
 *
 * @example
 * // 拖到中间
 * await sortCollectionAssets({ collectionId: 1, assetId: 123, prevAssetId: 100, nextAssetId: 200 })
 *
 * @example
 * // 拖到最顶部
 * await sortCollectionAssets({ collectionId: 1, assetId: 123, prevAssetId: null, nextAssetId: 200 })
 *
 * @example
 * // 拖到最底部
 * await sortCollectionAssets({ collectionId: 1, assetId: 123, prevAssetId: 100, nextAssetId: null })
 */
export function sortCollectionAssets(params: SortCollectionAssetsParams) {
  return httpPost('/assetsCollection/sortAssets', params)
}

/**
 * 批量删除素材请求参数
 */
export interface DeleteBatchAssetsParams {
  /** 素材ID列表 */
  assetIds: (number | string)[]
}

/**
 * 批量删除素材
 * POST /assets/deleteBatch
 *
 * @param params - 请求参数
 * @param params.assetIds - 素材ID列表（必填）
 *
 * @example
 * await deleteBatchAssets({ assetIds: [1, 2, 3] })
 */
export function deleteBatchAssets(params: DeleteBatchAssetsParams) {
  return httpPost('/assets/deleteBatch', params)
}

/**
 * 批量移除合集中的素材请求参数
 */
export interface RemoveAssetsFromCollectionParams {
  /** 合集ID */
  collectionId: number | string
  /** 素材ID列表 */
  assetIds: (number | string)[]
}

/**
 * 批量移除合集中的素材
 * POST /assetsCollection/removeAssets
 *
 * @param params - 请求参数
 * @param params.collectionId - 合集ID（必填）
 * @param params.assetIds - 素材ID列表（必填）
 *
 * @example
 * await removeAssetsFromCollection({ collectionId: 1, assetIds: [1, 2, 3] })
 */
export function removeAssetsFromCollection(params: RemoveAssetsFromCollectionParams) {
  return httpPost('/assetsCollection/removeAssets', params)
}

/**
 * 置顶合集中的素材请求参数
 */
export interface TopAssetParams {
  /** 合集ID */
  collectionId: number | string
  /** 素材ID列表 */
  assetIds: (number | string)[]
}

/**
 * 置顶合集中的素材（支持批量）
 * POST /assetsCollection/topAsset
 *
 * @param params - 请求参数
 * @param params.collectionId - 合集ID（必填）
 * @param params.assetIds - 素材ID列表（必填）
 *
 * @example
 * await topAsset({ collectionId: 1, assetIds: [1, 2, 3] })
 */
export function topAsset(params: TopAssetParams) {
  return httpPost('/assetsCollection/topAsset', params)
}

/**
 * 取消置顶合集中的素材请求参数
 */
export interface CancelTopAssetParams {
  /** 合集ID */
  collectionId: number | string
  /** 素材ID列表 */
  assetIds: (number | string)[]
}

/**
 * 取消置顶合集中的素材（支持批量）
 * POST /assetsCollection/cancelTopAsset
 *
 * @param params - 请求参数
 * @param params.collectionId - 合集ID（必填）
 * @param params.assetIds - 素材ID列表（必填）
 *
 * @example
 * await cancelTopAsset({ collectionId: 1, assetIds: [1, 2, 3] })
 */
export function cancelTopAsset(params: CancelTopAssetParams) {
  return httpPost('/assetsCollection/cancelTopAsset', params)
}

/**
 * 置底合集中的素材请求参数
 */
export interface BottomAssetParams {
  /** 合集ID */
  collectionId: number | string
  /** 素材ID列表 */
  assetIds: (number | string)[]
}

/**
 * 置底合集中的素材（支持批量）
 * POST /assetsCollection/bottomAsset
 *
 * @param params - 请求参数
 * @param params.collectionId - 合集ID（必填）
 * @param params.assetIds - 素材ID列表（必填）
 *
 * @example
 * await bottomAsset({ collectionId: 1, assetIds: [1, 2, 3] })
 */
export function bottomAsset(params: BottomAssetParams) {
  return httpPost('/assetsCollection/bottomAsset', params)
}

/**
 * 置顶我的素材请求参数
 */
export interface TopMyAssetParams {
  /** 素材ID列表 */
  assetIds: (number | string)[]
}

/**
 * 置顶我的素材（支持批量）
 * POST /assets/topAsset
 *
 * @param params - 请求参数
 * @param params.assetIds - 素材ID列表（必填）
 *
 * @example
 * await topMyAsset({ assetIds: [1, 2, 3] })
 */
export function topMyAsset(params: TopMyAssetParams) {
  return httpPost('/assets/topAsset', params)
}

/**
 * 取消置顶我的素材请求参数
 */
export interface CancelTopMyAssetParams {
  /** 素材ID列表 */
  assetIds: (number | string)[]
}

/**
 * 取消置顶我的素材（支持批量）
 * POST /assets/cancelTopAsset
 *
 * @param params - 请求参数
 * @param params.assetIds - 素材ID列表（必填）
 *
 * @example
 * await cancelTopMyAsset({ assetIds: [1, 2, 3] })
 */
export function cancelTopMyAsset(params: CancelTopMyAssetParams) {
  return httpPost('/assets/cancelTopAsset', params)
}

/**
 * 置底我的素材请求参数
 */
export interface BottomMyAssetParams {
  /** 素材ID列表 */
  assetIds: (number | string)[]
}

/**
 * 置底我的素材（支持批量）
 * POST /assets/bottomAsset
 *
 * @param params - 请求参数
 * @param params.assetIds - 素材ID列表（必填）
 *
 * @example
 * await bottomMyAsset({ assetIds: [1, 2, 3] })
 */
export function bottomMyAsset(params: BottomMyAssetParams) {
  return httpPost('/assets/bottomAsset', params)
}
