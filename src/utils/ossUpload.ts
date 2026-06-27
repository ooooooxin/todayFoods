import { getStsToken, preCheck } from '@/api/upload/upload'
import { useUserStore } from '@/store'

/**
 * 生成上传文件路径
 * 格式：user_assets/{用户id}/{yyyy}/{mm}/{dd}/timestamp_6位随机码_原始名称.jpg
 * @param originalName 原始文件名（可能不带扩展名）
 * @param filePath 文件路径（用于提取扩展名）
 * @returns 生成的文件路径
 */
export async function generateUploadPath(originalName: string, filePath?: string): Promise<string> {
  const userStore = useUserStore()
  const userId = userStore.userInfo.id || 0

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const timestamp = Date.now()
  const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase()

  let ext = ''
  const pathExt = (filePath || originalName).split('.').pop()?.toLowerCase() || ''
  const isVideo = ['mp4', 'mov'].includes(pathExt)

  if (isVideo) {
    ext = pathExt
  }
  else {
    try {
      const imageInfo = await uni.getImageInfo({ src: filePath || originalName })
      ext = imageInfo.type?.toLowerCase() || pathExt || 'jpg'
    }
    catch (err) {
      console.log('【OSS】getImageInfo failed, use path ext:', err)
      ext = pathExt || 'jpg'
    }
  }

  return `user_assets/${userId}/${year}/${month}/${day}/${timestamp}_${randomCode}.${ext}`
}

/**
 * 根据文件路径获取 Content-Type
 * @param filePath 文件路径
 * @returns Content-Type 字符串
 */
export async function getContentType(filePath: string): Promise<string> {
  const pathExt = filePath.split('.').pop()?.toLowerCase() || ''
  const isVideo = ['mp4', 'mov'].includes(pathExt)

  let ext = pathExt
  if (!isVideo) {
    try {
      const imageInfo = await uni.getImageInfo({ src: filePath })
      ext = imageInfo.type?.toLowerCase() || pathExt || 'jpg'
    }
    catch (err) {
      console.log('【OSS】getImageInfo failed, use path ext:', err)
      ext = pathExt || 'jpg'
    }
  }

  console.log('【OSS上传】文件扩展名:', ext)
  const contentTypeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    webm: 'video/webm',
  }
  return contentTypeMap[ext] || 'application/octet-stream'
}

/**
 * OSS 上传结果
 */
export interface IOssUploadResult {
  // 是否上传成功
  success: boolean
  // OSS 文件 URL
  url?: string
  // 错误信息
  error?: string
}

/**
 * 上传单个文件到 OSS
 * 使用前端直传方式，通过 STS Token 进行身份验证
 * @param filePath 本地文件路径
 * @param ossPath OSS 目标路径
 * @param stsToken STS 临时凭证
 * @param onProgress 上传进度回调
 * @returns 上传结果
 */
