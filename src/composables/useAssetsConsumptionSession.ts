import type { Ref } from 'vue'
import { ConsumptionEntityType, ConsumptionEvent, consumptionReport } from '@/api/common/index'
import { generateUuid } from '@/utils/deviceId'

const COMPLETE_EPSILON_SEC = 0.3
const IMAGE_COMPLETE_MS = 3000
const STAY_3_MS = 3000
const STAY_10_MS = 10000

export interface AssetsConsumptionStartOptions {
  /** 是否为视频素材（fileType === 3） */
  isVideo: boolean
}

/**
 * 素材详情消费会话：每个素材独立 sessionId
 * - 非视频：ENTER + 3s 后 COMPLETE（不报 STAY_3S / STAY_10S）
 * - 视频：按时长 D 决定 STAY_3S(D>3)、STAY_10S(D>10)；COMPLETE 为观看 ≥ D
 * - 页面 onHide 暂停停留计时，onShow 按剩余时间继续
 */
export function useAssetsConsumptionSession(
  contentId: Ref<string | number>,
  isSessionValid: Ref<boolean>,
) {
  let sessionId = ''
  let sessionStarted = false
  let isVideoSession = false
  let videoDurationSec = 0
  let stayTimersScheduled = false
  let isPaused = false
  const reportedEvents = new Set<ConsumptionEvent>()

  let imageCompleteDueAt = 0
  let stay3DueAt = 0
  let stay10DueAt = 0
  /** 暂停时冻结的剩余毫秒（仅统计页面可见时长） */
  let imageCompleteRemainingMs: number | null = null
  let stay3RemainingMs: number | null = null
  let stay10RemainingMs: number | null = null

  let imageCompleteTimer: ReturnType<typeof setTimeout> | null = null
  let stay3Timer: ReturnType<typeof setTimeout> | null = null
  let stay10Timer: ReturnType<typeof setTimeout> | null = null

  function clearTimerHandles() {
    if (imageCompleteTimer) {
      clearTimeout(imageCompleteTimer)
      imageCompleteTimer = null
    }
    if (stay3Timer) {
      clearTimeout(stay3Timer)
      stay3Timer = null
    }
    if (stay10Timer) {
      clearTimeout(stay10Timer)
      stay10Timer = null
    }
  }

  function clearDeadlineState() {
    imageCompleteDueAt = 0
    stay3DueAt = 0
    stay10DueAt = 0
    imageCompleteRemainingMs = null
    stay3RemainingMs = null
    stay10RemainingMs = null
  }

  function resolveDueAt(
    dueAt: number,
    remainingMs: number | null,
    defaultMs: number,
  ): number {
    if (dueAt > 0)
      return dueAt
    if (remainingMs != null)
      return Date.now() + remainingMs
    return Date.now() + defaultMs
  }

  function snapshotRemainingOnPause() {
    if (imageCompleteDueAt > 0 && !reportedEvents.has(ConsumptionEvent.SHORT_COMPLETE)) {
      imageCompleteRemainingMs = Math.max(0, imageCompleteDueAt - Date.now())
      imageCompleteDueAt = 0
    }
    if (stay3DueAt > 0 && !reportedEvents.has(ConsumptionEvent.SHORT_STAY_3S)) {
      stay3RemainingMs = Math.max(0, stay3DueAt - Date.now())
      stay3DueAt = 0
    }
    if (stay10DueAt > 0 && !reportedEvents.has(ConsumptionEvent.SHORT_STAY_10S)) {
      stay10RemainingMs = Math.max(0, stay10DueAt - Date.now())
      stay10DueAt = 0
    }
  }

  function resetSessionState() {
    sessionStarted = false
    isVideoSession = false
    videoDurationSec = 0
    stayTimersScheduled = false
    isPaused = false
    reportedEvents.clear()
    clearTimerHandles()
    clearDeadlineState()
  }

  /** 进入页面或切换素材：生成新 sessionId */
  function initSessionOnLoad() {
    sessionId = generateUuid()
    resetSessionState()
  }

  /** 切换素材前：结束当前会话并准备新 sessionId */
  function resetSessionForNewAsset() {
    clearTimerHandles()
    initSessionOnLoad()
  }

  function reportEvent(event: ConsumptionEvent) {
    if (!isSessionValid.value || !contentId.value || !sessionId)
      return
    if (reportedEvents.has(event))
      return

    reportedEvents.add(event)
    consumptionReport({
      entityType: ConsumptionEntityType.ASSETS,
      contentId: contentId.value,
      sessionId,
      event,
      timestamp: Date.now(),
    }).catch((err) => {
      console.warn('[consumption]', event, err)
    })
  }

  function runAfterRemaining(
    dueAt: number,
    onDue: () => void,
  ): ReturnType<typeof setTimeout> | null {
    const remaining = dueAt - Date.now()
    if (remaining <= 0) {
      onDue()
      return null
    }
    return setTimeout(onDue, remaining)
  }

  function scheduleImageCompleteTimer() {
    if (reportedEvents.has(ConsumptionEvent.SHORT_COMPLETE) || isPaused)
      return

    imageCompleteDueAt = resolveDueAt(
      imageCompleteDueAt,
      imageCompleteRemainingMs,
      IMAGE_COMPLETE_MS,
    )
    imageCompleteRemainingMs = null

    if (imageCompleteTimer)
      clearTimeout(imageCompleteTimer)
    imageCompleteTimer = runAfterRemaining(imageCompleteDueAt, () => {
      imageCompleteTimer = null
      imageCompleteDueAt = 0
      reportEvent(ConsumptionEvent.SHORT_COMPLETE)
    })
  }

  function scheduleStay3Timer() {
    if (reportedEvents.has(ConsumptionEvent.SHORT_STAY_3S) || isPaused)
      return

    stay3DueAt = resolveDueAt(stay3DueAt, stay3RemainingMs, STAY_3_MS)
    stay3RemainingMs = null

    if (stay3Timer)
      clearTimeout(stay3Timer)
    stay3Timer = runAfterRemaining(stay3DueAt, () => {
      stay3Timer = null
      stay3DueAt = 0
      reportEvent(ConsumptionEvent.SHORT_STAY_3S)
    })
  }

  function scheduleStay10Timer() {
    if (reportedEvents.has(ConsumptionEvent.SHORT_STAY_10S) || isPaused)
      return

    stay10DueAt = resolveDueAt(stay10DueAt, stay10RemainingMs, STAY_10_MS)
    stay10RemainingMs = null

    if (stay10Timer)
      clearTimeout(stay10Timer)
    stay10Timer = runAfterRemaining(stay10DueAt, () => {
      stay10Timer = null
      stay10DueAt = 0
      reportEvent(ConsumptionEvent.SHORT_STAY_10S)
    })
  }

  function scheduleVideoStayTimers() {
    if (stayTimersScheduled || !isVideoSession || videoDurationSec <= 0)
      return

    stayTimersScheduled = true
    const D = videoDurationSec
    if (D > 3)
      scheduleStay3Timer()
    if (D > 10)
      scheduleStay10Timer()
  }

  function resumePendingTimers() {
    if (!sessionStarted || !isSessionValid.value)
      return

    if (!isVideoSession) {
      if (!reportedEvents.has(ConsumptionEvent.SHORT_COMPLETE))
        scheduleImageCompleteTimer()
      return
    }

    const D = videoDurationSec
    if (D > 3 && !reportedEvents.has(ConsumptionEvent.SHORT_STAY_3S))
      scheduleStay3Timer()
    if (D > 10 && !reportedEvents.has(ConsumptionEvent.SHORT_STAY_10S))
      scheduleStay10Timer()
  }

  /** 页面隐藏：暂停停留类计时（冻结剩余时长，不清 session） */
  function pauseSession() {
    if (!sessionStarted || isPaused)
      return
    isPaused = true
    snapshotRemainingOnPause()
    clearTimerHandles()
  }

  /** 页面再次显示：按剩余时间继续计时 */
  function resumeSession() {
    if (!sessionStarted || !isPaused)
      return
    if (!isSessionValid.value)
      return

    isPaused = false
    resumePendingTimers()
  }

  /** 详情加载成功且可访问时启动 */
  function tryStartSession(options: AssetsConsumptionStartOptions) {
    if (sessionStarted || !isSessionValid.value || !contentId.value)
      return

    sessionStarted = true
    isVideoSession = options.isVideo
    reportEvent(ConsumptionEvent.SHORT_ENTER)

    if (!isVideoSession) {
      scheduleImageCompleteTimer()
      return
    }

    if (videoDurationSec > 0)
      scheduleVideoStayTimers()
  }

  /** 视频元数据就绪后注册停留计时 */
  function onVideoDurationKnown(durationSec: number) {
    if (!Number.isFinite(durationSec) || durationSec <= 0)
      return

    videoDurationSec = durationSec
    if (sessionStarted && isVideoSession && !isPaused)
      scheduleVideoStayTimers()
  }

  /** 播放进度更新：达到视频时长视为完整浏览 */
  function checkVideoWatchComplete(currentTime: number, durationFromEvent?: number) {
    if (!sessionStarted || !isVideoSession || isPaused)
      return

    const D = (durationFromEvent && durationFromEvent > 0)
      ? durationFromEvent
      : videoDurationSec
    if (D <= 0)
      return

    if (currentTime >= D - COMPLETE_EPSILON_SEC)
      reportEvent(ConsumptionEvent.SHORT_COMPLETE)
  }

  function destroySession() {
    clearTimerHandles()
  }

  return {
    initSessionOnLoad,
    resetSessionForNewAsset,
    tryStartSession,
    onVideoDurationKnown,
    checkVideoWatchComplete,
    pauseSession,
    resumeSession,
    destroySession,
  }
}
