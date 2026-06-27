<script lang="ts" setup>
import type { AssetsDetail } from '@/api/common'
import { onHide, onLoad, onShareAppMessage, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { assetsDownload, assetsDownloadConfirm, assetsFavorite, assetsLike, assetsShare, followOperate, getAssetsDetail, getFollowRelation, saveBrowsingHistory } from '@/api/common'
import BottomTabBar from '@/components/bottom-tab-bar/bottom-tab-bar.vue'
import PreviewPanel from '@/components/preview-panel/preview-panel.vue'
import RightInteractionPanel from '@/components/right-interaction-panel/right-interaction-panel.vue'
import { useAssetsConsumptionSession } from '@/composables/useAssetsConsumptionSession'
import { showCustomToast } from '@/composables/useCustomToast'
import { useTokenStore } from '@/store/token'
import { useUserStore } from '@/store/user'
import { useWorksDetailsStore } from '@/store/worksDetails'
import { getImgUrl } from '@/utils'
import { statusNavTotalHeight } from '@/utils/systemInfo'

// 视频上下文引用
let videoContext: UniApp.VideoContext | null = null

// 详情缓存 Map（key: assetsId, value: AssetsDetail）
const detailCache = new Map<number | string, AssetsDetail>()

// 预加载数量（前后各3项）
const PRELOAD_COUNT = 3

/**
 * 更新计数显示值，处理 9999/1万 临界值
 * @param currentValue 当前显示值（可能是 '9999' 或 '1万'）
 * @param isIncrement true 为增加，false 为减少
 * @returns 更新后的显示值
 */
function updateFormattedCount(currentValue: string | undefined, isIncrement: boolean): string {
  const numValue = Number(currentValue || 0)
  // 如果当前是 1万 格式（精确匹配）
  if (currentValue === '1万') {
    // 如果是 1万 且是减操作，返回 9999
    if (!isIncrement) {
      return '9999'
    }
    // 1万 且是加操作，保持 1万
    return currentValue
  }
  // 其他包含 "万" 的情况（如 2万、10万等），保持原值
  if (currentValue?.includes('万')) {
    return currentValue
  }
  // 数字小于 10000 的情况
  if (numValue < 9999) {
    return (numValue + (isIncrement ? 1 : -1)).toString()
  }
  // 刚好是 9999
  if (numValue === 9999) {
    if (isIncrement) {
      return '1万'
    }
    return '9998'
  }
  // 其他情况（理论上不会出现，因为大于 9999 应该用 1万 格式）
  return (numValue + (isIncrement ? 1 : -1)).toString()
}

/**
 * 仅增加计数（用于下载、分享等只有增加操作的场景）
 * @param currentValue 当前显示值
 * @returns 更新后的显示值
 */
function incrementFormattedCount(currentValue: string | undefined): string {
  return updateFormattedCount(currentValue, true)
}

// 素材详情数据（直接使用接口类型）
const assetsDetail = ref<AssetsDetail | null>(null)

// 临时预览图（用于切换时先显示缩略图，避免黑屏）
const tempPreviewUrl = ref<string>('')

// 错误状态管理
const errorState = ref<{
  hasError: boolean
  errorCode: number | null
  errorMessage: string
}>({
  hasError: false,
  errorCode: null,
  errorMessage: '',
})

const isInit = ref(true)

// 当前素材ID（用于刷新）
const currentAssetsId = ref<string | number>('')

const userStore = useUserStore()

/** 是否为当前登录用户自己的素材（与 RightInteractionPanel 一致） */
const isOwnAsset = computed(() => {
  const creatorId = assetsDetail.value?.creator?.id
  if (!creatorId)
    return false
  return creatorId === userStore.userInfo.id
})

const isConsumptionSessionValid = computed(() =>
  !errorState.value.hasError && !!currentAssetsId.value && !isOwnAsset.value)
const {
  initSessionOnLoad,
  resetSessionForNewAsset,
  tryStartSession,
  onVideoDurationKnown,
  checkVideoWatchComplete,
  pauseSession,
  resumeSession,
  destroySession,
} = useAssetsConsumptionSession(currentAssetsId, isConsumptionSessionValid)

function startConsumptionForCurrentAsset() {
  if (!assetsDetail.value || errorState.value.hasError || isOwnAsset.value)
    return
  tryStartSession({ isVideo: assetsDetail.value.fileType === 3 })
}

// WorksDetails Store
const worksDetailsStore = useWorksDetailsStore()

// Token Store
const tokenStore = useTokenStore()

// 底部TabBar数据
const tabList = ref<any[]>([])
const currentTabIndex = ref(0)

// 分页状态（数据已预加载，无需分页）
const paginationState = ref<{
  hasNext: boolean
  hasPrev: boolean
}>({
  hasNext: false,
  hasPrev: false,
})

// BottomTabBar 组件引用
const bottomTabBarRef = ref<InstanceType<typeof BottomTabBar> | null>(null)

/** 切换流程进行中：详情加载 + 底部 Tab 滚动结束，期间禁止新的滑动切换与 Tab 点击 */
const isAssetSwitching = ref(false)

// 触发滚动到中间（与 scroll-view 动画时长对齐，供 await）
async function triggerScrollToCenter() {
  await bottomTabBarRef.value?.scrollToCenter()
}

// 滑动手势状态
const swipeState = ref({
  startX: 0,
  startY: 0,
  isSwiping: false,
  moveX: 0,
  lastY: 0,
})

// 滑动阈值（rpx转换为px）
const SWIPE_THRESHOLD = uni.upx2px(150)

// 滑动手势处理
function handleTouchStart(e: TouchEvent) {
  swipeState.value.startX = e.touches[0].clientX
  swipeState.value.startY = e.touches[0].clientY
  swipeState.value.lastY = e.touches[0].clientY
  swipeState.value.isSwiping = true
}

function handleTouchMove(e: TouchEvent) {
  if (!swipeState.value.isSwiping)
    return
  swipeState.value.moveX = e.touches[0].clientX - swipeState.value.startX
  swipeState.value.lastY = e.touches[0].clientY
}

async function handleTouchEnd() {
  uni.hideLoading()
  if (!swipeState.value.isSwiping)
    return

  const deltaX = swipeState.value.moveX
  const deltaY = Math.abs(swipeState.value.startY - swipeState.value.lastY)

  // 必须是水平滑动，且水平距离大于垂直距离；切换锁生效期间不响应新的滑动切换
  if (
    Math.abs(deltaX) > SWIPE_THRESHOLD
    && Math.abs(deltaX) > deltaY
    && !isAssetSwitching.value
  ) {
    // 向左滑 - 切换到下一个
    if (deltaX < 0) {
      if (currentTabIndex.value < tabList.value.length - 1) {
        isAssetSwitching.value = true
        try {
          currentTabIndex.value++
          const item = tabList.value[currentTabIndex.value]
          resetSessionForNewAsset()
          // 先清除详情数据，避免与临时图重叠
          assetsDetail.value = null
          // 设置临时预览图（缩略图），避免黑屏
          tempPreviewUrl.value = item.thumbUrl || ''
          // 视频显示 loading，图片不显示
          if (item.fileType === 3) {
            uni.showLoading({ title: '加载中...' })
          }
          // 切换时立即预加载前后3项（与加载详情、滚动居中并行）
          preloadAdjacentDetails(currentTabIndex.value)
          // 加载详情与滚动居中并行执行，避免等待API期间滚动位置漂移
          await Promise.all([loadAssetDetail(item.id, false), triggerScrollToCenter()])
        }
        finally {
          isAssetSwitching.value = false
        }
      }
      else {
        showCustomToast({ title: '暂时没有更多了', icon: 'none' })
      }
    }
    // 向右滑 - 切换到上一个
    else {
      if (currentTabIndex.value > 0) {
        isAssetSwitching.value = true
        try {
          currentTabIndex.value--
          const item = tabList.value[currentTabIndex.value]
          resetSessionForNewAsset()
          // 先清除详情数据，避免与临时图重叠
          assetsDetail.value = null
          // 设置临时预览图（缩略图），避免黑屏
          tempPreviewUrl.value = item.thumbUrl || ''
          // 视频显示 loading，图片不显示
          if (item.fileType === 3) {
            uni.showLoading({ title: '加载中...' })
          }
          // 切换时立即预加载前后3项（与加载详情、滚动居中并行）
          preloadAdjacentDetails(currentTabIndex.value)
          // 加载详情与滚动居中并行执行，避免等待API期间滚动位置漂移
          await Promise.all([loadAssetDetail(item.id, false), triggerScrollToCenter()])
        }
        finally {
          isAssetSwitching.value = false
        }
      }
      else {
        showCustomToast({ title: '已经是第一个了', icon: 'none' })
      }
    }
  }

  // 重置状态
  swipeState.value.isSwiping = false
  swipeState.value.moveX = 0
}

// 视频播放状态
const videoState = ref({
  isPlaying: false,
  currentTime: 0,
  duration: 20,
  buffered: 0,
  volume: 1,
  isMuted: false,
})

// 下载进度条状态
const downloadProgress = ref({
  show: false,
  percent: 0,
  status: 'downloading', // 'downloading' | 'completed'
})

const showSuccessPopup = ref(false)

watch(() => downloadProgress.value.status, (newStatus) => {
  if (newStatus === 'completed') {
    showSuccessPopup.value = true
  }
})

function closeSuccessPopup() {
  showSuccessPopup.value = false
  downloadProgress.value.show = false
  downloadProgress.value.status = 'downloading'
}

// 模拟进度条定时器
let progressTimer: ReturnType<typeof setInterval> | null = null

// 开始模拟进度条增长
function startProgressAnimation() {
  // 清除之前的定时器
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }

  downloadProgress.value.percent = 0

  // 模拟进度增长：快速到80%，然后缓慢到95%，最后等待完成到100%
  progressTimer = setInterval(() => {
    if (downloadProgress.value.percent < 80) {
      // 快速阶段：0-80%
      downloadProgress.value.percent += Math.random() * 3 + 2
    }
    else if (downloadProgress.value.percent < 95) {
      // 缓慢阶段：80-95%
      downloadProgress.value.percent += Math.random() * 1 + 0.5
    }
    // 95%后暂停，等待实际下载完成再跳到100%

    if (downloadProgress.value.percent >= 95) {
      downloadProgress.value.percent = 95
      if (progressTimer) {
        clearInterval(progressTimer)
        progressTimer = null
      }
    }
  }, 100)
}

