import { ref, computed } from 'vue'
import { getTaskDetail, type TaskDetail, type TaskStatus } from '@/api'

const SESSION_KEY = 'active_generation_task_id'
const POLL_INTERVAL_MS = 3000

const activeTask = ref<TaskDetail | null>(null)
const taskProgress = ref(0)
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollingTaskId: string | null = null

type TaskTerminalHandler = (detail: TaskDetail) => void
const onCompleteHandlers = new Set<TaskTerminalHandler>()
const onFailedHandlers = new Set<TaskTerminalHandler>()

export function isActiveTaskStatus(status: TaskStatus | string): boolean {
  return status === 'pending' || status === 'queued' || status === 'processing'
}

export function onActiveTaskComplete(handler: TaskTerminalHandler): () => void {
  onCompleteHandlers.add(handler)
  return () => onCompleteHandlers.delete(handler)
}

export function onActiveTaskFailed(handler: TaskTerminalHandler): () => void {
  onFailedHandlers.add(handler)
  return () => onFailedHandlers.delete(handler)
}

function persistTaskId(taskId: string) {
  sessionStorage.setItem(SESSION_KEY, taskId)
}

function clearPersistedTaskId() {
  sessionStorage.removeItem(SESSION_KEY)
}

function readPersistedTaskId(): string | null {
  return sessionStorage.getItem(SESSION_KEY)
}

function updateProgress(detail: TaskDetail) {
  if (detail.progress !== undefined) {
    taskProgress.value = detail.progress
  } else if (detail.status === 'pending' || detail.status === 'queued') {
    taskProgress.value = Math.min(taskProgress.value + 1, 10)
  } else if (detail.status === 'processing') {
    taskProgress.value = Math.min(taskProgress.value + 5, 95)
  }
}

function stopActiveTaskPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  pollingTaskId = null
}

async function pollOnce(taskId: string) {
  try {
    const res = await getTaskDetail(taskId)
    const detail = res.data
    activeTask.value = detail
    updateProgress(detail)

    if (detail.status === 'completed') {
      stopActiveTaskPolling()
      clearPersistedTaskId()
      taskProgress.value = 100
      onCompleteHandlers.forEach((handler) => handler(detail))
    } else if (detail.status === 'failed' || detail.status === 'cancelled') {
      stopActiveTaskPolling()
      clearPersistedTaskId()
      if (detail.status === 'failed') {
        onFailedHandlers.forEach((handler) => handler(detail))
      }
    }
  } catch {
    console.warn('轮询任务状态失败')
  }
}

export function startActiveTaskPolling(taskId: string, options?: { resetProgress?: boolean }) {
  if (options?.resetProgress !== false) {
    taskProgress.value = 0
  }
  persistTaskId(taskId)
  stopActiveTaskPolling()
  pollingTaskId = taskId

  void pollOnce(taskId)
  pollTimer = setInterval(() => {
    void pollOnce(taskId)
  }, POLL_INTERVAL_MS)
}

export async function resumeActiveTaskPolling(): Promise<TaskDetail | null> {
  const taskId = readPersistedTaskId()
  if (!taskId) return null

  if (pollTimer && pollingTaskId === taskId) {
    return activeTask.value
  }

  try {
    const res = await getTaskDetail(taskId)
    const detail = res.data
    activeTask.value = detail

    if (isActiveTaskStatus(detail.status)) {
      startActiveTaskPolling(taskId, { resetProgress: false })
    } else {
      clearPersistedTaskId()
      if (detail.status === 'completed') {
        taskProgress.value = 100
      }
    }
    return detail
  } catch {
    clearPersistedTaskId()
    return null
  }
}

export function clearActiveTask() {
  stopActiveTaskPolling()
  clearPersistedTaskId()
  activeTask.value = null
  taskProgress.value = 0
}

/** 终止轮询并保留任务详情（如用户取消后展示「已取消」状态） */
export function settleActiveTask(detail: TaskDetail) {
  stopActiveTaskPolling()
  clearPersistedTaskId()
  activeTask.value = detail
  if (detail.status === 'completed') {
    taskProgress.value = 100
  } else if (detail.status === 'cancelled' || detail.status === 'failed') {
    taskProgress.value = 0
  }
}

/** 若删除的任务正是首页轮询中的活跃任务，停止轮询 */
export function clearActiveTaskIfMatch(taskId: string) {
  const persisted = readPersistedTaskId()
  if (persisted === taskId || pollingTaskId === taskId) {
    clearActiveTask()
  }
}

export function useActiveGeneration() {
  const isGenerating = computed(() => {
    const task = activeTask.value
    return task != null && isActiveTaskStatus(task.status)
  })

  return {
    activeTask,
    taskProgress,
    isGenerating,
    startPolling: startActiveTaskPolling,
    stopPolling: stopActiveTaskPolling,
    resumePolling: resumeActiveTaskPolling,
    clearActiveTask,
    settleActiveTask,
    isActiveTaskStatus,
  }
}
