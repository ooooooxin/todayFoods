import type { MaterialItem } from '@/store/upload'

/**
 * 比例区间接口
 * 用于定义一个宽高比范围
 */
export interface AspectRatioRange {
  /** 宽高比最小值 */
  min: number
  /** 宽高比最大值 */
  max: number
}

/**
 * 校验规则接口定义
 * 用于描述每种作品类型的尺寸、比例、格式等限制
 */
export interface ValidationRule {
  /** 最小宽度（像素） */
  minWidth: number
  /** 最小高度（像素） */
  minHeight: number
  /** 最大宽度（像素） */
  maxWidth: number
  /** 最大高度（像素） */
  maxHeight: number
  /** 宽高比最小值（height/width），用于限制比例范围 */
  aspectRatioMin: number
  /** 宽高比最大值 */
  aspectRatioMax: number
  /** 多比例区间支持（用于同时支持竖屏和横屏） */
  aspectRatioRanges?: AspectRatioRange[]
  /** 允许的文件扩展名数组 */
  allowedTypes: string[]
  /** 文件大小上限（MB） */
  maxSizeMB: number
  /** 图片文件大小上限（MB），优先级高于 maxSizeMB */
  imageMaxSizeMB?: number
  /** 视频文件大小上限（MB），优先级高于 maxSizeMB */
  videoMaxSizeMB?: number
}

/**
 * 各作品类型的校验规则配置
 * type: 1-表情, 2-头像, 3-背景, 4-壁纸
 */
export const VALIDATION_RULES: Record<number, ValidationRule> = {
  /** 表情类型：支持 JPG/PNG/GIF/MP4/MOV，最小 256x256，最大 2048x2048，比例 1:1 左右 */
  1: {
    minWidth: 256,
    minHeight: 256,
    maxWidth: 2048,
    maxHeight: 2048,
    aspectRatioMin: 0.8,
    aspectRatioMax: 1.25,
    allowedTypes: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov'],
    maxSizeMB: 50,
    imageMaxSizeMB: 20,
    videoMaxSizeMB: 50,
  },
  /** 头像类型：仅支持 JPG/PNG，必须 1:1 正方形，最小 256x256，最大 2048x2048 */
  2: {
    minWidth: 256,
    minHeight: 256,
    maxWidth: 2048,
    maxHeight: 2048,
    aspectRatioMin: 1,
    aspectRatioMax: 1,
    allowedTypes: ['jpg', 'jpeg', 'png'],
    maxSizeMB: 20,
  },
  /** 背景类型：支持 JPG/PNG/MP4/MOV，最小 720x720，最大 4096x4096，支持竖屏(9:16)和横屏(16:9) */
  3: {
    minWidth: 720,
    minHeight: 720,
    maxWidth: 4096,
    maxHeight: 4096,
    aspectRatioMin: 0.45,
    aspectRatioMax: 2.2,
    aspectRatioRanges: [
      { min: 0.45, max: 0.7 }, // 竖屏 9:16 左右
      { min: 1.4, max: 2.2 }, // 横屏 16:9 左右
    ],
    allowedTypes: ['jpg', 'jpeg', 'png', 'mp4', 'mov'],
    maxSizeMB: 50,
    imageMaxSizeMB: 20,
    videoMaxSizeMB: 50,
  },
  /** 壁纸类型：支持 JPG/PNG/MP4/MOV，最小 1080x1080，最大 4096x4096，支持竖屏(9:16)和横屏(16:9) */
  4: {
    minWidth: 1080,
    minHeight: 1080,
    maxWidth: 4096,
    maxHeight: 4096,
    aspectRatioMin: 0.45,
    aspectRatioMax: 2.2,
    aspectRatioRanges: [
      { min: 0.45, max: 0.7 }, // 竖屏 9:16 左右
      { min: 1.4, max: 2.2 }, // 横屏 16:9 左右
    ],
    allowedTypes: ['jpg', 'jpeg', 'png', 'mp4', 'mov'],
    maxSizeMB: 50,
    imageMaxSizeMB: 20,
    videoMaxSizeMB: 50,
  },
}

/** 视频最大时长限制（单位：秒） */
export const VIDEO_MAX_DURATION = 20

/** 图片文件大小上限（MB） */
export const IMAGE_MAX_SIZE_MB = 20
/** GIF 文件大小上限（MB） */
export const GIF_MAX_SIZE_MB = 20
/** 视频文件大小上限（MB） */
export const VIDEO_MAX_SIZE_MB = 50

/**
 * 根据文件路径获取文件扩展名
 * @param filePath 文件路径，例如 "/path/to/image.jpg"
 * @returns 返回小写的扩展名，例如 "jpg"
 */