// 完成进度条
function completeProgress() {
  if (progressTimer) {
    clearInterval(progressTimer)
    progressTimer = null
  }
  downloadProgress.value.percent = 100
}

/**
 * 修改 MP4 文件内嵌时间戳（creation_time / modification_time）为当前时间
 * iOS 相册根据 MP4 容器中 mvhd / tkhd / mdhd atom 的 creation_time 显示视频日期
 * 如果不修改，保存到相册后会显示文件的原始上传时间而非下载当天
 */
function patchMp4Timestamps(buffer: ArrayBuffer): void {
  const data = new Uint8Array(buffer)
  const view = new DataView(buffer)
  // Mac 时间纪元偏移：从 1904-01-01 到 1970-01-01 的秒数
  const MAC_EPOCH_OFFSET = 2082844800
  const nowMacTime = Math.floor(Date.now() / 1000) + MAC_EPOCH_OFFSET

  // 需要修改时间戳的 atom 类型
  // mvhd (Movie Header) / tkhd (Track Header) / mdhd (Media Header)
  // 结构：[4B size][4B type][1B version][3B flags][4/8B creation_time][4/8B modification_time]
  const targets = [
    [0x6D, 0x76, 0x68, 0x64], // 'mvhd'
    [0x74, 0x6B, 0x68, 0x64], // 'tkhd'
    [0x6D, 0x64, 0x68, 0x64], // 'mdhd'
  ]

  for (let i = 0; i < data.length - 20; i++) {
    for (const sig of targets) {
      if (data[i] === sig[0] && data[i + 1] === sig[1] && data[i + 2] === sig[2] && data[i + 3] === sig[3]) {
        const version = data[i + 4]
        if (version === 0) {
          // version 0: 32-bit timestamps
          view.setUint32(i + 8, nowMacTime, false)
          view.setUint32(i + 12, nowMacTime, false)
        }
        else if (version === 1) {
          // version 1: 64-bit timestamps
          view.setUint32(i + 8, 0, false)
          view.setUint32(i + 12, nowMacTime, false)
          view.setUint32(i + 16, 0, false)
          view.setUint32(i + 20, nowMacTime, false)
        }
        break
      }
    }
  }
}

