// 认证模式类型
export type AuthMode = 'single' | 'double'

// 单Token响应类型
export interface ISingleTokenRes {
  token: string
  expiresIn: number // 有效期(秒)
}

// 双Token响应类型
export interface IDoubleTokenRes {
  accessToken: string
  refreshToken: string
  accessExpiresIn: number // 访问令牌有效期(秒)
  refreshExpiresIn: number // 刷新令牌有效期(秒)
}

/**
 * 登录返回的信息，其实就是 token 信息
 */
export type IAuthLoginRes = IDoubleTokenRes

/**
 * 用户设置
 */
export interface IUserSetting {
  genderPublic: boolean // 性别公开
  birthdayPublic: boolean // 生日公开
  showAge: boolean // 显示年龄
  showZodiac: boolean // 显示生肖
  showConstellation: boolean // 显示星座
}

/**
 * 用户信息
 */
export interface IUserInfoRes {
  id: number
  phone: string // 用户手机号
  nickname: string // 用户名称
  avatar: string // 用户头像
  bio?: string // 个人简介
  gender: number // 性别: 0-保密;1-男;2-女
  birthday?: string // 出生日期
  age?: number // 年龄，基于出生日期计算
  zodiac?: string // 生肖
  constellation?: string // 星座
  uniqueCode: string // 邀请码
  level: number // 会员等级 1-普通用户; 2-认证作者; 3-签约创作者; 4-官方账号
  type: number // 会员类型: 1-个人; 2-个体工商户; 3-企业
  realName?: string // 真实姓名
  idCard?: string // 身份证号码
  idCardBackImg?: string // 身份证反面照片URL
  idCardFrontImg?: string // 身份证正面照片URL
  wechatOpenId?: string // 微信open_id
  wechatBindStatus: number // 微信绑定状态: 1-已绑定; 0-未绑定
  wechatNickname?: string // 微信昵称
  wechatAvatar?: string // 微信头像URL
  createTime: string // 创建时间
  isRealName: number // 是否已经实名 1-已实名；0-未实名
  status: number // 账号状态: 1-正常(默认); 2-禁用; 3-注销
  setting?: IUserSetting // 用户设置
  seriesId: string // 官方账号-IP系列ID
  backgroundUrl?: string // 官方账号-个人主页背景图片URL
  bannerUrl?: string // 官方账号-IP系列横幅图片URL
  seriesName?: string // 官方账号-IP系列名称
  canUpdateNickname: boolean
  canUpdateUniqueCode: boolean
  nextNicknameUpdateTime: string | null
}

// 认证存储数据结构
export interface AuthStorage {
  mode: AuthMode
  tokens: ISingleTokenRes | IDoubleTokenRes
  userInfo?: IUserInfoRes
  loginTime: number // 登录时间戳
}

/**
 * 获取验证码
 */
export interface ICaptcha {
  captchaEnabled: boolean
  uuid: string
  image: string
}
/**
 * 上传成功的信息
 */
export interface IUploadSuccessInfo {
  fileId: number
  originalName: string
  fileName: string
  storagePath: string
  fileHash: string
  fileType: string
  fileBusinessType: string
  fileSize: number
}
/**
 * 更新用户信息
 */
export interface IUpdateInfo {
  nickname?: string
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
  }
}
/**
 * 更新用户密码
 */
export interface IUpdatePassword {
  id: number
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

/**
 * 刷新 token 响应
 */
export interface IRefreshTokenRes {
  accessToken: string // 新的访问令牌
  expiresIn: number // 访问令牌剩余有效期（单位: 秒）
}

/**
 * 判断是否为双Token响应
 * @param tokenRes 登录响应数据
 * @returns 是否为双Token响应
 */
export function isDoubleTokenRes(tokenRes: IAuthLoginRes): tokenRes is IDoubleTokenRes {
  return 'accessToken' in tokenRes && 'refreshToken' in tokenRes
}
