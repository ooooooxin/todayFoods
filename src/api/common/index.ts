/**
 * 公共接口
 */
import { httpGet, httpPost } from '@/http/http'
import { buildConsumptionSignature } from '@/utils/consumptionSignature'

/**
 * 素材分类枚举
 * 1-表情, 2-头像, 3-背景, 4-壁纸
 */
export enum AssetsCategory {
  /** 表情 */
  EMOJI = 1,
  /** 头像 */
  AVATAR = 2,
  /** 背景 */
  BACKGROUND = 3,
  /** 壁纸 */
  WALLPAPER = 4,
}

/**
 * 素材分类名称映射
 */
export const AssetsCategoryName: Record<AssetsCategory, string> = {
  [AssetsCategory.EMOJI]: '表情',
  [AssetsCategory.AVATAR]: '头像',
  [AssetsCategory.BACKGROUND]: '背景',
  [AssetsCategory.WALLPAPER]: '壁纸',
}

/**
 * 根据分类值获取分类名称
 * @param category 分类值
 * @returns 分类名称
 */
export function getCategoryName(category: number | undefined): string {
  if (category === undefined || category === null)
    return ''
  return AssetsCategoryName[category as AssetsCategory] || ''
}

/**
 * 资源标签项
 */
export interface AssetsTabItem {
  /** 标签ID */
  id: string
  /** 标签名称 */
  name: string
}

/**
 * 系统配置信息 (4115 /config/get)
 */
export interface SystemConfig {
  privacyPolicyUrl: string
  userAgreementUrl: string
  minorsPersonalInfoProtectionUrl: string
  creationWebUrl: string
  customerServicePhone: string
  customerServiceEmail: string
  officialWebsite: string
  /** 创作者服务协议URL */
  creatorServiceAgreementUrl: string
}

/**
 * 获取资源标签列表
 */
export function getAssetsTabs() {
  return httpGet<AssetsTabItem[]>('/config/assetsTabs', {})
}

/**
 * 获取系统配置信息 (APP & Web通用)
 *
 * @description GET /config/get
 * 返回隐私协议、用户协议、客服电话等配置信息
 */
export function getSystemConfig() {
  return httpGet<SystemConfig>('/config/get', {})
}

/**
 * IP信息
 */
export interface IpInfo {
  /** IP id */
  id: number
  /** IP名称 */
  name: string
}

/**
 * 创作者信息
 */
export interface CreatorInfo {
  /** 创作者id */
  id: number
  /** 昵称 */
  nickname: string
  /** 头像 */
  avatar: string
  /** 当前登录用户是否已关注该作者：true-已关注, false-未关注 */
  followed: boolean
}

/**
 * 素材详情
 */
export interface AssetsDetail {
  /** 作品素材id */
  assetsId: number | string
  /** 版权类型: 0-无, 1-原创, 2-二创 */
  copyrightType: number
  /** 分类：1-表情, 2-头像, 3-背景, 4-壁纸 */
  category: number
  /** 格式：1-静态图, 2-动态图, 3-视频 */
  fileType: number
  /** 分享图 */
  shareUrl: string
  /** 预览链接 */
  previewUrl: string
  /** 总点赞数 */
  likeCount: number
  /** 总收藏数 */
  favoriteCount: number
  /** 总下载数 */
  downloadCount: number
  /** 总分享数 */
  shareCount: number
  /** 格式化后的点赞数 */
  likeCountFormatted: string
  /** 格式化后的收藏数 */
  favoriteCountFormatted: string
  /** 格式化后的分享数 */
  shareCountFormatted: string
  /** 格式化后的下载数 */
  downloadCountFormatted: string
  /** 当前登录用户是否已点赞：true-已赞, false-未赞 */
  liked: boolean
  /** 当前登录用户是否已收藏：true-已收藏, false-未收藏 */
  favorited: boolean
  /** IP信息 */
  ip: IpInfo
  /** 创作者信息 */
  creator: CreatorInfo
}

/**
 * 获取素材详情请求参数
 */
export interface GetAssetsDetailParams {
  /** 作品素材id */
  assetsId: number | string
}

/**
 * 获取素材详情
 *
 * @param params - 请求参数
 * @param params.assetsId - 作品素材id
 *
 * @example
 * // 基础调用
 * const detail = await getAssetsDetail({ assetsId: 123456 })
 */
export function getAssetsDetail(params: GetAssetsDetailParams) {
  return httpGet<AssetsDetail>(`/assets/public/detail`, { ...params, saveHistory: false })
}

/**
 * 我的素材详情
 */
