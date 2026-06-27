/**
 * 统一 API 响应格式
 */
export interface ApiResponse<T = any> {
  success: boolean
  message: string
  code: number
  result: T
  timestamp: number
}

/**
 * 在 uniapp 的 RequestOptions 和 IUniUploadFileOptions 基础上，添加自定义参数
 */
export type CustomRequestOptions = UniApp.RequestOptions & {
  query?: Record<string, any>
  /** 出错时是否隐藏错误提示 */
  hideErrorToast?: boolean
  /** 是否隐藏 loading 提示 */
  hideLoading?: boolean
} & IUniUploadFileOptions // 添加uni.uploadFile参数类型

/** 主要提供给 openapi-ts-request 生成的代码使用 */
export type CustomRequestOptions_ = Omit<CustomRequestOptions, 'url'>

export interface HttpRequestResult<T> {
  promise: Promise<T>
  requestTask: UniApp.RequestTask
}

// 兼容旧的响应格式
export type IResponse<T = any> = ApiResponse<T>

// 分页请求参数
export interface PageParams {
  // page: number
  pageSize: number
  [key: string]: any
}

// 分页响应数据
export interface PageResult<T> {
  records: T[]
  total: number
  nextCursorId?: number // 下一页游标ID（当前页最后一条记录的ID），如果为null表示没有更多数据
  nextCursorScore?: number // 下一页游标分数（当前页最后一条记录的分数），用于基于分数的游标分页
  hasNext: boolean // 是否还有下一页数据
  // page: number
  pageSize: number
}

/**
 * 首页分页响应数据（游标分页）
 * 适用于：推荐列表等首页相关接口
 */
export interface CursorPageResult<T> {
  /** 数据数组 */
  records: T[]
  /** 下一页游标ID（当前页最后一条记录的ID），如果为null表示没有更多数据 */
  nextCursorId: number | null
  /** 下一页游标分数（当前页最后一条记录的分数），用于基于分数的游标分页 */
  nextCursorScore: number | null
  /** 下一页游标置顶标识（当前页最后一条记录的isTop），用于基于isTop的游标分页 */
  nextCursorIsTop: number | null
  /** 是否还有下一页数据 */
  hasNext: boolean
  /** 每页大小 */
  pageSize: number
  /** 总数，可能为null */
  total: number | null
  /** 上一页游标ID（当前页第一条记录的ID），往前翻页时有效 */
  prevCursorId?: number | null
  /** 上一页游标分数（当前页第一条记录的分数），往前翻页时有效 */
  prevCursorScore?: number | null
  /** 上一页游标置顶标识（当前页第一条记录的isTop），往前翻页时有效 */
  prevCursorIsTop?: number | null
  /** 上一页游标排序值（当前页第一条记录的sort），往前翻页时有效 */
  prevCursorSort?: number | null
  /** 是否有上一页 */
  hasPrev?: boolean
  /** 关联素材总数 */
  assetCount: number
  /** 格式化后的关联素材总数 */
  assetCountFormatted: string
  /** 被隐藏总数 */
  hiddenTotal?: string
}

/**
 * 传统分页响应数据（页码分页）
 * 适用于：IP系列分页等传统分页接口
 */
export interface TraditionalPageResult<T> {
  /** 数据数组 */
  records: T[]
  /** 总数 */
  total: number
  /** 每页大小 */
  size: number
  /** 当前页码 */
  current: number
  /** 排序信息数组 */
  orders: Array<{
    column?: string
    asc?: boolean
  }>
  /** 是否优化计数SQL */
  optimizeCountSql: boolean
  /** 是否搜索计数 */
  searchCount: boolean
  /** 是否优化连接计数SQL */
  optimizeJoinOfCountSql: boolean
  /** 最大限制，可能为null */
  maxLimit: number | null
  /** 计数ID，可能为null */
  countId: string | null
  /** 总页数 */
  pages: number
}