// 保存到相册（带授权处理）- 根据文件类型判断保存图片还是视频
function saveAssetWithAuth(filePath: string, token: string) {
  const isVideo = assetsDetail.value?.fileType === 3
  const saveApi = isVideo ? uni.saveVideoToPhotosAlbum : uni.saveImageToPhotosAlbum
  const scopeName = isVideo ? 'scope.writePhotosAlbum' : 'scope.writePhotosAlbum'
  const contentText = isVideo ? '保存视频到相册需要您授权，是否前往设置开启？' : '保存图片到相册需要您授权，是否前往设置开启？'

  saveApi({
    filePath,
    success: async () => {
      try {
        // 下载确认（接口 resolve 的为 result 字段）
        const confirmResult = await assetsDownloadConfirm({
          assetsId: assetsDetail.value!.assetsId,
          token,
        })
        if (confirmResult === true) {
          assetsDetail.value!.downloadCountFormatted = incrementFormattedCount(assetsDetail.value!.downloadCountFormatted)
        }
      }
      catch {
        // 确认失败时不改本地下载数
      }
      // 显示已完成状态
      downloadProgress.value.status = 'completed'
    },
    fail: (err: any) => {
      console.error('保存到相册失败:', err)
      downloadProgress.value.show = false
      downloadProgress.value.status = 'downloading'
      // 判断是否是授权失败
      if (err.errMsg && (err.errMsg.includes('auth') || err.errMsg.includes('authorize') || err.errNo === 10003)) {
        // 引导用户去设置页面开启授权
        uni.showModal({
          title: '需要授权',
          content: contentText,
          success: (modalRes) => {
            if (modalRes.confirm) {
              // 打开设置页面
              uni.openSetting({
                success: (settingRes) => {
                  console.log('设置页面返回:', settingRes)
                  // 用户可能开启了授权，再次尝试保存
                  if (settingRes.authSetting && settingRes.authSetting[scopeName]) {
                    saveAssetWithAuth(filePath, token)
                  }
                },
              })
            }
          },
        })
      }
      else {
        showCustomToast({ title: '保存失败', icon: 'none' })
      }
    },
  })
}

// 标签顶部位置（确保不超过导航栏高度）
const labelTop = computed(() => {
  const minTop = 15 // rpx
  const navHeight = statusNavTotalHeight * 2 // 转换为 rpx
  return Math.max(minTop, navHeight + 15)
})

// 媒体类型（1-静态图, 2-动态图, 3-视频）
const mediaType = computed(() => {
  if (!assetsDetail.value)
    return 'image'
  return assetsDetail.value.fileType === 3 ? 'video' : 'image'
})

// 版权标签文本
const copyrightLabel = computed(() => {
  if (!assetsDetail.value)
    return ''
  const type = assetsDetail.value.copyrightType
  if (type === 1)
    return '原创'
  if (type === 2)
    return '二创'
  return ''
})

// 从 URL 参数传入的 title（优先使用）
const urlTitle = ref('')