export interface MyAssetsDetail {
  /** 作品素材id */
  assetsId: number | string
  /** 分类：1-表情, 2-头像, 3-背景, 4-壁纸 */
  category: number
  /** 格式：1-静态图, 2-动态图, 3-视频 */
  fileType: number
  /** 预览链接 */
  previewUrl: string
  /** 总点赞数 */
  likeCount: number
  /** 总收藏数 */
  favoriteCount: number
  /** 总下载数 */
  downloadCount: number
  /** 总分享数 */
  shareCount: number
  /** 格式化后的点赞数 */
  likeCountFormatted: string
  /** 格式化后的收藏数 */
  favoriteCountFormatted: string
  /** 格式化后的分享数 */
  shareCountFormatted: string
  /** 格式化后的下载数 */
  downloadCountFormatted: string
  /** 是否置顶 */
  top: boolean
  /** 审核状态: 0-审核中, 1-审核通过, 2-审核拒绝 */
  auditStatus: number
  /** 审核状态名称 */
  auditStatusName: string
  /** 审核驳回原因 */
  rejectReason: string
  /** 上下架状态：0-上架, 1-下架 */
  saleStatus: number
  /** 下架原因 */
  saleDownReason: string
}

/**
 * 获取我的素材详情请求参数
 */
export interface GetMyAssetsDetailParams {
  /** 作品素材id */
  assetsId: number | string
  /** 合集ID */
  collectionId?: string
}

/**
 * 获取我的素材详情
 *
 * @param params - 请求参数
 * @param params.assetsId - 作品素材id
 *
 * @example
 * // 基础调用
 * const detail = await getMyAssetsDetail({ assetsId: 123456 })
 */
export function getMyAssetsDetail(params: GetMyAssetsDetailParams) {
  return httpGet<MyAssetsDetail>(`/assets/my/detail`, params)
}

/*
 * 修改用户信息 (2163)
 * POST /me/update
 */
export interface UpdateUserInfoParams {
  nickname?: string
  uniqueCode?: string
  avatar?: string
  bio?: string
  gender?: {
    value: number
    showPublic: boolean
  }
  birthday?: {
    value: string
    showPublic: boolean
    showAge: boolean
    showZodiac: boolean
    showConstellation: boolean
  }
}

export function updateUserInfo(params: UpdateUserInfoParams) {
  return httpPost<null>('/me/update', params)
}

/**
 * 关注/取消关注请求参数
 */
export interface FollowOperateParams {
  /** 目标用户ID（被关注者），必须 */
  followedMemberId: number
  /** 操作类型：1-关注，0-取消关注，必须 */
  followAction: number
}

/**
 * 关注/取消关注
 * POST /follow/operate
 */
export function followOperate(params: FollowOperateParams) {
  return httpPost('/follow/operate', params)
}

/**
 * 点赞/取消点赞请求参数
 */
export interface AssetsLikeParams {
  /** 作品素材id，必须 */
  assetsId: number | string
  /** 操作类型：1-点赞，0-取消点赞，必须 */
  action: number
}

/**
 * 点赞/取消点赞
 * POST /assets/like
 */
export function assetsLike(params: AssetsLikeParams) {
  return httpPost('/assets/like', params)
}

/**
 * 收藏/取消收藏请求参数
 */
export interface AssetsFavoriteParams {
  /** 作品素材id，必须 */
  assetsId: number | string
  /** 操作类型：1-收藏，0-取消收藏，必须 */
  action: number
}

/**
 * 收藏/取消收藏
 * POST /assets/favorite
 */
export function assetsFavorite(params: AssetsFavoriteParams) {
  return httpPost('/assets/favorite', params)
}

/**
 * 下载请求参数
 */
export interface AssetsDownloadParams {
  /** 作品素材id，必须 */
  assetsId: number | string
}

/**
 * 下载响应数据
 */
export interface AssetsDownloadResult {
  /** 下载链接 */
  url: string
  /** 下载凭证（确认下载时需携带） */
  token: string
}

/**
 * 下载
 * GET /assets/downloadUrl
 */
export function assetsDownload(params: AssetsDownloadParams) {
  return httpGet<AssetsDownloadResult>('/assets/downloadUrl', params)
}

/**
 * 下载确认请求参数
 */
export interface AssetsDownloadConfirmParams {
  /** 作品素材id，必须 */
  assetsId: number | string
  /** 下载凭证（确认下载时需携带） */
  token: string
}

/**
 * 下载确认
 * GET /assets/downloadConfirm
 */
export function assetsDownloadConfirm(params: AssetsDownloadConfirmParams) {
  return httpGet('/assets/downloadConfirm', params)
}

/**
 * 分享请求参数
 */
export interface AssetsShareParams {
  /** 作品素材id，必须 */
  assetsId: number | string
}

/**
 * 分享
 * POST /assets/share
 */
export function assetsShare(params: AssetsShareParams) {
  return httpPost('/assets/share', params)
}

/**
 * 关注关系查询请求参数
 */
export interface FollowRelationParams {
  /** 目标用户ID（被关注者），必须 */
  followedMemberId: number | string
}

/**
 * 关注关系查询响应数据
 */
export interface FollowRelationResult {
  /** 是否已关注 */
  isFollowed: boolean
  /** 是否互相关注 */
  isMutual: boolean
}

/**
 * 关注关系查询
 * GET /follow/relation
 */
