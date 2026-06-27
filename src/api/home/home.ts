/**
 * 首页相关接口
 */
import type { CursorPageResult } from '@/http/types'
import { httpPost } from '@/http/http'

/**
 * 首页Banner项
 */
export interface HomeBannerItem {
  seriesId: string
  miniProBannerImgUrl: string
}

/**
 * 推荐素材项
 */
export interface RecommendItem {
  id: string
  thumbUrl: string
  staticThumbUrl: string
  fileType: number
  category: number
  categoryName: string
  hotScore: number
  likeCount: number
  likeCountFormatted: string
  downloadCount: number
  downloadCountFormatted: string
  isTop: number
  createTime: string
}

/**
 * 推荐列表请求参数
 */
export interface RecommendListParams {
  pageSize: number
  category?: number
  fileType?: number
  sortType?: 'hot' | 'latest'
  id?: number
  hotScore?: number
}

/**
 * 获取首页Banner图数据
 *
 * @description POST 请求用于查询数据，无需参数
 *              HTTP 拦截器会自动处理响应，直接返回 result 字段
 *
 * @example
 * // 基础调用
 * const banners = await getOnShelfSeriesBanners()
 * // banners 类型为 HomeBannerItem[]
 * banners.forEach(item => {
 *   console.log(item.seriesId, item.miniProBannerImgUrl)
 * })
 *
 * @example
 * // 配合类型使用
 * const banners = await getOnShelfSeriesBanners<HomeBannerItem>()
 * console.log(banners[0]?.seriesId)
 */
export function getOnShelfSeriesBanners<T = HomeBannerItem>() {
  return httpPost<T[]>('/coreIpSeries/getOnShelfSeriesBanners', {}, {}, { 'Content-Type': 'application/x-www-form-urlencoded' })
}

/**
 * 获取推荐素材列表
 *
 * @param params - 请求参数
 * @param params.pageSize - 每页条数（必填）
 * @param params.category - 分类ID（可省略）
 * @param params.fileType - 文件类型ID/二级分类 1-图片、2-GIF、3-视频 （可省略）
 * @param params.sortType - 排序类型：hot热门、latest最新（可省略）
 * @param params.id - 上一组数据最后一条的游标ID（可省略）
 * @param params.hotScore - 上一组数据最后一条的游标分数（可省略）
 *
 * @example
 * // 基础调用
 * const list = await getRecommendList({ pageSize: 10 })
 *
 * @example
 * // 带分类和排序
 * const list = await getRecommendList({
 *   pageSize: 10,
 *   category: 1,
 *   sortType: 'hot'
 * })
 *
 * @example
 * // 配合类型使用
 * const list = await getRecommendList<RecommendItem>({ pageSize: 10 })
 * list.records.forEach(item => {
 *   console.log(item.thumbUrl, item.likeCountFormatted)
 * })
 */
export function getRecommendList<T = RecommendItem>(params: RecommendListParams) {
  return httpPost<CursorPageResult<T>>('/assets/recommendList', params, {})
}

/**
 * 搜索请求参数
 */
export interface SearchParams {
  /** 搜索关键词 */
  keyword: string
}

/**
 * 搜索结果项
 */
export interface SearchResult {
  /** 创作者ID */
  memberId: number
  /** Kanoo号 */
  uniqueCode: string
  /** 跳转页面类型：1-创作者主页，2-合集页面 */
  pageType: 1 | 2
  /** 合集ID（当pageType=2时返回） */
  collectionId?: number
  /** 合集名称（当pageType=2时返回） */
  collectionName?: string
}

/**
 * 搜索接口
 *
 * @param params - 请求参数
 * @param params.keyword - 搜索关键词（必填）
 *
 * @example
 * // 基础调用
 * const result = await search({ keyword: '关键词' })
 * console.log(result.memberId, result.pageType)
 *
 * @example
 * // 根据页面类型跳转
 * const result = await search({ keyword: '关键词' })
 * if (result.pageType === 1) {
 *   uni.navigateTo({ url: `/pages/creatorDetails/index?memberId=${result.memberId}` })
 * } else if (result.pageType === 2) {
 *   uni.navigateTo({ url: `/pages/ipCollectionDetails/index?id=${result.collectionId}` })
 * }
 */
export function homeSearch(params: SearchParams) {
  return httpPost<SearchResult>('/assets/search', params, {})
}
