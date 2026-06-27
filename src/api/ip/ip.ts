/**
 * IP相关接口
 */
import type { CursorPageResult, CustomRequestOptions, TraditionalPageResult } from '@/http/types'
import { httpGet, httpPost } from '@/http/http'

/**
 * IP系列分页查询请求参数
 */
export interface GetIpSeriesPageParams {
  /** 页码 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
  /** 是否脱敏 */
  isDesensitize?: boolean
  /** 系列ID */
  seriesId?: number
  /** 系列名称 */
  seriesName?: string
}

/**
 * IP系列项
 */
export interface IpSeriesItem {
  /** 系列ID */
  id: string
  /** 系列编码 */
  code: string
  /** 系列名称 */
  name: string
  /** 系列描述 */
  description: string | null
  /** 封面图URL */
  coverImgUrl: string | null
  /** 标签名称 */
  tagNames: string | null
  /** 分类名称 */
  categoryNames: string | null
  /** 人气值 */
  popularityCount: number | null
  /** 人气值字符串表示 */
  popularityCountStr: string | null
  /** 互动量 */
  engageCount: number | null
  /** 互动量字符串表示 */
  engageCountStr: string | null
}

/**
 * 获取IP系列分页列表
 *
 * @param params - 请求参数
 * @param params.pageNum - 页码（可选）
 * @param params.pageSize - 每页条数（可选）
 * @param params.isDesensitize - 是否脱敏（可选）
 * @param params.seriesId - 系列ID（可选）
 * @param params.seriesName - 系列名称（可选）
 *
 * @example
 * // 基础调用
 * const list = await getIpSeriesPageForApp({ pageNum: 1, pageSize: 10 })
 *
 * @example
 * // 带搜索条件
 * const list = await getIpSeriesPageForApp({
 *   pageNum: 1,
 *   pageSize: 10,
 *   seriesName: 'Miminoo'
 * })
 */
export function getIpSeriesPageForApp(params: GetIpSeriesPageParams = {}) {
  return httpPost<TraditionalPageResult<IpSeriesItem>>('/coreIpSeries/getIpSeriesPageForApp', { ...params, enableAsset: 1 }, {})
}

/**
 * 获取已上架IP分页列表请求参数
 */
export interface GetOnShelfIpPageParams {
  /** 页码 */
  pageNum?: number
  /** 每页条数 */
  pageSize?: number
  /** IP系列ID（可选；为空则查询所有已上架系列下的IP） */
  seriesId?: number | string
  /** IP名称关键字（可选；模糊匹配） */
  ipName?: string
}

/**
 * 已上架IP项
 */
export interface OnShelfIpItem {
  /** IP ID */
  id: string
  /** IP名称 */
  name: string
  /** IP系列ID */
  seriesId: number | string
  /** IP系列名称 */
  seriesName: string | null
  /** IP头像 */
  avatarImgUrl: string | null
  /** IP形象主图URL；IP展示图 */
  mainImgUrl: string | null
  /** IP海报图 */
  desImgUrl: string | null
}

/**
 * 获取已上架IP分页列表
 *
 * @param params - 请求参数
 * @param params.pageNum - 页码（可选，默认1）
 * @param params.pageSize - 每页条数（可选，默认10）
 * @param params.seriesId - IP系列ID（可选；为空则查询所有已上架系列下的IP）
 * @param params.ipName - IP名称关键字（可选；模糊匹配）
 *
 * @example
 * // 基础调用
 * const list = await getOnShelfIpPage({ pageNum: 1, pageSize: 10 })
 *
 * @example
 * // 带系列ID和搜索条件
 * const list = await getOnShelfIpPage({
 *   pageNum: 1,
 *   pageSize: 10,
 *   seriesId: 123,
 *   ipName: 'Miminoo'
 * })
 */
export function getOnShelfIpPage(params: GetOnShelfIpPageParams = {}) {
  return httpPost<TraditionalPageResult<OnShelfIpItem>>('/coreIpSeries/getOnShelfIpPage', { ...params, enableAsset: 1 }, {})
}

/**
 * 根据系列ID获取IP列表请求参数
 */
export interface GetIpListBySeriesIdParams {
  /** 系列ID */
  seriesId: string
}

/**
 * IP项
 */
export interface IpItem {
  /** IP ID */
  id: string
  /** IP名称 */
  name: string
  /** IP描述 */
  description: string | null
  /** IP标语 */
  slogan: string | null
  /** IP简介展示图（详情海报图） */
  desImgUrl: string | null
  /** IP形象头像URL */
  avatarImgUrl: string | null
  /** IP形象主图URL（IP展示图） */
  mainImgUrl: string | null
  /** IP形象主图背景图URL（IP背景图） */
  mainImgBakUrl: string | null
  /** IP名称与slogan合并图 */
  nameSloganImgUrl: string | null
  /** 排序 */
  sort: number
}

