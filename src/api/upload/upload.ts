import { http } from '@/http/http'

/**
 * OSS STS Token 响应数据
 */
export interface IStsTokenRes {
  // 访问密钥 ID
  accessKeyId: string
  // 访问密钥密钥
  accessKeySecret: string
  // 过期时间
  expiration: string
  // 安全令牌
  securityToken: string
  // OSS 主机地址
  host: string
  // OSS Bucket 名称
  bucket: string
  // OSS 区域
  region: string
  // 上传目录前缀（例如 comics/{memberId}/ 或 drama/{memberId}/）
  dir: string
  // PostObject 上传所需的 policy（Base64编码）
  policy: string
  // PostObject 上传所需的签名
  signature: string
  // OSS 回调配置（x-oss-callback，对应的 Base64 字符串）
  callback: string
}

/**
 * 获取 OSS STS Token
 * 用于文件上传的临时凭证
 * @returns OSS STS Token 信息
 */
export function getStsToken() {
  return http.get<IStsTokenRes>('/file/assets/stsToken')
}

/**
 * 文件预校验请求参数
 */
export interface IPreCheckReq {
  // OSS文件URL
  url: string
  // 分类：1-表情, 2-头像, 3-背景, 4-壁纸
  category: number
}

/**
 * 文件预校验响应数据
 */
export interface IPreCheckRes {
  // 校验通过后颁发的Token
  token: string
  // Token剩余有效期（单位：秒）
  expiresIn: number
  // 缩略图URL
  thumbUrl: string
}

/**
 * 文件预校验
 * 用户上传文件后立即调用此接口进行校验，校验通过后返回Token
 * @param params 预校验请求参数
 * @returns 预校验结果，包含Token和有效期
 */
export function preCheck(params: IPreCheckReq) {
  return http.post<IPreCheckRes>('/assets/preCheck', params)
}

/**
 * 素材发布请求参数
 */
export interface IPublishReq {
  // 关联IP ID
  ipId?: string
  // 素材预检返回的token列表
  tokens: string[]
}

/**
 * 发布素材作品
 * @param params 发布请求参数
 */
export function publish(params: IPublishReq) {
  return http.post('/assets/publish', params)
}

/**
 * 删除素材Token校验请求参数
 */
export interface IDeleteCheckTokensReq {
  // 素材预检返回的token列表
  tokens: string[]
}

/**
 * 删除素材Token校验
 * @param params 删除校验请求参数
 */
export function deleteCheckTokens(params: IDeleteCheckTokensReq) {
  return http.post('/assets/deleteCheckTokens', params)
}
