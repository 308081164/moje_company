<template>
  <div class="tasks-view">
    <h2 class="page-title">
      <el-icon><List /></el-icon>
      任务管理
    </h2>

    <!-- 任务列表 -->
    <div class="page-card">
      <TaskList
        ref="taskListRef"
        @view-detail="viewDetail"
        @download="handleDownload"
        @delete="handleDelete"
      />
    </div>

    <!-- 任务详情对话框 -->
    <el-dialog
      v-model="detailVisible"
      width="640px"
      destroy-on-close
      :close-on-press-escape="!detailPreviewFullscreen"
    >
      <template #header>
        <div class="detail-dialog-header">
          <span class="detail-dialog-title">任务详情</span>
          <div
            v-if="showDetailNav"
            class="detail-nav"
          >
            <el-button
              size="small"
              :icon="ArrowLeft"
              :disabled="!hasPrevDetail || detailLoading"
              @click="navigateDetail('prev')"
            >
              上一条
            </el-button>
            <span class="detail-nav-position">{{ detailNavLabel }}</span>
            <el-button
              size="small"
              :disabled="!hasNextDetail || detailLoading"
              @click="navigateDetail('next')"
            >
              下一条
              <el-icon class="el-icon--right"><ArrowRight /></el-icon>
            </el-button>
          </div>
        </div>
      </template>

      <div v-if="taskDetail" v-loading="detailLoading" class="detail-content">
        <!-- 基本信息 -->
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务ID" :span="2">
            <span class="detail-task-id">{{ taskDetail.task_id }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="输入文件">
            {{ taskDetail.input_file || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="输出格式">
            {{ taskDetail.output_format || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag
              :type="getStatusType(taskDetail.status)"
              :class="getStatusClass(taskDetail.status)"
              round
            >
              {{ getStatusLabel(taskDetail.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="进度">
            <el-progress
              v-if="taskDetail.status === 'processing'"
              :percentage="taskDetail.progress || 0"
              :stroke-width="12"
              style="width: 200px"
            />
            <span v-else>{{ taskDetail.status === 'completed' ? '100%' : '-' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatTime(taskDetail.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatTime(taskDetail.updated_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="提示词" :span="2">
            {{ taskDetail.prompt || '无' }}
          </el-descriptions-item>
          <el-descriptions-item label="镶嵌结构" :span="2">
            {{ formatInlayLabel(taskDetail.inlay_file) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="taskDetail.error_message" label="错误信息" :span="2">
            <span class="error-message">{{ taskDetail.error_message }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 3D模型预览 -->
        <div v-if="taskDetail.status === 'completed'" class="detail-preview">
          <h4>3D模型预览</h4>
          <div
            class="detail-preview-viewer"
            :class="{ 'is-fullscreen': detailPreviewFullscreen }"
          >
            <div v-if="showDetailPreviewToggle" class="detail-preview-toolbar">
              <el-radio-group v-model="detailPreviewMode" size="small">
                <el-radio-button value="colored">分色预览</el-radio-button>
                <el-radio-button value="white">白模预览</el-radio-button>
              </el-radio-group>
              <span v-if="detailPreviewMode === 'colored'" class="preview-legend">
                <span class="legend-swatch legend-inlay" />镶嵌结构（戒圈/镶口等 CAD 部件）
                <span class="legend-swatch legend-generated" />AI 生成主体（戒臂/托架等）
              </span>
            </div>
            <div class="detail-model-wrapper">
              <ModelViewer
                v-if="detailModelPreviewUrl"
                :key="taskDetail.task_id"
                :model-url="detailModelPreviewUrl"
                :model-format="detailModelPreviewFormat"
                :preview-mode="showDetailPreviewToggle ? detailPreviewMode : 'white'"
                @error="onDetailModelPreviewError"
              >
                <template #toolbar-extra>
                  <el-button
                    size="small"
                    :icon="detailPreviewFullscreen ? Close : FullScreen"
                    :title="detailPreviewFullscreen ? '退出全屏 (Esc)' : '全屏预览'"
                    @click="toggleDetailPreviewFullscreen"
                  />
                </template>
              </ModelViewer>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="detail-dialog-footer">
          <el-button
            type="danger"
            :icon="Delete"
            :loading="detailDeleting"
            :disabled="detailLoading || !taskDetail"
            @click="handleDetailDelete"
          >
            删除任务
          </el-button>
          <div class="detail-dialog-footer-actions">
            <el-button @click="detailVisible = false">关闭</el-button>
            <el-button
              v-if="taskDetail?.status === 'completed'"
              type="success"
              :icon="Download"
              @click="handleDownload(taskDetail!.task_id)"
            >
              下载模型
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { List, Download, Delete, ArrowLeft, ArrowRight, FullScreen, Close } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TaskList from '@/components/TaskList.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import {
  getTaskDetail,
  downloadResult as downloadResultApi,
  deleteTask as deleteTaskApi,
  type TaskDetail,
} from '@/api'
import { verifyDeletePassword } from '@/utils/deleteAuth'

// ==========================================
// 状态
// ==========================================

const taskListRef = ref<InstanceType<typeof TaskList> | null>(null)
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailDeleting = ref(false)
const taskDetail = ref<TaskDetail | null>(null)
const detailPreviewMode = ref<'white' | 'colored'>('colored')
const detailPreviewFullscreen = ref(false)

function notifyViewerResize() {
  nextTick(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  })
}

function setDetailPreviewFullscreen(on: boolean) {
  detailPreviewFullscreen.value = on
  document.body.style.overflow = on ? 'hidden' : ''
  notifyViewerResize()
}

function toggleDetailPreviewFullscreen() {
  setDetailPreviewFullscreen(!detailPreviewFullscreen.value)
}

const currentPageTaskIds = computed(() => taskListRef.value?.getCurrentPageTaskIds?.() ?? [])

const currentDetailIndex = computed(() => {
  if (!taskDetail.value) return -1
  return currentPageTaskIds.value.indexOf(taskDetail.value.task_id)
})

const hasPrevDetail = computed(() => currentDetailIndex.value > 0)

const hasNextDetail = computed(() => {
  const index = currentDetailIndex.value
  return index >= 0 && index < currentPageTaskIds.value.length - 1
})

const showDetailNav = computed(
  () => currentPageTaskIds.value.length > 1 && currentDetailIndex.value >= 0
)

const detailNavLabel = computed(() => {
  const index = currentDetailIndex.value
  const total = currentPageTaskIds.value.length
  if (index < 0 || total === 0) return ''
  return `${index + 1} / ${total}`
})

const detailModelPreviewUrl = computed(() => {
  if (!taskDetail.value) return ''
  if (taskDetail.value.preview_url) {
    return taskDetail.value.preview_url
  }
  return `/api/tasks/${taskDetail.value.task_id}/download`
})

const detailModelPreviewFormat = computed((): 'GLB' | 'OBJ' | 'STL' => {
  if (!taskDetail.value) return 'GLB'
  if (taskDetail.value.preview_url) return 'GLB'
  const fmt = (taskDetail.value.output_format || 'GLB').toUpperCase()
  if (fmt === 'OBJ' || fmt === 'STL') return fmt
  return 'GLB'
})

const showDetailPreviewToggle = computed(
  () =>
    Boolean(taskDetail.value?.status === 'completed') &&
    Boolean(taskDetail.value?.preview_url)
)

// ==========================================
// 方法
// ==========================================

/** 加载任务详情（翻页时复用） */
async function loadTaskDetail(taskId: string, options?: { openDialog?: boolean }) {
  detailLoading.value = true
  try {
    const res = await getTaskDetail(taskId)
    taskDetail.value = res.data
    detailPreviewMode.value = 'colored'
    if (options?.openDialog) {
      detailVisible.value = true
    }
  } catch {
    ElMessage.error('获取任务详情失败')
  } finally {
    detailLoading.value = false
  }
}

/** 分色 GLB 预览失败时回退到白模下载 */
function onDetailModelPreviewError(message: string) {
  if (!taskDetail.value?.task_id || !detailModelPreviewUrl.value.includes('/preview')) {
    return
  }
  console.warn('colored GLB preview failed:', message)
  ElMessage.warning(`分色预览加载失败：${message}，已切换为白模预览`)
  taskDetail.value = {
    ...taskDetail.value,
    preview_url: undefined,
  }
  detailPreviewMode.value = 'white'
}

/** 查看任务详情 */
async function viewDetail(taskId: string) {
  await loadTaskDetail(taskId, { openDialog: true })
}

/** 在当前页任务列表中切换上一条/下一条 */
async function navigateDetail(direction: 'prev' | 'next') {
  const ids = currentPageTaskIds.value
  const index = currentDetailIndex.value
  if (index < 0) return

  const nextIndex = direction === 'prev' ? index - 1 : index + 1
  if (nextIndex < 0 || nextIndex >= ids.length) return

  await loadTaskDetail(ids[nextIndex])
}

function handleDetailKeydown(event: KeyboardEvent) {
  if (!detailVisible.value || detailLoading.value) return

  const target = event.target as HTMLElement | null
  if (
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  ) {
    return
  }

  if (event.key === 'Escape' && detailPreviewFullscreen.value) {
    event.preventDefault()
    setDetailPreviewFullscreen(false)
    return
  }

  if (event.key === 'ArrowLeft' && hasPrevDetail.value) {
    event.preventDefault()
    navigateDetail('prev')
  } else if (event.key === 'ArrowRight' && hasNextDetail.value) {
    event.preventDefault()
    navigateDetail('next')
  }
}

watch(detailVisible, (visible) => {
  if (visible) {
    window.addEventListener('keydown', handleDetailKeydown)
  } else {
    window.removeEventListener('keydown', handleDetailKeydown)
    if (detailPreviewFullscreen.value) {
      setDetailPreviewFullscreen(false)
    }
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleDetailKeydown)
  if (detailPreviewFullscreen.value) {
    document.body.style.overflow = ''
  }
})

/** 下载任务结果 */
async function handleDownload(taskId: string) {
  try {
    const blob = await downloadResultApi(taskId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 从详情中获取格式，或默认使用glb
    const format = taskDetail.value?.output_format || 'glb'
    a.download = `model_${taskId.substring(0, 8)}.${format.toLowerCase()}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('下载成功')
  } catch {
    ElMessage.error('下载失败')
  }
}

/** 删除任务（列表操作） */
async function handleDelete(taskId: string) {
  const verified = await verifyDeletePassword()
  if (!verified) return

  try {
    await ElMessageBox.confirm(
      '确定要永久删除该任务吗？任务记录与关联产物将被彻底删除，无法恢复。',
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await deleteTaskApi(taskId)
    ElMessage.success('任务已永久删除')
    taskListRef.value?.refresh()
  } catch (err: unknown) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

/** 删除任务（详情弹窗） */
async function handleDetailDelete() {
  if (!taskDetail.value || detailDeleting.value || detailLoading.value) return

  const verified = await verifyDeletePassword()
  if (!verified) return

  const deletedTaskId = taskDetail.value.task_id
  const deletedIndex = currentDetailIndex.value

  try {
    await ElMessageBox.confirm(
      '确定永久删除该任务？任务记录与关联产物将被彻底删除，无法恢复。',
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch {
    return
  }

  detailDeleting.value = true
  try {
    await deleteTaskApi(deletedTaskId)
    ElMessage.success('任务已永久删除')
    await taskListRef.value?.refresh()

    const ids = currentPageTaskIds.value
    if (ids.length === 0) {
      detailVisible.value = false
      taskDetail.value = null
      return
    }

    let nextIndex = -1
    if (deletedIndex >= 0) {
      if (deletedIndex < ids.length) {
        nextIndex = deletedIndex
      } else if (deletedIndex > 0) {
        nextIndex = deletedIndex - 1
      }
    }

    if (nextIndex >= 0) {
      await loadTaskDetail(ids[nextIndex])
    } else {
      detailVisible.value = false
      taskDetail.value = null
    }
  } catch {
    ElMessage.error('删除失败')
  } finally {
    detailDeleting.value = false
  }
}

/** 获取状态标签类型 */
function getStatusType(status: string): 'info' | 'warning' | 'success' | 'danger' {
  const map: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
    pending: 'info',
    queued: 'info',
    waiting: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
  }
  return map[status] || 'info'
}

/** 获取状态CSS类名 */
function getStatusClass(status: string): string {
  return `status-${status}`
}

/** 获取状态中文标签 */
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '等待中',
    queued: '排队中',
    waiting: '等待中',
    processing: '生成中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status] || status
}

/** 格式化时间 */
function formatTime(timeStr: string): string {
  if (!timeStr) return '-'
  const date = new Date(timeStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

/** 镶嵌结构展示文案（历史回填标记 colored_merge → 可读中文） */
function formatInlayLabel(inlayFile?: string | null): string {
  if (!inlayFile || !inlayFile.trim()) {
    return '未使用'
  }
  if (inlayFile === 'colored_merge') {
    return '已使用（分色融合）'
  }
  return inlayFile
}
</script>

<style scoped>
.tasks-view {
  display: flex;
  flex-direction: column;
}

.detail-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-right: 28px;
}

.detail-dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-nav-position {
  min-width: 52px;
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 120px;
}

.detail-task-id {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: var(--text-secondary);
}

.error-message {
  color: #f56c6c;
}

.detail-preview h4 {
  margin: 0 0 12px 0;
  color: var(--text-primary);
}

.detail-preview-viewer {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.detail-preview-viewer.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  width: 100vw;
  height: 100vh;
  padding: 16px;
  background: var(--card-bg);
  box-sizing: border-box;
}

.detail-preview-viewer.is-fullscreen .detail-preview-toolbar {
  flex-shrink: 0;
}

.detail-preview-viewer.is-fullscreen .detail-model-wrapper {
  flex: 1;
  height: auto;
  min-height: 0;
}

.detail-preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.preview-legend {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.legend-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 4px;
  flex-shrink: 0;
}

.legend-inlay {
  background: #e6a23c;
}

.legend-generated {
  background: #409eff;
  margin-left: 8px;
}

.detail-model-wrapper {
  width: 100%;
  height: 400px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.detail-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.detail-dialog-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
