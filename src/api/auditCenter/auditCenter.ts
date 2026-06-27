/**
 * 审核中心相关接口
 */
import type { CursorPageResult } from '@/http/types'
import { httpPost } from '@/http/http'

/**
 * 审核列表项
 */
export interface AuditListItem {
  /** 资源id（作品主id，图片/视频，素材主表id,即：assets_id） */
  id: number
  /** 标题/文件名 */
  title: string
  /** 版权类型: 0-无, 1-原创, 2-二创 */
  copyrightType: number
  /** 分类：1-表情, 2-头像, 3-背景, 4-壁纸 */
  category: number
  /** 素材url */
  url: string
  /** 静态缩略图(动图转静态图，视频取第一帧) */
  thumbUrl: string
  /** 动态缩略图(视频转动图) */
  thumbDynamicUrl: string
  /** 素材预览url */
  previewUrl: string
  /** 作者id */
  authorId: number
  /** 资源类型：1图片（png,jpg,jpeg,除gif格式），2GIF图片，3视频 */
  resourceType: number
  /** 审核状态：0-审核中, 1-审核通过, 2-审核拒绝 */
  auditStatus: number
  /** 上下架状态：0上架，1下架 */
  saleStatus: number
  /** 下架原因 */
  saleDownReason: string
  /** 拒绝原因 */
  rejectReason: string
}

/**
 * 审核列表请求参数
 */
export interface AuditListParams {
  /** 状态: 0-审核中, 1-审核通过, 2-审核拒绝 */
  auditStatus?: number
  /** 上下架状态：0上架，1下架。默认查询上架的数据 */
  saleStatus?: number
  /** 游标ID（上一页最后一条记录的ID） */
  cursorId?: number | string
  /** 游标排序值（上一页最后一条记录的排序值） */
  cursorSort?: number
  /** 每页数量（默认20） */
  pageSize?: number
  /** 查询方向：next-往后查，prev-往前查 */
  direction?: 'NEXT' | 'PREV'
}

/**
 * 获取审核列表
 * POST /mobileResourceAudit/list
 *
 * @param params - 请求参数
 * @returns 审核列表分页数据
 *
 * @example
 * await getAuditList({ auditStatus: 0, pageSize: 20 })
 */
export function getAuditList(params: AuditListParams): Promise<CursorPageResult<AuditListItem>> {
  return httpPost('/mobileResourceAudit/list', params)
}

/**
 * 清空审核记录请求参数
 */
export interface ClearAuditRecordParams {
  /** 素材id集合 */
  ids: number[]
}

/**
 * 清空审核记录
 * POST /mobileResourceAudit/clearAuditRecordByIds
 *
 * @param params - 请求参数
 * @param params.ids - 素材id集合
 *
 * @example
 * await clearAuditRecordByIds({ ids: [1, 2, 3] })
 */
export function clearAuditRecordByIds(params: ClearAuditRecordParams) {
  return httpPost('/mobileResourceAudit/clearAuditRecordByIds', params)
}

/**
 * 审核统计响应数据
 */
export interface AuditStatisticsResult {
  /** 审核中数量 */
  auditingNum: number
  /** 已通过数量 */
  passAudited: number
  /** 拒绝数量 */
  rejectNum: number
}

/**
 * 获取审核统计
 * GET /mobileResourceAudit/statistics
 *
 * @returns 审核统计数据
 *
 * @example
 * await getAuditStatistics()
 */
export function getAuditStatistics(): Promise<AuditStatisticsResult> {
  return httpPost('/mobileResourceAudit/statistics')
}