const pageTitle = computed(() => {
  // 优先使用 URL 传入的 title
  if (urlTitle.value)
    return urlTitle.value
  const entrySource = worksDetailsStore.entrySource
  const apiParams = worksDetailsStore.apiParams
  const collectionTitle = apiParams?.collection?.titleName || ''
  if (collectionTitle)
    return collectionTitle
  if (entrySource === 'home' || entrySource === 'creator' || entrySource === 'me' || entrySource === 'history' || !assetsDetail.value?.ip?.name) {
    return '详情'
  }
  return assetsDetail.value?.ip?.name
})

// 作者信息（适配 RightInteractionPanel 组件格式）
const authorInfo = computed(() => {
  if (!assetsDetail.value?.creator) {
    return {
      id: 0,
      name: '',
      avatar: '',
      isFollowed: false,
    }
  }
  return {
    id: assetsDetail.value.creator.id,
    name: assetsDetail.value.creator.nickname,
    avatar: assetsDetail.value.creator.avatar,
    isFollowed: assetsDetail.value.creator.followed,
  }
})

// 统计数据（适配 RightInteractionPanel 组件格式）
const statsInfo = computed(() => {
  if (!assetsDetail.value) {
    return {
      likeCount: 0,
      likeCountFormatted: '',
      favoriteCount: 0,
      favoriteCountFormatted: '',
      shareCount: 0,
      shareCountFormatted: '',
      downloadCount: 0,
      downloadCountFormatted: '',
    }
  }
  return {
    likeCount: assetsDetail.value.likeCount,
    likeCountFormatted: assetsDetail.value.likeCountFormatted,
    favoriteCount: assetsDetail.value.favoriteCount,
    favoriteCountFormatted: assetsDetail.value.favoriteCountFormatted,
    shareCount: assetsDetail.value.shareCount,
    shareCountFormatted: assetsDetail.value.shareCountFormatted,
    downloadCount: assetsDetail.value.downloadCount,
    downloadCountFormatted: assetsDetail.value.downloadCountFormatted,
  }
})

function handleToggleMute() {
  videoState.value.isMuted = !videoState.value.isMuted
}

// 预览图加载完成
function onPreviewImageLoad() {
  // 高清图加载完成后，清空临时预览图
  tempPreviewUrl.value = ''
}

// 视频开始播放
function onVideoPlay() {
  uni.hideLoading()
}

// 视频元数据加载完成
function onVideoReady() {
  uni.hideLoading()
}

function onVideoMetadata(payload: { duration: number }) {
  onVideoDurationKnown(payload.duration)
}

function onVideoTimeUpdate(payload: { currentTime: number, duration: number }) {
  checkVideoWatchComplete(payload.currentTime, payload.duration)
}

// 处理互动操作
async function handleFollow() {
  if (!assetsDetail.value?.creator)
    return
  const creatorId = assetsDetail.value.creator.id
  const isFollowed = assetsDetail.value.creator.followed
  try {
    await followOperate({
      followedMemberId: creatorId,
      followAction: isFollowed ? 0 : 1,
    })
    // 更新本地状态
    assetsDetail.value.creator.followed = !isFollowed
    // showCustomToast({ title: isFollowed ? '已取消关注' : '关注成功', icon: 'success' })
  }
  catch (error) {
    console.error('关注操作失败:', error)
  }
}

async function handleLike() {
  if (!assetsDetail.value)
    return
  const assetsId = assetsDetail.value.assetsId
  const isLiked = assetsDetail.value.liked
  try {
    await assetsLike({
      assetsId,
      action: isLiked ? 0 : 1,
    })
    // 更新本地状态
    assetsDetail.value.liked = !isLiked
    // 根据是点赞还是取消点赞，决定加或减
    assetsDetail.value.likeCountFormatted = updateFormattedCount(assetsDetail.value.likeCountFormatted, !isLiked)
    // showCustomToast({ title: isLiked ? '已取消点赞' : '点赞成功', icon: 'success' })
  }
  catch (error) {
    console.error('点赞操作失败:', error)
  }
}

async function handleFavorite() {
  if (!assetsDetail.value)
    return
  const assetsId = assetsDetail.value.assetsId
  const isFavorited = assetsDetail.value.favorited
  try {
    await assetsFavorite({
      assetsId,
      action: isFavorited ? 0 : 1,
    })
    // 更新本地状态
    assetsDetail.value.favorited = !isFavorited
    // 根据是收藏还是取消收藏，决定加或减
    assetsDetail.value.favoriteCountFormatted = updateFormattedCount(assetsDetail.value.favoriteCountFormatted, !isFavorited)
    showCustomToast({ title: isFavorited ? '已取消收藏' : '收藏成功', icon: 'success' })
  }
  catch (error) {
    console.error('收藏操作失败:', error)
  }
}

