/**
 * api封装示例和使用示例
 */
import type { ApiResponse, PageParams, PageResult } from '@/http/types'
import { httpGet, httpPost } from '@/http/http'

/**
 * 用户信息
 */
export interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar: string
}

/**
 * IP系列列表项
 */
export interface SeriesItem {
  id: number
  bannerImg: string
  bannerName: string
  hotValue: number
  detailImgs: string[]
}

/**
 * 创建系列请求参数
 */
export interface CreateSeriesParams {
  bannerName: string
  bannerImg: string
  hotValue: number
  detailImgs: string[]
}

// ============================================================================
// GET 请求（用于查询）
// ============================================================================

/**
 * 获取IP系列列表（带 Query 查询参数）
 *
 * @description GET 请求用于查询数据，参数通过 query 传递
 *
 * @param params - 查询参数
 * @param params.page - 页码（必填）
 * @param params.pageSize - 每页条数（必填）
 * @param params.keyword - 搜索关键词（可省略）
 *
 * @example
 * // 基础调用：必填参数
 * const list = await getSeriesList({ page: 1, pageSize: 10 })
 * console.log(list)
 *
 * @example
 * // 完整调用：包含可选参数
 * const list = await getSeriesList({
 *   pageSize: 20,
 *   keyword: 'IP系列'
 * })
 *
 * @example
 * // 配合类型使用
 * const list = await getSeriesList<SeriesItem>({
 *   pageSize: 10
 * })
 * list.forEach(item => {
 *   console.log(item.bannerName)
 * })
 */
export function getSeriesList<T = SeriesItem>(params: PageParams & { keyword?: string }) {
  return httpGet<ApiResponse<PageResult<T>>>('/api/series/list', params)
}

/**
 * 获取单个IP系列详情（带 Path 参数）
 *
 * @param id - 系列ID
 *
 * @example
 * // 基础调用
 * const detail = await getSeriesDetail(1)
 *
 * @example
 * // 配合类型使用
 * const detail = await getSeriesDetail<SeriesItem>(1)
 * console.log(detail.bannerName)
 */
export function getSeriesDetail<T = SeriesItem>(id: number) {
  return httpGet<ApiResponse<T>>(`/api/series/detail/${id}`)
}

// ============================================================================
// POST 请求（用于增删改）
// ============================================================================

/**
 * 创建IP系列（POST + Body 参数）
 *
 * @description POST 请求用于新增数据，参数通过 data 传递（请求体）
 *
 * @param data - 请求体参数
 * @param data.bannerName - 系列名称（必填）
 * @param data.bannerImg - 封面图片（必填）
 * @param data.hotValue - 热度值（必填）
 * @param data.detailImgs - 详情图片列表（必填）
 *
 * @example
 * // 基础调用
 * const result = await createSeries({
 *   bannerName: '新系列',
 *   bannerImg: 'https://xxx.com/banner.jpg',
 *   hotValue: 1000,
 *   detailImgs: ['https://xxx.com/1.jpg']
 * })
 *
 * @example
 * // 配合类型使用
 * const result = await createSeries<SeriesItem>({
 *   bannerName: '新系列',
 *   bannerImg: 'https://xxx.com/banner.jpg',
 *   hotValue: 1000,
 *   detailImgs: []
 * })
 * console.log(result.id)
 */
export function createSeries<T = SeriesItem>(data: CreateSeriesParams) {
  return httpPost<ApiResponse<T>>('/api/series/create', data)
}

/**
 * 更新IP系列（POST + Body 参数 + Query 参数）
 *
 * @description POST 请求用于更新数据，同时传递 query 参数和 body 参数
 *
 * @param data - 请求体参数（必填）
 * @param query - URL 查询参数（必填，用于指定要更新的记录）
 *
 * @example
 * // 基础调用：必填参数
 * const result = await updateSeries(
 *   { bannerName: '更新后的名称', hotValue: 2000 },
 *   { id: 1 }
 * )
 *
 * @example
 * // 完整调用
 * const result = await updateSeries<SeriesItem>(
 *   {
 *     bannerName: '新名称',
 *     bannerImg: 'https://xxx.com/new.jpg',
 *     hotValue: 5000,
 *     detailImgs: []
 *   },
 *   { id: 1 }
 * )
 *
 * @example
 * // 配合类型使用
 * const result = await updateSeries<SeriesItem>(
 *   { hotValue: 9999 },
 *   { id: 1 }
 * )
 */
export function updateSeries<T = SeriesItem>(
  data: Partial<CreateSeriesParams>,
  query: { id: number },
) {
  return httpPost<ApiResponse<T>>('/api/series/update', data, query)
}

/**
 * 删除IP系列（POST + Query 参数）
 *
 * @description POST 请求用于删除数据，参数通过 query 传递
 *
 * @param query - 查询参数
 * @param query.id - 要删除的系列ID（必填）
 *
 * @example
 * // 基础调用
 * await deleteSeries({ id: 1 })
 *
 * @example
 * // 删除多条
 * await deleteSeries({ id: 1 })
 * await deleteSeries({ id: 2 })
 */
export function deleteSeries(query: { id: number }) {
  return httpPost<ApiResponse<void>>('/api/series/delete', {}, query)
}