async function getFileExtensionAsync(filePath: string): Promise<string> {
  const pathExt = filePath.match(/\.([^.]+)$/)?.[1]?.toLowerCase() || ''
  const isVideo = ['mp4', 'mov'].includes(pathExt)

  if (isVideo) {
    return pathExt
  }

  try {
    const imageInfo = await uni.getImageInfo({ src: filePath })
    return imageInfo.type?.toLowerCase() || pathExt || 'jpg'
  }
  catch (err) {
    console.log('getFileExtensionAsync failed:', err)
    return pathExt || 'jpg'
  }
}

/**
 * 根据文件路径判断文件类型
 * @param filePath 文件路径
 * @returns 返回文件类型：'image'（普通图片）、'gif'（动图）、'video'（视频）或 'unknown'（未知）
 */
async function getFileTypeAsync(filePath: string): Promise<'image' | 'gif' | 'video' | 'unknown'> {
  const pathExt = filePath.match(/\.([^.]+)$/)?.[1]?.toLowerCase() || ''
  if (['mp4', 'mov'].includes(pathExt))
    return 'video'
  try {
    const imageInfo = await uni.getImageInfo({ src: filePath })
    const type = imageInfo.type?.toLowerCase()
    if (type === 'gif')
      return 'gif'
    if (['jpg', 'jpeg', 'png'].includes(type))
      return 'image'
    return 'unknown'
  }
  catch (err) {
    console.log('getFileTypeAsync failed:', err)
    return 'unknown'
  }
}

/**
 * 计算宽高比（宽度除以高度）
 * @param width 宽度（像素）
 * @param height 高度（像素）
 * @returns 返回宽高比（width/height）
 */
function getAspectRatio(width: number, height: number): number {
  return width / height
}

/**
 * 检查宽高比是否符合规则
 * 支持单一区间或多区间配置
 * @param aspectRatio 宽高比
 * @param rule 校验规则
 * @returns 是否符合要求
 */
function isAspectRatioValid(aspectRatio: number, rule: ValidationRule): boolean {
  // 如果配置了多区间，检查是否在任一区间内
  if (rule.aspectRatioRanges && rule.aspectRatioRanges.length > 0) {
    return rule.aspectRatioRanges.some(
      range => aspectRatio >= range.min && aspectRatio <= range.max,
    )
  }
  // 否则使用单一区间检查
  return aspectRatio >= rule.aspectRatioMin && aspectRatio <= rule.aspectRatioMax
}

/**
 * 格式化文件大小，将字节转换为人类可读字符串
 * @param sizeInBytes 文件大小（字节）
 * @returns 格式化后的字符串，例如 "2.50 MB" 或 "512.00 KB"
 */
export function formatFileSize(sizeInBytes: number): string {
  if (sizeInBytes === 0)
    return '0 B'
  const kb = sizeInBytes / 1024
  const mb = kb / 1024
  if (mb >= 1) {
    return `${mb.toFixed(2)} MB`
  }
  return `${kb.toFixed(2)} KB`
}

/**
 * 将文件大小（字节）转换为 MB
 * @param sizeInBytes 文件大小（字节）
 * @returns 大小（MB）
 */
function getFileSizeMB(sizeInBytes: number): number {
  return sizeInBytes / (1024 * 1024)
}

/**
 * 解析字符串格式的文件大小，转换为字节数
 * 支持格式：数字+单位，例如 "2.5 MB"、"500 KB"、"1 GB"
 * @param sizeStr 字符串格式的文件大小
 * @returns 字节数，如果解析失败返回 0
 */
function parseSizeString(sizeStr: string): number {
  const match = sizeStr.match(/^([\d.]+)\s*(KB|MB|GB)?$/i)
  if (!match)
    return 0

  const value = Number.parseFloat(match[1])
  const unit = (match[2] || 'KB').toUpperCase()

  if (unit === 'GB') {
    return value * 1024 * 1024 * 1024
  }
  else if (unit === 'MB') {
    return value * 1024 * 1024
  }
  else if (unit === 'KB') {
    return value * 1024
  }
  return value
}

/**
 * 获取视频宽高与时长（带重试）。
 * 仅用本地视频路径调用 getVideoInfo，勿传入 thumb 缩略图路径。
 */
async function probeVideoMeta(
  videoPath: string,
  initial: { width?: number, height?: number, duration?: number },
): Promise<{ width: number, height: number, duration: number }> {
  let width = initial.width || 0
  let height = initial.height || 0
  let duration = initial.duration ?? 0

  const needProbe
    = !width || !height || duration == null || duration === 0

  if (!needProbe || !videoPath)
    return { width, height, duration }

  const maxAttempts = 3
  const delayMs = 150
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
    try {
      const videoInfo = await uni.getVideoInfo({ src: videoPath })
      if (videoInfo.width && videoInfo.height) {
        width = videoInfo.width
        height = videoInfo.height
      }
      if (videoInfo.duration != null && videoInfo.duration > 0) {
        duration = Math.floor(videoInfo.duration)
      }
      if (width && height)
        break
    }
    catch (err) {
      console.log(`【校验】getVideoInfo 第 ${attempt + 1} 次失败:`, err)
    }
  }

  return { width, height, duration }
}