async function handleDownload() {
  if (!assetsDetail.value)
    return
  const assetsId = assetsDetail.value.assetsId
  try {
    const result = await assetsDownload({ assetsId })
    // 显示下载进度条
    downloadProgress.value.show = true
    downloadProgress.value.status = 'downloading'
    // 开始模拟进度条动画
    startProgressAnimation()

    // #ifdef H5
    // H5 不支持 uni.saveImageToPhotosAlbum / uni.saveVideoToPhotosAlbum，
    // 改用浏览器原生下载：优先 fetch blob 触发 download，跨域失败则退回 window.open
    await handleH5Download(result.url, result.token, assetsDetail.value.assetsId, assetsDetail.value.fileType === 3)
    return
    // #endif

    // #ifndef H5
    // 小程序 / App：走 downloadFile + 保存到相册
    uni.downloadFile({
      url: result.url,
      success: (res) => {
        if (res.statusCode === 200) {
          // 下载完成，进度到100%
          completeProgress()
          // 视频文件需要修改 MP4 内嵌时间戳为当天，iOS 相册根据此元数据显示日期
          const isVideo = assetsDetail.value?.fileType === 3
          if (isVideo) {
            try {
              const fs = uni.getFileSystemManager()
              // 不指定 encoding，返回 ArrayBuffer
              const fileData = fs.readFileSync(res.tempFilePath) as ArrayBuffer
              // 修改 MP4 容器中 mvhd/tkhd/mdhd 的 creation_time 为当前时间
              patchMp4Timestamps(fileData)
              const newPath = `${wx.env.USER_DATA_PATH}/dl_${Date.now()}.mp4`
              fs.writeFileSync(newPath, fileData)
              saveAssetWithAuth(newPath, result.token)
            }
            catch (e) {
              console.warn('修改视频时间戳失败，使用原文件:', e)
              saveAssetWithAuth(res.tempFilePath, result.token)
            }
          }
          else {
            // 图片直接保存
            saveAssetWithAuth(res.tempFilePath, result.token)
          }
        }
        else {
          showCustomToast({ title: '下载失败', icon: 'none' })
          downloadProgress.value.show = false
          downloadProgress.value.status = 'downloading'
        }
      },
      fail: (err) => {
        console.error('下载文件失败:', err)
        downloadProgress.value.show = false
        downloadProgress.value.status = 'downloading'
      },
    })
    // #endif
  }
  catch (error) {
    console.error('获取下载链接失败:', error)
    downloadProgress.value.show = false
    downloadProgress.value.status = 'downloading'
  }
}

// #ifdef H5
/**
 * H5 端下载实现：
 * 1) 优先使用 fetch 获取 blob 并创建临时 a 标签触发浏览器下载（支持自定义文件名）；
 * 2) 资源跨域或 fetch 失败时，退回 window.open 让用户手动保存。
 * 下载成功后仍调用 assetsDownloadConfirm 以同步计数。
 */
async function handleH5Download(url: string, token: string, assetsId: number | string, isVideo: boolean) {
  const extFromUrl = (() => {
    try {
      const pathname = new URL(url).pathname
      const dotIdx = pathname.lastIndexOf('.')
      return dotIdx >= 0 ? pathname.slice(dotIdx) : ''
    }
    catch {
      return ''
    }
  })()
  const defaultExt = isVideo ? '.mp4' : '.png'
  const filename = `${assetsId}${extFromUrl || defaultExt}`

  /**
   * 复制文本到剪贴板（H5 场景兼容）
   * 优先使用 navigator.clipboard（HTTPS / 现代浏览器），失败时退回 execCommand('copy')
   */
  const copyTextToClipboard = async (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        showCustomToast({ title: '下载地址已复制到剪贴板', icon: 'none' })
        return
      }
      // 退回 execCommand
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.readOnly = true
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showCustomToast({ title: '下载地址已复制到剪贴板', icon: 'none' })
    }
    catch (err) {
      console.warn('复制下载地址失败:', err)
    }
  }

  const triggerAnchorDownload = (href: string, revoke?: () => void) => {
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    if (revoke)
      setTimeout(revoke, 1000)
  }

  // 环境识别：微信内置浏览器 / iOS / Android
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  const isWeChat = /MicroMessenger/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)

  if (isWeChat && isAndroid) {
    // 安卓微信：无法直接触发下载，复制地址并提示使用浏览器打开
    completeProgress()
    await copyTextToClipboard(url)
    uni.showModal({
      title: '请使用浏览器下载',
      content: '下载地址已复制，请在浏览器中粘贴打开以保存文件',
      showCancel: false,
      confirmText: '我知道了',
    })
  }
  else if (isWeChat && isIOS) {
    // iOS 微信：使用 location.href 由系统接管（可在内置浏览器中预览后长按保存）
    completeProgress()
    try {
      window.location.href = url
    }
    catch (e) {
      console.warn('iOS 微信 location.href 下载失败：', e)
      await copyTextToClipboard(url)
    }
  }
  else {
    // 普通浏览器：fetch blob + a[download] 触发真正的保存
    try {
      const resp = await fetch(url, { mode: 'cors' })
      if (!resp.ok)
        throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const objectUrl = URL.createObjectURL(blob)
      triggerAnchorDownload(objectUrl, () => URL.revokeObjectURL(objectUrl))
      completeProgress()
    }
    catch (e) {
      console.warn('H5 fetch 下载失败，回退为新窗口打开：', e)
      completeProgress()
      window.open(url, '_blank', 'noopener')
      await copyTextToClipboard(url)
    }
  }

  // 同步后端下载计数
  try {
    const confirmResult = await assetsDownloadConfirm({ assetsId, token })
    if (confirmResult === true && assetsDetail.value) {
      assetsDetail.value.downloadCountFormatted = incrementFormattedCount(assetsDetail.value.downloadCountFormatted)
    }
  }
  catch {
    // ignore
  }

  downloadProgress.value.status = 'completed'
}
// #endif

