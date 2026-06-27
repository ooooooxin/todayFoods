import type { Ref } from 'vue'
import type { ConsumptionEntityType } from '@/api/common/index'
import { ConsumptionEvent, consumptionReport } from '@/api/common/index'
import { generateUuid } from '@/utils/deviceId'

const STAY_3_MS = 3000
const STAY_10_MS = 10000

/**
 * 短内容消费会话：onLoad 生成 sessionId，会话有效期间按事件去重上报
 * - onHide 暂停 3s/10s 停留计时，onShow 按剩余可见时长继续
 * - 10s 前触底：暂不上报 COMPLETE，记触底；满 10s 时只报 COMPLETE、不报 STAY_10S
 * - 满 10s 时未触底：照常报 STAY_10S；之后触底再报 COMPLETE
 */
export function useConsumptionSession(
  entityType: ConsumptionEntityType,
  contentId: Ref<string | number>,
  isSessionValid: Ref<boolean>,
) {
  let sessionId = ''
  let sessionStarted = false
  let isPaused = false
  /** 10s 停留事件触发前已触底（用于 COMPLETE 与 STAY_10S 互斥逻辑） */
  let reachedBottomBeforeStay10 = false
  const reportedEvents = new Set<ConsumptionEvent>()

  let stay3DueAt = 0
  let stay10DueAt = 0
  let stay3RemainingMs: number | null = null
  let stay10RemainingMs: number | null = null

  let stay3Timer: ReturnType<typeof setTimeout> | null = null
  let stay10Timer: ReturnType<typeof setTimeout> | null = null

  function clearTimerHandles() {
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
    stay3DueAt = 0
    stay10DueAt = 0
    stay3RemainingMs = null
    stay10RemainingMs = null
  }

  function resetSessionState() {
    sessionStarted = false
    isPaused = false
    reachedBottomBeforeStay10 = false
    reportedEvents.clear()
    clearTimerHandles()
    clearDeadlineState()
  }

  function isStay10Satisfied() {
    return reportedEvents.has(ConsumptionEvent.SHORT_STAY_10S)
  }

  function onStay10TimerDue() {
    if (reachedBottomBeforeStay10) {
      reportEvent(ConsumptionEvent.SHORT_COMPLETE)
      return
    }
    reportEvent(ConsumptionEvent.SHORT_STAY_10S)
  }

  function shouldScheduleStay10Timer() {
    if (reportedEvents.has(ConsumptionEvent.SHORT_COMPLETE))
      return false
    if (reportedEvents.has(ConsumptionEvent.SHORT_STAY_10S))
      return false
    return true
  }

  /** onLoad：生成本次访问的 sessionId */
  function initSessionOnLoad() {
    sessionId = generateUuid()
    resetSessionState()
  }

  function reportEvent(event: ConsumptionEvent) {
    if (!isSessionValid.value || !contentId.value || !sessionId)
      return
    if (reportedEvents.has(event))
      return

    reportedEvents.add(event)
    consumptionReport({
      entityType,
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
    if (stay3DueAt > 0 && !reportedEvents.has(ConsumptionEvent.SHORT_STAY_3S)) {
      stay3RemainingMs = Math.max(0, stay3DueAt - Date.now())
      stay3DueAt = 0
    }
    if (stay10DueAt > 0 && shouldScheduleStay10Timer()) {
      stay10RemainingMs = Math.max(0, stay10DueAt - Date.now())
      stay10DueAt = 0
    }
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
    if (!shouldScheduleStay10Timer() || isPaused)
      return

    stay10DueAt = resolveDueAt(stay10DueAt, stay10RemainingMs, STAY_10_MS)
    stay10RemainingMs = null

    if (stay10Timer)
      clearTimeout(stay10Timer)
    stay10Timer = runAfterRemaining(stay10DueAt, () => {
      stay10Timer = null
      stay10DueAt = 0
      onStay10TimerDue()
    })
  }

  function scheduleStayTimers() {
    scheduleStay3Timer()
    scheduleStay10Timer()
  }

  function resumePendingTimers() {
    if (!sessionStarted || !isSessionValid.value)
      return
    if (!reportedEvents.has(ConsumptionEvent.SHORT_STAY_3S))
      scheduleStay3Timer()
    if (shouldScheduleStay10Timer())
      scheduleStay10Timer()
  }

  /** 页面隐藏：暂停停留计时 */
  function pauseSession() {
    if (!sessionStarted || isPaused)
      return
    isPaused = true
    snapshotRemainingOnPause()
    clearTimerHandles()
  }

  /** 页面再次显示：按剩余可见时长继续 */
  function resumeSession() {
    if (!sessionStarted || !isPaused)
      return
    if (!isSessionValid.value)
      return

    isPaused = false
    resumePendingTimers()
  }

  /** 详情加载成功且非下架时启动会话（ENTER + 停留计时） */
  function tryStartSession() {
    if (sessionStarted || !isSessionValid.value || !contentId.value)
      return

    sessionStarted = true
    reportEvent(ConsumptionEvent.SHORT_ENTER)
    scheduleStayTimers()
  }

  function reportReachBottomComplete() {
    if (isPaused)
      return
    if (reportedEvents.has(ConsumptionEvent.SHORT_COMPLETE))
      return

    // 10s 前触底：延后 COMPLETE，满 10s 时与 STAY_10S 合并为只报 COMPLETE
    if (!isStay10Satisfied()) {
      reachedBottomBeforeStay10 = true
      return
    }

    reportEvent(ConsumptionEvent.SHORT_COMPLETE)
  }

  function destroySession() {
    clearTimerHandles()
  }

  return {
    initSessionOnLoad,
    tryStartSession,
    reportReachBottomComplete,
    pauseSession,
    resumeSession,
    destroySession,
  }
}