/**
 * 校验单个素材文件
 * 检查文件格式、大小、尺寸、比例、视频时长是否符合要求
 * @param item 素材对象，包含文件路径、大小等信息
 * @param currentType 当前作品类型（1-表情，2-头像，3-背景，4-壁纸）
 * @returns 校验结果对象，包含是否通过和失败原因
 */
export async function validateMaterial(
  item: MaterialItem,
  currentType: number,
): Promise<{ valid: boolean, failReason?: string }> {
  // 获取当前类型的校验规则
  const rule = VALIDATION_RULES[currentType]
  if (!rule) {
    return { valid: false, failReason: '未知的作品类型' }
  }

  // 步骤1：获取文件路径并判断文件类型
  const filePath = item.path || item.name
  const fileType = await getFileTypeAsync(filePath)

  // 步骤2：检查是否为支持的格式
  if (fileType === 'unknown') {
    return { valid: false, failReason: '暂不支持该文件格式' }
  }

  // 步骤3：检查当前作品类型是否允许此文件格式
  // 根据真实类型检查是否在允许的格式列表中
  const isAllowed = rule.allowedTypes.some((type) => {
    const allowedType = type.toLowerCase()
    if (fileType === 'gif' && allowedType === 'gif')
      return true
    if (fileType === 'video' && ['mp4', 'mov'].includes(allowedType))
      return true
    if (fileType === 'image' && ['jpg', 'jpeg', 'png'].includes(allowedType))
      return true
    return false
  })
  if (!isAllowed) {
    return { valid: false, failReason: '该作品类型不支持此文件格式' }
  }

  // 步骤4：检查文件大小是否超过限制
  const sizeMB = getFileSizeMB(parseSizeString(item.size))
  // 优先使用规则中配置的 imageMaxSizeMB/videoMaxSizeMB，否则使用全局默认值
  const imageMaxSize = rule.imageMaxSizeMB ?? IMAGE_MAX_SIZE_MB
  const videoMaxSize = rule.videoMaxSizeMB ?? VIDEO_MAX_SIZE_MB
  if (fileType === 'image' && sizeMB > imageMaxSize) {
    return { valid: false, failReason: '文件过大，建议压缩后上传' }
  }
  if (fileType === 'gif' && sizeMB > imageMaxSize) {
    return { valid: false, failReason: '文件过大，建议压缩后上传' }
  }
  if (fileType === 'video' && sizeMB > videoMaxSize) {
    return { valid: false, failReason: '视频过大，建议剪辑后上传' }
  }

  // 步骤5：获取媒体信息（图片尺寸或视频信息）并进行尺寸和比例校验
  // 优先使用 item 中已有的尺寸信息（从 chooseMedia 返回的数据中获取）
  if (fileType === 'video') {
    const videoPath = item.path
    if (!videoPath) {
      return { valid: false, failReason: '文件无法识别或已损坏，请重新选择' }
    }

    const { width, height, duration } = await probeVideoMeta(videoPath, {
      width: item.width,
      height: item.height,
      duration: item.duration,
    })

    // 与图片分支一致：若仍无法得到分辨率，则跳过比例校验（避免机型/基础库差异导致误杀）；仍校验已知时长
    if (!width || !height) {
      console.warn('【校验】无法获取视频分辨率，跳过比例校验（依赖服务端校验）')
      const d = duration || item.duration || 0
      if (d > 0 && Math.floor(d) > VIDEO_MAX_DURATION) {
        return { valid: false, failReason: '视频时长过长，请剪辑后上传' }
      }
      return { valid: true }
    }
    const effectiveDuration = duration || item.duration || 0
    console.log('【校验】视频时长:', effectiveDuration)
    // 检查视频时长是否超过限制（仅当能读到时长时）
    if (effectiveDuration > 0 && Math.floor(effectiveDuration) > VIDEO_MAX_DURATION) {
      return { valid: false, failReason: '视频时长过长，请剪辑后上传' }
    }

    // // 检查最小尺寸
    // if (width < rule.minWidth || height < rule.minHeight) {
    //   return { valid: false, failReason: '分辨率过低，无法上传' }
    // }

    // // 检查最大尺寸
    // if (width > rule.maxWidth || height > rule.maxHeight) {
    //   return { valid: false, failReason: '尺寸过大，请上传符合规格的素材' }
    // }

    // 检查比例
    const aspectRatio = getAspectRatio(width, height)
    if (currentType === 2) {
      // 头像必须为正方形 1:1
      if (aspectRatio !== 1) {
        return { valid: false, failReason: '头像需为正方形 1:1 比例' }
      }
    }
    else {
      // 其他类型检查比例范围
      if (!isAspectRatioValid(aspectRatio, rule)) {
        if (currentType === 1) {
          return { valid: false, failReason: '比例不符合要求，建议使用接近 1:1 的素材' }
        }
        else if (currentType === 3 || currentType === 4) {
          return { valid: false, failReason: '比例不符合要求，建议使用接近 9:16 或 16:9 的素材' }
        }
        return { valid: false, failReason: '比例不符合要求' }
      }
    }
  }
  else {
    // 图片/GIF 校验
    let width = item.width || 0
    let height = item.height || 0

    // 如果 chooseMedia 没有返回尺寸，尝试使用 uni.getImageInfo 获取
    if (!width || !height) {
      try {
        const imageInfo = await uni.getImageInfo({ src: item.path || item.thumbnail })
        width = imageInfo.width
        height = imageInfo.height
        console.log('【校验】通过 getImageInfo 获取尺寸:', { width, height }, imageInfo)
      }
      catch (err) {
        console.log('【校验】getImageInfo 失败:', err)
        // 如果获取失败，暂时跳过尺寸校验（允许上传）
        return { valid: true }
      }
    }

    // // 检查最小尺寸
    // if (width < rule.minWidth || height < rule.minHeight) {
    //   return { valid: false, failReason: '分辨率过低，无法上传' }
    // }

    // // 检查最大尺寸
    // if (width > rule.maxWidth || height > rule.maxHeight) {
    //   return { valid: false, failReason: '尺寸过大，请上传符合规格的素材' }
    // }

    // 检查比例
    const aspectRatio = getAspectRatio(width, height)
    if (currentType === 2) {
      // 头像必须为正方形 1:1
      if (aspectRatio !== 1) {
        return { valid: false, failReason: '头像需为正方形 1:1 比例' }
      }
    }
    else {
      // 其他类型检查比例范围
      if (!isAspectRatioValid(aspectRatio, rule)) {
        if (currentType === 1) {
          return { valid: false, failReason: '比例不符合要求，建议使用接近 1:1 的素材' }
        }
        else if (currentType === 3 || currentType === 4) {
          return { valid: false, failReason: '比例不符合要求，建议使用接近 9:16 或 16:9 的素材' }
        }
        return { valid: false, failReason: '比例不符合要求' }
      }
    }
  }

  return { valid: true }
}