/**
 * 预加载前后相邻素材的详情数据
 */
function preloadAdjacentDetails(currentIndex: number) {
  const preloadIndices: number[] = []
  for (let i = 1; i <= PRELOAD_COUNT; i++) {
    const prevIndex = currentIndex - i
    const nextIndex = currentIndex + i
    if (prevIndex >= 0) {
      preloadIndices.push(prevIndex)
    }
    if (nextIndex < tabList.value.length) {
      preloadIndices.push(nextIndex)
    }
  }

  preloadIndices.forEach((index) => {
    const item = tabList.value[index]
    if (item?.id) {
      const assetsId = item.id
      if (!detailCache.has(assetsId)) {
        getAssetsDetail({ assetsId })
          .then((detail) => {
            detailCache.set(assetsId, detail)
          })
          .catch((error) => {
            console.warn('[预加载] 获取相邻素材详情失败:', error)
          })
      }
    }
  })
}

/**
 * 处理Tab切换
 */
async function handleTabChange(index: number) {
  uni.hideLoading()
  if (index < 0 || index >= tabList.value.length)
    return

  // 如果点击的是已激活的Tab，不执行后续代码
  if (index === currentTabIndex.value) {
    return
  }

  if (isAssetSwitching.value)
    return

  isAssetSwitching.value = true
  try {
    currentTabIndex.value = index
    const item = tabList.value[index]

    resetSessionForNewAsset()
    // 先清除详情数据，避免与临时图重叠
    assetsDetail.value = null

    // 设置临时预览图（缩略图），避免黑屏
    tempPreviewUrl.value = item.thumbUrl || ''
    // 视频显示 loading，图片不显示
    if (item.fileType === 3) {
      uni.showLoading({ title: '加载中...' })
    }

    // 切换时立即预加载前后3项（与加载详情、滚动居中并行）
    preloadAdjacentDetails(index)

    // 加载详情与滚动居中并行执行，避免等待API期间滚动位置漂移
    await Promise.all([loadAssetDetail(item.id, false), triggerScrollToCenter()])
  }
  finally {
    isAssetSwitching.value = false
  }
}

/**
 * 加载素材详情
 * @param assetsId 素材ID
 * @param usePreloaded 是否使用预加载的详情数据
 * @param useCache 是否使用缓存
 */
async function loadAssetDetail(assetsId: number | string, usePreloaded: boolean = false, useCache: boolean = true) {
  try {
    // 如果有预加载的详情数据且允许使用，直接使用
    if (usePreloaded && worksDetailsStore.preloadedDetail) {
      assetsDetail.value = worksDetailsStore.preloadedDetail
      // 存入缓存
      detailCache.set(assetsId, worksDetailsStore.preloadedDetail)
      // 使用完后清空，避免影响后续操作
      worksDetailsStore.preloadedDetail = null
      // 不主动清空 tempPreviewUrl，等 onPreviewImageLoad(@load) 事件触发后再清空
      // 加载成功，重置错误状态
      errorState.value = {
        hasError: false,
        errorCode: null,
        errorMessage: '',
      }
      // 更新currentAssetsId并保存浏览记录
      currentAssetsId.value = assetsId
      tokenStore.hasLogin && !isOwnAsset.value && saveBrowsingHistory({ entityType: 3, entityId: assetsId })
      startConsumptionForCurrentAsset()
      return
    }

    // 先检查缓存中是否有该素材的详情
    const cachedDetail = detailCache.get(assetsId)
    if (useCache && cachedDetail !== undefined) {
      assetsDetail.value = cachedDetail
      // 不主动清空 tempPreviewUrl，等 onPreviewImageLoad(@load) 事件触发后再清空
      // 加载成功，重置错误状态
      errorState.value = {
        hasError: false,
        errorCode: null,
        errorMessage: '',
      }
      // 更新currentAssetsId并保存浏览记录
      currentAssetsId.value = assetsId
      tokenStore.hasLogin && !isOwnAsset.value && saveBrowsingHistory({ entityType: 3, entityId: assetsId })
      // 获取关注状态（如果有creator.id）
      if (assetsDetail.value?.creator?.id) {
        getFollowRelation({ followedMemberId: assetsDetail.value.creator.id })
          .then((res) => {
            // 更新本地关注状态
            if (assetsDetail.value?.creator) {
              assetsDetail.value.creator.followed = res.isFollowed
            }
          })
          .catch((error) => {
            console.error('获取关注关系失败:', error)
          })
      }
      startConsumptionForCurrentAsset()
      return
    }

    const detail = await getAssetsDetail({ assetsId })
    assetsDetail.value = detail
    // 存入缓存
    detailCache.set(assetsId, detail)
    // 加载成功，重置错误状态
    errorState.value = {
      hasError: false,
      errorCode: null,
      errorMessage: '',
    }
    // 更新currentAssetsId并保存浏览记录
    currentAssetsId.value = assetsId
    tokenStore.hasLogin && !isOwnAsset.value && saveBrowsingHistory({ entityType: 3, entityId: assetsId })
    startConsumptionForCurrentAsset()
  }
  catch (error: any) {
    console.error('[加载详情] 获取素材详情失败:', error)
    uni.hideLoading()
    if (error?.code === 4100) {
      error.message = '内容已失效，无法访问'
    }
    // 加载失败，设置错误状态
    errorState.value = {
      hasError: true,
      errorCode: error?.code,
      errorMessage: error?.message || '加载失败',
    }
  }
  finally {
    // isInit.value = false  // 移除这里，在 onShow 中处理
  }
}

