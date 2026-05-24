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
      title="任务详情"
      width="600px"
      destroy-on-close
    >
      <div v-if="taskDetail" class="detail-content">
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
            {{ taskDetail.inlay_file || '未使用' }}
          </el-descriptions-item>
          <el-descriptions-item v-if="taskDetail.error_message" label="错误信息" :span="2">
            <span class="error-message">{{ taskDetail.error_message }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <!-- 3D模型预览 -->
        <div v-if="taskDetail.status === 'completed'" class="detail-preview">
          <h4>3D模型预览</h4>
          <div class="detail-model-wrapper">
            <ModelViewer
              :model-url="`/api/tasks/${taskDetail.task_id}/download`"
              :model-format="taskDetail.output_format || 'GLB'"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="taskDetail?.status === 'completed'"
          type="success"
          :icon="Download"
          @click="handleDownload(taskDetail!.task_id)"
        >
          下载模型
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { List, Download } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TaskList from '@/components/TaskList.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import {
  getTaskDetail,
  downloadResult as downloadResultApi,
  deleteTask as deleteTaskApi,
  type TaskDetail,
} from '@/api'

// ==========================================
// 状态
// ==========================================

const taskListRef = ref<InstanceType<typeof TaskList> | null>(null)
const detailVisible = ref(false)
const taskDetail = ref<TaskDetail | null>(null)

// ==========================================
// 方法
// ==========================================

/** 查看任务详情 */
async function viewDetail(taskId: string) {
  try {
    const res = await getTaskDetail(taskId)
    taskDetail.value = res.data
    detailVisible.value = true
  } catch {
    ElMessage.error('获取任务详情失败')
  }
}

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

/** 删除任务 */
async function handleDelete(taskId: string) {
  try {
    await ElMessageBox.confirm(
      '确定要删除该任务吗？删除后无法恢复。',
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    await deleteTaskApi(taskId)
    ElMessage.success('任务已删除')
    // 刷新列表
    taskListRef.value?.refresh()
  } catch (err: any) {
    // 用户取消操作
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

/** 获取状态标签类型 */
function getStatusType(status: string): 'info' | 'warning' | 'success' | 'danger' {
  const map: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
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
</script>

<style scoped>
.tasks-view {
  display: flex;
  flex-direction: column;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
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

.detail-model-wrapper {
  width: 100%;
  height: 360px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
</style>