/**
 * 根据系列ID获取IP列表
 *
 * @param params - 请求参数
 * @param params.seriesId - 系列ID（必填）
 *
 * @example
 * // 基础调用
 * const list = await getIpListBySeriesId({ seriesId: '1996841586886262785' })
 */
export function getIpListBySeriesId(params: GetIpListBySeriesIdParams) {
  return httpPost<IpItem[]>('/coreIpSeries/getIpListBySeriesId', params, {})
}

/**
 * 获取IP系列详情请求参数
 */
export interface GetIpSeriesDetailParams {
  /** 系列ID */
  seriesId: string
}

/**
 * IP简单信息
 */
export interface IpSimpleInfo {
  /** IP ID */
  id: string
  /** IP名称 */
  name: string
  /** IP描述 */
  description: string
  /** IP标语 */
  slogan: string
  /** IP简介展示图（详情海报图） */
  desImgUrl: string
  /** IP形象头像URL */
  avatarImgUrl: string
  /** IP形象主图URL（IP展示图） */
  mainImgUrl: string
  /** IP形象主图背景图URL（IP背景图） */
  mainImgBakUrl: string
  /** IP名称与slogan合并图 */
  nameSloganImgUrl: string
  /** 排序 */
  sort: number
}

/**
 * IP系列详情
 */
export interface IpSeriesDetail {
  /** 系列ID */
  id: string
  /** 系列名称 */
  name: string
  /** 分享外链URL */
  shareOutUrl: string
  /** 分享图片URL */
  shareImgUrl: string | null
  /** 系列描述 */
  description: string
  /** 顶部预览图URL */
  topPreImgUrl: string
  /** 顶部预览视频URL */
  topPreVideoUrl: string
  /** 顶部预览视频M3U8 URL */
  topPreVideoM3u8Url: string
  /** 顶部Banner图片URLs（逗号分隔） */
  topBannerImgUrls: string
  /** IP简单列表 */
  ipSimpleList: IpSimpleInfo[]
  /** 人气值 */
  popularityCount: number
  /** 互动量 */
  engageCount: number
  /** 人气值字符串 */
  popularityCountStr: string
  /** 互动量字符串 */
  engageCountStr: string
  /** 标签列表 */
  tags: string[]
  /** 分类列表 */
  categories: string[]
  /** 关联小说ID */
  toNovelId: string | null
  /** 关联漫画ID */
  toComicId: string | null
  /** 关联短剧ID */
  toDramaId: string | null
}

/**
 * 根据系列ID获取IP系列详情
 *
 * @param params - 请求参数
 * @param params.seriesId - 系列ID（必填）
 *
 * @example
 * // 基础调用
 * const detail = await getIpSeriesDetailById({ seriesId: '1996841586886262785' })
 */
export function getIpSeriesDetailById(
  params: GetIpSeriesDetailParams,
  options?: Partial<CustomRequestOptions>,
) {
  return httpGet<IpSeriesDetail>('/coreIpSeries/getIpSeriesDetailById', params, undefined, options)
}

/**
 * IP资源列表查询请求参数
 */
export interface ListIpAssetsParams {
  /** 搜索关键词 */
  keyword?: string
  /** 系列ID */
  seriesId?: string
  /** 上一页最后一条IP的主键ID（首次请求允许为空） */
  cursorId?: string
  /** 上一页最后一条IP的综合互动量（仅在按互动量排序时使用） */
  interactionScore?: number | string
  /** 每页条数 */
  pageSize?: number
  /** 查询方向：next-往后查，prev-往前查 */
  direction?: 'NEXT' | 'PREV'
}

/**
 * IP预览资源项
 */
export interface PreviewAssetItem {
  /** 资源ID */
  id: string
  /** 缩略图URL */
  thumbUrl: string
  /** 热度分数 */
  hotScore: number
  /** 分类 */
  category: string
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
  /** 创建时间 */
  createTime: string
}

/**
 * IP资源项
 */
export interface IpAssetItem {
  /** IP ID */
  id: string
  /** IP名称 */
  name: string
  /** IP头像图URL */
  avatarImgUrl: string | null
  /** IP简介展示图（详情海报图） */
  desImgUrl: string | null
  /** IP主图背景图URL */
  mainImgBakUrl: string | null
  /** IP主图URL */
  mainImgUrl: string | null
  /** 综合互动量 */
  totalInteraction: string
  /** 格式化后的综合互动量 */
  totalInteractionFormatted: string
  /** 总播放量 */
  popularity: string
  /** 格式化后的总播放量 */
  popularityStr: string
  /** 预览资源列表 */
  previewAssets: PreviewAssetItem[] | null
  /** 资源总数 */
  assetTotal: number | null
  /** 格式化后的资源总数 */
  assetTotalFormatted: string
}