// 页面加载时获取素材详情和列表数据
onLoad(async (options) => {
  if (options?.id) {
    const assetsId = options.id
    // 保存当前素材ID用于刷新
    currentAssetsId.value = assetsId
    initSessionOnLoad()
    // 保存 URL 传入的 title
    if (options?.title) {
      urlTitle.value = decodeURIComponent(options.title as string)
    }
    // 如果有预加载的tabList，直接使用（所有页面现在都通过preloadedTabList传入数据）
    if (worksDetailsStore.preloadedTabList) {
      tabList.value = worksDetailsStore.preloadedTabList
      // 清空预加载的tabList，避免影响后续操作
      worksDetailsStore.preloadedTabList = null
      // 匹配并激活对应的Tab项
      activateTabById(assetsId)
    }
    // 列表加载完成后再加载当前素材详情（如果有预加载数据则使用）
    await loadAssetDetail(assetsId, true)
    // 初始化时预加载前后3项
    const currentIndex = tabList.value.findIndex(item => item.id === assetsId)
    if (currentIndex !== -1) {
      preloadAdjacentDetails(currentIndex)
    }
  }
})

/**
 * 根据ID激活对应的Tab项并滚动到可视范围
 */
function activateTabById(assetsId: number | string) {
  // 在tabList中查找匹配的项
  const index = tabList.value.findIndex(item => item.id === assetsId)
  if (index !== -1) {
    // 找到匹配的项，激活它
    currentTabIndex.value = index
    // TODO: 滚动到可视范围（需要BottomTabBar组件支持）
  }
  else {
    console.warn('未找到匹配的Tab项:', assetsId)
  }
}

// 页面卸载时清除store数据
onUnload(() => {
  destroySession()
  worksDetailsStore.clearAll()
  // 清除详情缓存
  detailCache.clear()
})

// 分享上报函数
function reportShare() {
  if (assetsDetail.value) {
    assetsShare({ assetsId: assetsDetail.value.assetsId })
      .then(() => {
        // 更新本地分享数
        assetsDetail.value!.shareCountFormatted = incrementFormattedCount(assetsDetail.value!.shareCountFormatted)
      })
      .catch((error) => {
        console.error('分享统计上报失败:', error)
      })
  }
}

// 分享功能
onShareAppMessage(() => {
  const shareTitle = assetsDetail.value?.ip?.name || import.meta.env.VITE_APP_TITLE || ''
  let shareImage = ''

  if (assetsDetail.value?.shareUrl) {
    shareImage = assetsDetail.value.shareUrl
  }
  else {
    // #ifdef MP-TOUTIAO
    shareImage = getImgUrl('/assets/mp/temp/tt_share.png')
    // #endif
    // #ifdef MP-WEIXIN
    shareImage = getImgUrl('/assets/mp/temp/wx_share.png')
    // #endif
    // #ifndef MP-TOUTIAO || MP-WEIXIN
    shareImage = assetsDetail.value?.previewUrl || ''
    // #endif
  }
  const sharePath = `/pages/worksDetails/index?id=${assetsDetail.value?.assetsId || ''}`

  // #ifdef MP-WEIXIN
  // 微信小程序：立即上报（微信小程序 success 回调不可靠）
  reportShare()
  // #endif

  return {
    title: shareTitle,
    path: sharePath,
    imageUrl: shareImage,
    // imageUrl: 'https://genesis-yq-test.oss-cn-shenzhen.aliyuncs.com/user_assets/29/2026/03/27/thumb/1774581243778_HLGZZ5_图片_resize_l200.jpg',
    // #ifdef MP-TOUTIAO
    // 抖音小程序：使用 success 回调上报
    success: () => {
      reportShare()
    },
    // #endif
  }
})

// 获取视频上下文
function getVideoContext() {
  if (mediaType.value === 'video' && assetsDetail.value?.previewUrl) {
    videoContext = uni.createVideoContext(`video-${assetsDetail.value.previewUrl}`, {})
  }
  return videoContext
}

/**
 * 媒体加载错误处理
 */
// function handleMediaError(error: any) {
//   errorState.value = {
//     hasError: true,
//     errorCode: error?.errMsg || error?.code || 1,
//     errorMessage: error?.errMsg || '加载失败',
//   }
// }

/**
 * 刷新按钮点击处理
 */
function handleRefresh() {
  console.log('刷新素材详情:', currentAssetsId.value)
  if (currentAssetsId.value) {
    detailCache.delete(currentAssetsId.value)
    loadAssetDetail(currentAssetsId.value, false, false)
  }
}

// 页面隐藏时停止视频并暂停消费计时
onHide(() => {
  pauseSession()
  const ctx = getVideoContext()
  if (ctx) {
    ctx.pause()
    videoState.value.isPlaying = false
  }
})