export function getFollowRelation(params: FollowRelationParams) {
  return httpGet<FollowRelationResult>('/follow/relation', params)
}

/**
 * 保存浏览记录请求参数
 */
export interface SaveBrowsingHistoryParams {
  /** 作品素材id，必须 */
  entityType: number
  entityId: number | string
}

/**
 * 保存浏览记录
 * POST /browsing-history/save
 */
export function saveBrowsingHistory(params: SaveBrowsingHistoryParams) {
  return httpPost('/browsing-history/save', params)
}

/**
 * 数据上报请求参数
 */
export interface StatsActionParams {
  /** 实体类型 IP_SERIES | IP */
  entityType: string
  /** 内容ID */
  contentId: number | string
  /** 操作类型 VIEW | SHARE */
  actionType: string
}

/**
 * 数据上报（弃用，改用consumptionReport）
 * POST /stats/action
 */
export function statsAction(params: StatsActionParams) {
  return httpPost('/stats/action', params)
}

/**
 * 检查IP是否上架请求参数
 */
export interface CheckIpOnShelfParams {
  /** IP系列ID */
  ipId: number | string
}

/**
 * 检查IP是否上架
 * GET /coreIpSeries/checkIpOnShelf
 * @description code = 4005 时，该IP暂不可访问
 */
export function checkIpOnShelf(params: CheckIpOnShelfParams) {
  return httpGet('/coreIpSeries/checkIpOnShelf', params)
}

/**
 * 检查IP系列是否上架请求参数
 */
export interface CheckIpSeriesOnShelfParams {
  /** IP系列ID */
  seriesId: number | string
}

/**
 * 检查IP系列是否上架
 * GET /coreIpSeries/checkIpSeriesOnShelf
 * @description code = 4002 时，该IP系列暂不可访问
 */
export function checkSeriesOnShelf(params: CheckIpSeriesOnShelfParams) {
  return httpGet('/coreIpSeries/checkIpSeriesOnShelf', params)
}

/**
 * ==========================================
 * 上报消费行为 (7240)
 * POST /stats/consumption/report
 * ==========================================
 *
 * 【签名算法】
 * 1. 参与签名的参数（按字典序排列，共6个，不做URL encode）：
 *    contentId, entityType, event, nonce, sessionId, timestamp
 * 2. nonce 取值与 timestamp 相同（毫秒时间戳转成十进制字符串）
 * 3. 末尾追加密钥：key=SECRET_KEY（勿硬编码进客户端仓库）
 * 4. 拼接格式示例：
 *    contentId=123&entityType=ASSETS&event=SHORT_ENTER&nonce=1776930159643&sessionId=xxx&timestamp=1776930159643&key=SECRET_KEY
 * 5. 签名算法：SHA-256，输出小写64位十六进制字符串
 * 6. 将签名结果赋值给请求头 x-signature
 *
 * 【注意】
 * - sessionId 每次访问生成，要求全局唯一（建议使用 UUID）
 * - timestamp 必须在当前时间10分钟内有效
 * - 签名校验失败时接口仍返回成功，但业务不落库（防刷设计）
 */

/**
 * 消费行为-实体类型枚举
 */
export enum ConsumptionEntityType {
  /** 系列IP */
  IP_SERIES = 5,
  /** 素材 */
  ASSETS = 8,
}

/**
 * 消费行为-短内容事件枚举
 */
export enum ConsumptionEvent {
  /** 进入 */
  SHORT_ENTER = 'SHORT_ENTER',
  /** 停留3秒 */
  SHORT_STAY_3S = 'SHORT_STAY_3S',
  /** 停留10秒 */
  SHORT_STAY_10S = 'SHORT_STAY_10S',
  /** 完成 */
  SHORT_COMPLETE = 'SHORT_COMPLETE',
}

/**
 * 上报消费行为请求参数
 */
export interface ConsumptionReportParams {
  /** 实体类型 */
  entityType: ConsumptionEntityType
  /** 内容ID */
  contentId: number | string
  /** 会话ID（每次访问生成，全局唯一） */
  sessionId: string
  /** 消费事件 */
  event: ConsumptionEvent
  /** 毫秒时间戳（10分钟内有效） */
  timestamp: number
}

/**
 * 上报消费行为
 * POST /stats/consumption/report
 *
 * @description 支持匿名；签名校验失败或未带签名时接口仍返回成功，业务不落库（防刷设计）
 */
export function consumptionReport(params: ConsumptionReportParams) {
  const timestamp = params.timestamp ?? Date.now()
  const payload: ConsumptionReportParams = { ...params, timestamp }
  const signature = buildConsumptionSignature({
    contentId: payload.contentId,
    entityType: payload.entityType,
    event: payload.event,
    sessionId: payload.sessionId,
    timestamp: payload.timestamp,
  })

  const header: Record<string, string> = {}
  if (signature) {
    header['x-signature'] = signature
  }

  return httpPost(
    '/stats/consumption/report',
    payload,
    undefined,
    header,
    { hideLoading: true, hideErrorToast: true },
  )
}