/**
 * IP资源列表响应
 */
export interface ListIpAssetsResult {
  /** 数据列表 */
  records: IpAssetItem[]
  /** 下一页游标ID */
  nextCursorId: string
  /** 下一页游标分数（综合互动量） */
  nextCursorScore: string
  /** 是否有下一页 */
  hasNext: boolean
  /** 上一页游标ID */
  prevCursorId: string
  /** 上一页游标分数（综合互动量） */
  prevCursorScore: string
  /** 是否有上一页 */
  hasPrev: boolean
  /** 每页条数 */
  pageSize: number
  /** 总条数 */
  total: number | null
}

/**
 * 获取IP资源列表
 *
 * @param params - 请求参数
 * @param params.keyword - 搜索关键词（可选）
 * @param params.seriesId - 系列ID（可选）
 * @param params.cursorId - 上一页最后一条IP的主键ID（可选，首次请求为空）
 * @param params.interactionScore - 上一页最后一条IP的综合互动量（可选）
 * @param params.pageSize - 每页条数（可选）
 *
 * @example
 * // 基础调用
 * const list = await getIps({ pageSize: 10 })
 *
 * @example
 * // 带搜索条件
 * const list = await getIps({ keyword: 'IP名称', pageSize: 10 })
 *
 * @example
 * // 按系列查询
 * const list = await getIps({ seriesId: '1996841586886262785', pageSize: 10 })
 */
export function getIps(
  params: ListIpAssetsParams = {},
  options?: Partial<CustomRequestOptions>,
) {
  return httpPost<ListIpAssetsResult>('/assets/ipAssets/listIp', params, {}, undefined, options)
}

/**
 * 根据IP获取素材列表请求参数
 */
export interface ListAssetByIpParams {
  /** 每页条数（必填） */
  pageSize: number
  /** 分类ID（可选） */
  category?: number
  /** 文件类型ID/二级分类 1-图片、2-GIF、3-视频 （可选） */
  fileType?: number
  /** 排序类型：1热门、2最新（可选） */
  sortType?: 1 | 2
  /** 上一组数据最后一条的游标ID（可选） */
  cursorId?: number
  /** 上一组数据最后一条的游标分数（可选） */
  hotScore?: number
  /** IP ID（必填） */
  ipId: string
  /** 查询方向：next-往后查，prev-往前查 */
  direction?: 'NEXT' | 'PREV'
}

/**
 * 根据IP获取素材列表项
 */
export interface ListAssetByIpItem {
  /** 素材ID */
  id: string
  /** 缩略图URL */
  thumbUrl: string
  /** 静态缩略图URL */
  staticThumbUrl: string | null
  /** 分类 */
  category: number
  /** 文件类型 */
  fileType: number
  /** 分类名称 */
  categoryName: string
  /** 热度分数 */
  hotScore: number
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
  /** 创建时间 */
  createTime: string
}

/**
 * 根据IP获取素材列表
 *
 * @param params - 请求参数
 * @param params.pageSize - 每页条数（必填）
 * @param params.category - 分类ID（可选）
 * @param params.fileType - 文件类型ID/二级分类 1-图片、2-GIF、3-视频 （可选）
 * @param params.sortType - 排序类型：1热门、2最新（可选）
 * @param params.cursorId - 上一组数据最后一条的游标ID（可选）
 * @param params.hotScore - 上一组数据最后一条的游标分数（可选）
 * @param params.ipId - IP ID（必填）
 *
 * @example
 * // 基础调用
 * const list = await listAssetByIp({ pageSize: 10, ipId: '1996841586886262785' })
 *
 * @example
 * // 带分类和排序
 * const list = await listAssetByIp({
 *   pageSize: 10,
 *   fileType: 1,
 *   ipId: '1996841586886262785',
 *   category: 1,
 *   sortType: 1
 * })
 */
export function listAssetByIp<T = ListAssetByIpItem>(params: ListAssetByIpParams) {
  return httpPost<CursorPageResult<T>>('/assets/ipAssets/listAssetByIp', params, {})
}

/**
 * 合集素材列表查询请求参数
 */
export interface GetCollectionAssetsParams {
  /** 合集ID */
  collectionId: string
  /** 游标ID（上一页最后一条记录的ID） */
  cursorId?: string | number
  /** 分类ID（可选） */
  category?: number
  /** 文件类型ID/二级分类 1-图片、2-GIF、3-视频 （可选） */
  fileType?: number
  /** 游标置顶标识 */
  cursorIsTop?: number
  /** 游标排序值 */
  cursorSort?: number
  /** 每页数量（默认20） */
  pageSize?: number
  /** 查询方向：next-往后查，prev-往前查 */
  direction?: 'NEXT' | 'PREV'
}