// 页面显示时恢复消费计时并重新获取详情数据、播放视频
onShow(() => {
  resumeSession()
  // 隐藏下载进度条
  downloadProgress.value.show = false
  downloadProgress.value.status = 'downloading'
  // 重新获取详情数据
  if (assetsDetail.value?.assetsId && !isInit.value) {
    loadAssetDetail(assetsDetail.value.assetsId, false, false)
  }
  // 获取关注状态（如果有creator.id）
  // if (assetsDetail.value?.creator?.id) {
  //   getFollowRelation({ followedMemberId: assetsDetail.value.creator.id })
  //     .then((res) => {
  //       // 更新本地关注状态
  //       if (assetsDetail.value?.creator) {
  //         assetsDetail.value.creator.followed = res.isFollowed
  //       }
  //     })
  //     .catch((error) => {
  //       console.error('获取关注关系失败:', error)
  //     })
  // }
  if (mediaType.value === 'video') {
    const ctx = getVideoContext()
    if (ctx) {
      ctx.play()
      videoState.value.isPlaying = true
    }
  }
  // 首次 onShow 执行后标记初始化完成，防止 onLoad 中 loadAssetDetail 完成后触发重复加载
  isInit.value = false
})
</script>

<template>
  <view class="relative h-screen w-full overflow-hidden bg-black">
    <!-- IP名称标题 -->
    <custom-title :text="pageTitle" text-color="text-white" />
    <CommonHeader mode="fixed" :scroll-top="0" bg-gradient="linear-gradient(to bottom, rgba(24, 24, 24, 1), rgba(24, 24, 24, 0))" />

    <!-- 预览面板 -->
    <PreviewPanel
      :media-url="assetsDetail?.previewUrl || ''"
      :temp-url="tempPreviewUrl"
      :media-type="mediaType"
      :label="copyrightLabel"
      :label-top="labelTop"
      :show-watermark="false"
      :has-error="errorState.hasError"
      :error-code="errorState.errorCode"
      :error-msg="errorState.errorMessage"
      :switch-locked="isAssetSwitching"
      @toggle-mute="handleToggleMute"
      @image-load="onPreviewImageLoad"
      @video-play="onVideoPlay"
      @video-ready="onVideoReady"
      @video-metadata="onVideoMetadata"
      @video-time-update="onVideoTimeUpdate"
      @touch-start="handleTouchStart"
      @touch-move="handleTouchMove"
      @touch-end="handleTouchEnd"
      @refresh="handleRefresh"
    />

    <!-- 右侧交互面板 -->
    <RightInteractionPanel
      v-if="!errorState.hasError"
      :key="assetsDetail?.assetsId"
      :author="authorInfo"
      :stats="statsInfo"
      :liked="assetsDetail?.liked || false"
      :favorited="assetsDetail?.favorited || false"
      @follow="handleFollow"
      @like="handleLike"
      @favorite="handleFavorite"
      @download="handleDownload"
    />

    <!-- 底部 TabBar - 从首页进来的不显示 -->
    <BottomTabBar
      ref="bottomTabBarRef"
      :tabs="tabList"
      :current-index="currentTabIndex"
      :has-prev="paginationState.hasPrev"
      :has-next="paginationState.hasNext"
      :switch-locked="isAssetSwitching"
      @change="handleTabChange"
    />

    <!-- 下载进度条 -->
    <view
      v-if="downloadProgress.show && downloadProgress.status === 'downloading'"
      class="fixed left-1/2 top-1/2 z-50 flex flex-col items-center justify-center rounded-32rpx"
      style="background-color: rgba(0, 0, 0, 0.8);transform: translate(-50%, -50%);width: 308rpx;height: 330rpx;"
    >
      <u-circle-progress
        :percent="downloadProgress.percent"
        :width="180"
        :border-width="20"
        inactive-color="rgba(102, 102, 102, 0.4)"
        active-color="#fff"
        bg-color="transparent"
        duration="500"
      >
        <text class="text-32rpx text-white font-bold">{{ Math.round(downloadProgress.percent) }}%</text>
      </u-circle-progress>
      <text class="mt-32rpx text-32rpx text-white">下载中</text>
    </view>

    <!-- 保存成功弹窗 -->
    <u-popup
      v-model="showSuccessPopup"
      mode="center"
      :zoom="false"
      :mask-close-able="false"
      :closeable="false"
      border-radius="32"
      width="580rpx"
      height="auto"
    >
      <view class="flex flex-col items-center px-40rpx py-60rpx">
        <image src="/static/images/save_success.png" mode="aspectFit" class="h-120rpx w-120rpx" />
        <text class="mt-16rpx text-36rpx text-[#333] font-semibold">保存成功</text>
        <text class="mt-24rpx text-left text-28rpx text-[#999] line-height-44rpx">
          请在手机相册或照片内查看对应内容，如未发现可尝试在手机文件内进行查找，部分机型需要等待3分钟方可找到~
        </text>
        <view class="mt-40rpx w-full flex items-center justify-center rounded-full bg-[#333] px-40rpx py-24rpx" @tap="closeSuccessPopup">
          <text class="text-32rpx text-white font-semibold">我知道了</text>
        </view>
      </view>
    </u-popup>
  </view>
</template>

<style scoped lang="scss">
/* 页面容器基础样式 */
</style>
