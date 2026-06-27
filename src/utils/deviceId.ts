/**
 * 设备 ID 管理工具
 * 支持小程序、APP、H5 多端获取设备唯一标识
 */

const STORAGE_KEY = 'device_unique_id'

/**
 * 获取设备唯一ID
 * - 小程序/APP：优先使用系统设备ID
 * - H5：生成并缓存UUID
 * @returns 设备唯一标识
 */
export function getDeviceId(): string {
  // #ifdef MP-WEIXIN || MP-ALIPAY || MP-BAIDU || MP-TOUTIAO || MP-QQ
  // 小程序端：获取系统设备ID
  return getSystemDeviceId()
  // #endif

  // #ifdef APP-PLUS
  // APP端：获取系统设备ID
  return getSystemDeviceId()
  // #endif

  // #ifdef H5
  // H5端：生成并缓存UUID
  return getH5DeviceId()
  // #endif

  // 默认降级方案
  return getH5DeviceId()
}

/**
 * 获取系统设备ID（小程序/APP）
 */
function getSystemDeviceId(): string {
  try {
    let deviceId: string | undefined
    let deviceInfo: UniApp.GetDeviceInfoResult | undefined

    // #ifdef MP-WEIXIN || MP-ALIPAY
    // 微信/支付宝小程序使用新的 device API
    deviceInfo = uni.getDeviceInfo()
    deviceId = deviceInfo.deviceId
    // #endif

    // #ifndef MP-WEIXIN || MP-ALIPAY
    // 其他平台使用旧 API
    const systemInfo = uni.getSystemInfoSync() as any
    deviceId = systemInfo.deviceId || systemInfo.uuid
    deviceInfo = systemInfo
    // #endif

    // 优先使用 deviceId
    if (deviceId) {
      return deviceId
    }

    // 再降级使用组合标识
    const combinedInfo = [
      deviceInfo?.platform || '',
      deviceInfo?.system || '',
      deviceInfo?.model || '',
      deviceInfo?.brand || '',
    ].filter(Boolean).join('_')

    if (combinedInfo) {
      // 使用组合信息生成哈希作为设备ID
      return generateHashId(combinedInfo)
    }

    // 最终降级到H5方案
    return getH5DeviceId()
  }
  catch (error) {
    console.error('获取系统设备ID失败:', error)
    return getH5DeviceId()
  }
}

/**
 * H5端获取或生成设备ID
 */
function getH5DeviceId(): string {
  // 尝试从localStorage获取已存在的设备ID
  let deviceId = uni.getStorageSync(STORAGE_KEY)
  
  if (deviceId) {
    return deviceId
  }
  
  // 生成新的设备ID (使用标准UUID)
  deviceId = generateDeviceId()
  
  // 保存到本地存储
  uni.setStorageSync(STORAGE_KEY, deviceId)
  
  return deviceId
}

/**
 * 生成 UUID v4（会话 ID 等场景复用）
 * 优先使用 crypto.randomUUID()，降级到 Math.random()
 */
export function generateUuid(): string {
  return generateDeviceId()
}

/**
 * 生成设备UUID
 * 优先使用crypto.randomUUID()，降级到 Math.random()
 */
function generateDeviceId(): string {
  // #ifdef H5
  // H5端优先使用crypto.randomUUID() (标准UUID v4)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // #endif
  
  // 降级方案：使用Math.random()生成UUID v4格式
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * 简单哈希函数，将字符串转换为固定长度的标识
 */
function generateHashId(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  
  // 转换为16进制并补齐长度
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0')
  
  // 生成UUID格式的设备ID
  const timestamp = Date.now().toString(16).padStart(12, '0')
  const random = Math.random().toString(16).substring(2, 10)
  
  return `${hexHash}-${timestamp.substring(0, 4)}-4${timestamp.substring(4, 7)}-${random.substring(0, 4)}-${random.substring(4, 8)}${hexHash.substring(0, 4)}`
}
