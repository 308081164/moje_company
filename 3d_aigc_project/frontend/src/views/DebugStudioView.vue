<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Upload, Box, Camera } from '@element-plus/icons-vue'
import DebugPipelinePanel from '@/components/DebugPipelinePanel.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import { useDebugPipeline } from '@/composables/useDebugPipeline'

const route = useRoute()

const rawMeshFile = ref<File | null>(null)
const inlayMeshFile = ref<File | null>(null)
const enableIcp = ref(true)
const enableAiPartSplit = ref(true)
const starting = ref(false)

const {
  sessionId,
  session,
  loading,
  previewUrl,
  previewMode,
  lastStepResult,
  currentStep,
  start,
  startStandalone,
  runCurrentStep,
  confirmCurrentStep,
  exit,
} = useDebugPipeline()

const hasSession = computed(() => Boolean(sessionId.value))
const debugModelViewerRef = ref<InstanceType<typeof ModelViewer> | null>(null)
const exportingPreview = ref(false)

function onRawChange(file: File | null) {
  rawMeshFile.value = file
}

function onInlayChange(file: File | null) {
  inlayMeshFile.value = file
}

async function startSession() {
  if (!rawMeshFile.value || !inlayMeshFile.value) {
    ElMessage.warning('请上传 AI raw mesh 与镶嵌底座')
    return
  }
  starting.value = true
  try {
    await startStandalone(rawMeshFile.value, inlayMeshFile.value, {
      enableIcp: enableIcp.value,
      enableAiPartSplit: enableAiPartSplit.value,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '创建调试会话失败'
    ElMessage.error(msg)
  } finally {
    starting.value = false
  }
}

async function loadFromTask() {
  const taskId = route.query.task_id as string | undefined
  if (!taskId) return
  starting.value = true
  try {
    await start(taskId, enableAiPartSplit.value)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '从任务加载失败'
    ElMessage.error(msg)
  } finally {
    starting.value = false
  }
}

async function resetSession() {
  await exit()
  rawMeshFile.value = null
  inlayMeshFile.value = null
}

function formatTimestampForFilename(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}_${h}${min}${s}`
}

/** 导出当前 3D 预览为 16:9 PNG */
async function handleExportPreview() {
  const viewer = debugModelViewerRef.value
  if (!viewer?.capturePreviewPng) {
    ElMessage.warning('预览尚未就绪')
    return
  }

  exportingPreview.value = true
  try {
    const blob = await viewer.capturePreviewPng('16:9')
    if (!blob) {
      ElMessage.error('导出失败，请确保模型已加载')
      return
    }

    const prefix = currentStep.value?.id ?? sessionId.value ?? 'debug'
    const filename = `${prefix}_preview_${formatTimestampForFilename(new Date())}.png`
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('预览图已导出')
  } catch {
    ElMessage.error('导出预览图失败')
  } finally {
    exportingPreview.value = false
  }
}

if (route.query.task_id) {
  loadFromTask()
}
</script>

<template>
  <div class="debug-studio-page">
    <div class="page-header">
      <h2>对齐调试工作台</h2>
      <p class="page-desc">
        上传 AI raw mesh 与镶嵌底座，逐步执行对齐 / 融合流水线（无需先完成生成任务）。
      </p>
    </div>

    <div v-if="!hasSession" class="upload-section">
      <el-card shadow="never" class="upload-card">
        <div class="upload-row">
          <div class="upload-col">
            <h4>AI Raw Mesh</h4>
            <p class="hint">支持 OBJ / GLB / STL</p>
            <el-upload
              drag
              :auto-upload="false"
              :limit="1"
              accept=".obj,.glb,.stl,.ply"
              :on-change="(f) => onRawChange(f.raw as File)"
              :on-remove="() => onRawChange(null)"
            >
              <el-icon class="upload-icon"><Upload /></el-icon>
              <div>拖拽或点击上传</div>
            </el-upload>
          </div>
          <div class="upload-col">
            <h4>镶嵌底座</h4>
            <p class="hint">支持 GLB / OBJ / STL</p>
            <el-upload
              drag
              :auto-upload="false"
              :limit="1"
              accept=".obj,.glb,.stl"
              :on-change="(f) => onInlayChange(f.raw as File)"
              :on-remove="() => onInlayChange(null)"
            >
              <el-icon class="upload-icon"><Upload /></el-icon>
              <div>拖拽或点击上传</div>
            </el-upload>
          </div>
        </div>
        <div class="upload-options">
          <el-checkbox v-model="enableIcp">启用 ICP 精修</el-checkbox>
          <el-checkbox v-model="enableAiPartSplit">启用 AI 拆件</el-checkbox>
        </div>
        <el-button
          type="primary"
          size="large"
          :loading="starting"
          :disabled="!rawMeshFile || !inlayMeshFile"
          @click="startSession"
        >
          开始调试
        </el-button>
      </el-card>
    </div>

    <div v-else class="debug-studio-layout">
      <div class="studio-toolbar">
        <el-tag type="info" size="small">会话 {{ sessionId }}</el-tag>
        <el-button size="small" @click="resetSession">结束并重新上传</el-button>
      </div>
      <div class="studio-main">
        <DebugPipelinePanel
          :session="session"
          :loading="loading"
          :last-result="lastStepResult"
          @run="(force) => runCurrentStep(Boolean(force))"
          @confirm="confirmCurrentStep"
        />
        <div class="debug-preview-pane">
          <div class="debug-preview-header">
            <span>步骤预览</span>
            <div class="debug-preview-header-actions">
              <el-tag size="small" effect="plain">
                {{ previewMode === 'colored' ? '分色' : '白模' }}
              </el-tag>
              <el-button
                v-if="previewUrl"
                size="small"
                :icon="Camera"
                :loading="exportingPreview"
                @click="handleExportPreview"
              >
                导出预览图
              </el-button>
            </div>
          </div>
          <ModelViewer
            v-if="previewUrl"
            ref="debugModelViewerRef"
            :key="previewUrl"
            :model-url="previewUrl"
            model-format="GLB"
            :preview-mode="previewMode"
          />
          <div v-else class="debug-preview-empty">
            <el-icon :size="48"><Box /></el-icon>
            <p>点击左侧「执行本步」后在此查看 3D 预览</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-studio-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px 24px 32px;
}

.page-header h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.page-desc {
  margin: 0 0 20px;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.upload-card {
  padding: 8px;
}

.upload-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 16px;
}

.upload-col h4 {
  margin: 0 0 4px;
}

.hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.upload-icon {
  font-size: 40px;
  color: var(--el-color-primary);
  margin-bottom: 8px;
}

.upload-options {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
}

.debug-studio-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.studio-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.studio-main {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 16px;
  min-height: 520px;
}

.debug-preview-pane {
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--el-fill-color-blank);
}

.debug-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-weight: 500;
}

.debug-preview-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.debug-preview-pane :deep(.model-viewer) {
  flex: 1;
  min-height: 460px;
}

.debug-preview-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--el-text-color-secondary);
  gap: 12px;
  min-height: 460px;
}

@media (max-width: 900px) {
  .upload-row,
  .studio-main {
    grid-template-columns: 1fr;
  }
}
</style>