export async function uploadFileToOss(
  filePath: string,
  ossPath: string,
  stsToken: {
    accessKeyId: string
    accessKeySecret: string
    securityToken: string
    host: string
    policy: string
    signature: string
    callback: string
  },
  onProgress?: (progress: number) => void,
): Promise<IOssUploadResult> {
  const contentType = await getContentType(filePath)

  return new Promise((resolve) => {
    // 检查 host 是否有效
    let host = stsToken.host
    console.log('【OSS上传】原始 host:', host)
    console.log('【OSS上传】STS Token:', {
      policy: stsToken.policy,
      signature: stsToken.signature,
      callback: stsToken.callback,
    })

    if (!host || typeof host !== 'string') {
      console.error('【OSS上传】host 无效:', host)
      resolve({ success: false, error: 'OSS host 无效' })
      return
    }

    // 确保 host 是完整的 URL
    host = host.trim()
    if (!host.startsWith('http://') && !host.startsWith('https://')) {
      host = `https://${host}`
    }

    console.log('【OSS上传】最终 URL:', host)

    // 构建表单数据 - 使用 STS 临时凭证方式
    // 注意：后端返回的 policy 和 signature 为 null，需要前端构造
    const formData: Record<string, string> = {
      'key': ossPath,
      'OSSAccessKeyId': stsToken.accessKeyId,
      // 后端 policy 要求必须传递 x-oss-forbid-overwrite 参数
      'x-oss-forbid-overwrite': 'true',
    }

    // 如果有 securityToken，需要添加到表单
    if (stsToken.securityToken) {
      formData['x-oss-security-token'] = stsToken.securityToken
    }

    // 如果后端返回了 policy 和 signature，则使用它们
    if (stsToken.policy && stsToken.signature) {
      formData.policy = stsToken.policy
      formData.signature = stsToken.signature
      if (stsToken.callback) {
        formData['x-oss-callback'] = stsToken.callback
      }
    }
    else {
      // policy 和 signature 为 null，无法直接上传
      // 需要使用 OSS SDK 或让后端提供这些参数
      console.error('【OSS上传】后端未返回 policy 和 signature，无法直接上传')
      resolve({ success: false, error: '后端未返回必要的上传凭证（policy 和 signature）' })
      return
    }

    if (contentType) {
      formData['x-oss-content-type'] = contentType
    }

    console.log('【OSS上传】表单数据:', formData)
    console.log('【OSS上传】Content-Type:', contentType)

    const uploadTask = uni.uploadFile({
      url: host,
      filePath,
      name: 'file',
      formData,
      // header: {
      //   'Content-Type': contentType,
      // },
      success: (res) => {
        console.log('【OSS上传】响应:', res)
        // OSS 上传成功可能返回 200 或 204
        if (res.statusCode === 200 || res.statusCode === 204) {
          const url = `${host}/${ossPath}`
          resolve({ success: true, url })
        }
        else {
          resolve({ success: false, error: `上传失败，状态码：${res.statusCode}` })
        }
      },
      fail: (err) => {
        console.error('【OSS上传】失败:', err)
        resolve({ success: false, error: err.errMsg || '上传失败' })
      },
    })

    // 监听上传进度
    if (onProgress) {
      uploadTask.onProgressUpdate((res) => {
        onProgress(res.progress)
      })
    }
  })
}

/**
 * 完整的素材上传流程
 * 1. 获取 STS Token
 * 2. 上传文件到 OSS
 * 3. 调用预检查接口
 * @param filePath 本地文件路径
 * @param originalName 原始文件名
 * @param category 分类（1-表情, 2-头像, 3-背景, 4-壁纸）
 * @param onProgress 上传进度回调（0-100）
 * @returns 预检查返回的 token 和有效期
 */
export async function uploadMaterial(
  filePath: string,
  originalName: string,
  category: number,
  onProgress?: (progress: number) => void,
): Promise<{ success: boolean, token?: string, expiresIn?: number, url?: string, error?: string }> {
  try {
    // 1. 获取 STS Token
    const stsToken = await getStsToken()

    // 2. 生成上传路径（传入 filePath 用于提取扩展名）
    const ossPath = await generateUploadPath(originalName, filePath)

    // 3. 上传文件到 OSS
    const uploadResult = await uploadFileToOss(filePath, ossPath, {
      accessKeyId: stsToken.accessKeyId,
      accessKeySecret: stsToken.accessKeySecret,
      securityToken: stsToken.securityToken,
      host: stsToken.host,
      policy: stsToken.policy,
      signature: stsToken.signature,
      callback: stsToken.callback,
    }, onProgress)

    if (!uploadResult.success) {
      return { success: false, error: uploadResult.error }
    }

    // 4. 调用预检查接口
    const preCheckRes = await preCheck({
      url: uploadResult.url!,
      category,
    })

    return {
      success: true,
      token: preCheckRes.token,
      expiresIn: preCheckRes.expiresIn,
      url: uploadResult.url,
    }
  }
  catch (error: any) {
    return { success: false, error: error.message || '上传失败' }
  }
}