/**
 * 批量校验素材列表
 * 遍历所有状态为 "uploading" 的素材，逐个进行校验
 * 校验失败的素材将被标记为 "failed" 状态，并设置失败原因
 * @param materialList 素材列表
 * @param currentType 当前作品类型
 */
export async function validateMaterials(
  materialList: MaterialItem[],
  currentType: number,
): Promise<void> {
  // 遍历所有素材
  for (const item of materialList) {
    // 只校验状态为上传中的素材
    if (item.status !== 'uploading')
      continue

    // 调用单个素材校验函数
    const result = await validateMaterial(item, currentType)

    // 如果校验不通过，更新素材状态和失败原因
    if (!result.valid) {
      item.status = 'failed'
      item.failReason = result.failReason
      item.progress = 0
    }

    // 打印素材完整信息
    const statusText = item.status === 'failed' ? '❌ 失败' : '✅ 成功'
    const typeName = ['表情', '头像', '背景', '壁纸'][currentType - 1] || '未知'
    const filePath = item.path || item.name
    const extension = await getFileExtensionAsync(filePath)
    const fileType = await getFileTypeAsync(filePath)
    const sizeMB = getFileSizeMB(parseSizeString(item.size))

    console.log(`===== 素材校验结果 =====`)
    console.log(`素材名称: ${item.name}`)
    console.log(`作品类型: ${typeName}`)
    console.log(`校验状态: ${statusText}`)
    console.log(`文件类型: ${fileType}`)
    console.log(`文件格式: ${extension}`)
    console.log(`文件大小: ${sizeMB.toFixed(2)} MB`)
    if (item.width && item.height) {
      console.log(`分辨率: ${item.width} x ${item.height}`)
      const aspectRatio = getAspectRatio(item.width, item.height)
      console.log(`宽高比: ${aspectRatio.toFixed(4)}`)
    }
    if (item.duration) {
      console.log(`视频时长: ${item.duration} 秒`)
    }
    if (result.failReason) {
      console.log(`失败原因: ${result.failReason}`)
    }
    console.log(`========================`)
  }
}
