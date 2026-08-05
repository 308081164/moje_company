import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  confirmDebugPipelineStep,
  createDebugSession,
  createStandaloneDebugSession,
  debugStepPreviewUrl,
  deleteDebugSession,
  getDebugSession,
  runDebugPipelineStep,
  type DebugSessionInfo,
  type DebugStepResult,
} from '@/api'

export function useDebugPipeline() {
  const sessionId = ref<string | null>(null)
  const session = ref<DebugSessionInfo | null>(null)
  const loading = ref(false)
  const previewUrl = ref('')
  const previewMode = ref<'white' | 'colored'>('white')
  const lastStepResult = ref<DebugStepResult | null>(null)

  const currentStep = computed(() =>
    session.value?.steps?.find((s) => s.is_current) ?? null
  )

  const isCompleted = computed(() => Boolean(session.value?.completed))

  async function refreshSession() {
    if (!sessionId.value) return
    const resp = await getDebugSession(sessionId.value)
    if (resp.code === 200 && resp.data) {
      session.value = resp.data
    }
  }

  function syncPreview(stepId: string, result?: DebugStepResult | null) {
    if (!sessionId.value) return
    const mode = result?.preview_mode === 'colored' ? 'colored' : 'white'
    previewMode.value = mode
    if (result?.success || result?.preview_path) {
      previewUrl.value = debugStepPreviewUrl(sessionId.value, stepId)
    }
  }

  async function startStandalone(
    rawMesh: File,
    inlayMesh: File,
    options?: { enableIcp?: boolean; enableAiPartSplit?: boolean }
  ) {
    loading.value = true
    try {
      const resp = await createStandaloneDebugSession(rawMesh, inlayMesh, options)
      if (resp.code !== 200 || !resp.data?.session_id) {
        throw new Error(resp.message || '创建调试会话失败')
      }
      sessionId.value = resp.data.session_id
      session.value = resp.data.session ?? null
      lastStepResult.value = null
      previewUrl.value = ''
      ElMessage.success('独立调试会话已创建')
      return resp.data
    } finally {
      loading.value = false
    }
  }

  async function start(sourceTaskId: string, enableAiPartSplit = true) {
    loading.value = true
    try {
      const resp = await createDebugSession(sourceTaskId, true, enableAiPartSplit)
      if (resp.code !== 200 || !resp.data?.session_id) {
        throw new Error(resp.message || '创建调试会话失败')
      }
      sessionId.value = resp.data.session_id
      session.value = resp.data.session ?? null
      lastStepResult.value = null
      previewUrl.value = ''
      ElMessage.success('已进入调试模式')
      return resp.data
    } finally {
      loading.value = false
    }
  }

  async function runCurrentStep(force = false) {
    const step = currentStep.value
    if (!sessionId.value || !step) {
      ElMessage.warning('无可执行步骤')
      return
    }
    loading.value = true
    try {
      const resp = await runDebugPipelineStep(sessionId.value, step.id, force)
      if (resp.code !== 200 || !resp.data) {
        throw new Error(resp.message || '步骤执行失败')
      }
      lastStepResult.value = resp.data
      await refreshSession()
      if (resp.data.success) {
        syncPreview(step.id, resp.data)
        ElMessage.success(`${step.name} 执行完成，请确认预览`)
      } else {
        ElMessage.error(resp.data.message || '步骤执行失败')
      }
      return resp.data
    } catch (err: unknown) {
      await refreshSession()
      const message = err instanceof Error ? err.message : '步骤执行失败'
      ElMessage.error(message)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function confirmCurrentStep() {
    const step = currentStep.value
    if (!sessionId.value || !step) return
    if (step.status !== 'awaiting_confirm' && step.status !== 'failed') {
      ElMessage.warning('请先执行本步并等待结果')
      return
    }
    loading.value = true
    try {
      const resp = await confirmDebugPipelineStep(sessionId.value, step.id)
      if (resp.code !== 200 || !resp.data) {
        throw new Error(resp.message || '确认失败')
      }
      session.value = resp.data
      lastStepResult.value = null
      const next = resp.data.steps?.find((s) => s.is_current)
      if (next && sessionId.value) {
        const prev = resp.data.steps?.find((s) => s.id === step.id)
        if (prev?.result?.success) {
          syncPreview(step.id, prev.result)
        }
      }
      if (resp.data.completed) {
        ElMessage.success('调试流水线已全部完成')
      } else {
        ElMessage.success('已确认，可执行下一步')
      }
    } finally {
      loading.value = false
    }
  }

  async function exit() {
    if (sessionId.value) {
      try {
        await deleteDebugSession(sessionId.value)
      } catch {
        /* ignore */
      }
    }
    sessionId.value = null
    session.value = null
    previewUrl.value = ''
    lastStepResult.value = null
  }

  return {
    sessionId,
    session,
    loading,
    previewUrl,
    previewMode,
    lastStepResult,
    currentStep,
    isCompleted,
    start,
    startStandalone,
    runCurrentStep,
    confirmCurrentStep,
    exit,
    refreshSession,
  }
}