/**
 * 合集素材项
 */
export interface CollectionAssetItem {
  /** 素材ID */
  id: string
  /** 合集素材关联表ID */
  relationId: string
  /** 缩略图URL */
  thumbUrl: string
  /** 静态缩略图URL */
  staticThumbUrl: string
  /** 热度分数 */
  hotScore: number
  /** 文件类型 */
  fileType: number
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
 * 合集素材列表响应
 */
export interface CollectionAssetsResult {
  /** 数据列表 */
  records: CollectionAssetItem[]
  /** 下一页游标ID */
  nextCursorId: string
  /** 下一页游标分数（通用维度，如hotScore、时间戳等） */
  nextCursorScore: number
  /** 是否有下一页 */
  hasNext: boolean
  /** 上一页游标ID（当前页第一条记录的ID），往前翻页时有效 */
  prevCursorId: string
  /** 上一页游标分数（当前页第一条记录的分数），往前翻页时有效 */
  prevCursorScore: number
  /** 上一页游标置顶标识（当前页第一条记录的isTop），往前翻页时有效 */
  prevCursorIsTop: number
  /** 上一页游标排序值（当前页第一条记录的sort），往前翻页时有效 */
  prevCursorSort: number
  /** 是否有上一页 */
  hasPrev: boolean
  /** 每页条数 */
  pageSize: number
  /** 总数（可选，游标分页通常不统计总数） */
  total: number
  /** 下一页游标置顶标识（当前页最后一条记录的isTop） */
  nextCursorIsTop: number
  /** 下一页游标排序值（当前页最后一条记录的sort） */
  nextCursorSort: number
  /** 关联素材总数 */
  assetCount: number
  /** 格式化后的关联素材总数 */
  assetCountFormatted: string
}

/**
 * 获取合集素材列表
 *
 * @param params - 请求参数
 * @param params.collectionId - 合集ID（必填）
 * @param params.cursorId - 游标ID（可选）
 * @param params.cursorIsTop - 游标置顶标识（可选）
 * @param params.cursorSort - 游标排序值（可选）
 * @param params.pageSize - 每页数量（可选，默认20）
 *
 * @example
 * // 基础调用
 * const list = await getCollectionAssets({ collectionId: '123456' })
 *
 * @example
 * // 带游标分页
 * const list = await getCollectionAssets({
 *   collectionId: '123456',
 *   cursorId: '789',
 *   cursorIsTop: 1,
 *   cursorSort: 100,
 *   pageSize: 20
 * })
 */
export function getCollectionAssets(params: GetCollectionAssetsParams) {
  return httpPost<CollectionAssetsResult>('/assetsCollection/assetsByCursor', params)
}

/**
 * 检查收藏状态请求参数
 */
export interface CheckCollectParams {
  /** 收藏对象类型  5--系列   8--素材 */
  entityType: number
  /** 收藏对象ID（IP ID或IP系列ID） */
  entityId: string
}

/**
 * 检查收藏状态响应
 */
export interface CheckCollectResult {
  /** 是否已收藏 */
  isCollected: boolean
  /** 收藏主键 */
  id: number
}

/**
 * 检查收藏状态
 * POST /collect/checkCollect
 *
 * @param params - 请求参数
 * @param params.entityType - 收藏对象类型（必填）
 * @param params.entityId - 收藏对象ID（必填）
 *
 * @example
 * const result = await checkCollect({ entityType: 1, entityId: 123 })
 */
export function checkCollect(
  params: CheckCollectParams,
  options?: Partial<CustomRequestOptions>,
) {
  return httpPost<CheckCollectResult>('/collect/checkCollect', params, undefined, undefined, options)
}

/**
 * 添加收藏请求参数
 */
export interface AddCollectParams {
  /** 收藏对象类型  5--系列   8--素材 */
  entityType: number
  /** 收藏对象ID（IP ID或IP系列ID） */
  entityId: string
}

/**
 * 添加收藏
 * POST /collect/addCollect
 *
 * @param params - 请求参数
 * @param params.entityType - 收藏对象类型（必填）
 * @param params.entityId - 收藏对象ID（必填）
 *
 * @example
 * const result = await addCollect({ entityType: 1, entityId: 123 })
 */
export function addCollect(params: AddCollectParams) {
  return httpPost('/collect/addCollect', params)
}

/**
 * 取消收藏请求参数
 */
export interface CancelCollectParams {
  /** 收藏数据id */
  collectId: number
}

/**
 * 取消收藏
 * GET /collect/cancelCollect
 *
 * @param params - 请求参数
 * @param params.collectId - 收藏数据id（必填）
 *
 * @example
 * await cancelCollect({ collectId: 123 })
 */
export function cancelCollect(params: CancelCollectParams) {
  return httpGet('/collect/cancelCollect', params)
}
