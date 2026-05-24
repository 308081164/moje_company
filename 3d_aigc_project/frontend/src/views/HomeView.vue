<template>
  <div class="home-view">
    <h2 class="page-title">
      <el-icon><MagicStick /></el-icon>
      图片生成3D模型
    </h2>

    <!-- 主要内容区域：左右布局 -->
    <div class="main-layout">
      <!-- 左侧：输入区域 -->
      <div class="input-section">
        <!-- 上传设计图 -->
        <div class="page-card">
          <h3 class="card-title">
            <el-icon><Upload /></el-icon>
            上传设计图
          </h3>
          <FileUpload
            ref="imageUploadRef"
            accept-types=".jpg,.jpeg,.png"
            :max-size-m-b="20"
            @file-selected="onImageSelected"
            @file-removed="onImageRemoved"
          />
        </div>

        <!-- 镶嵌结构选择 -->
        <div class="page-card">
          <h3 class="card-title">
            <el-icon><Grid /></el-icon>
            镶嵌结构选择
            <el-tag type="info" size="small" effect="plain">可选</el-tag>
          </h3>
          <InlaySelector
            v-model="selectedInlay"
            @select="onInlaySelect"
          />
        </div>

        <!-- 生成参数配置 -->
        <div class="page-card">
          <h3 class="card-title">
            <el-icon><Setting /></el-icon>
            生成参数
          </h3>

          <el-form label-position="top" class="params-form">
            <!-- Prompt输入 -->
            <el-form-item label="提示词（可选）">
              <el-input
                v-model="generateParams.prompt"
                type="textarea"
                :rows="3"
                placeholder="请输入生成提示词，描述你期望的3D模型效果..."
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <!-- 输出格式选择 -->
            <el-form-item label="输出格式">
              <el-radio-group v-model="generateParams.output_format" class="format-group">
                <el-radio-button value="GLB">
                  <el-icon><Box /></el-icon>
                  GLB
                </el-radio-button>
                <el-radio-button value="OBJ">
                  <el-icon><Document /></el-icon>
                  OBJ
                </el-radio-button>
                <el-radio-button value="STL">
                  <el-icon><Files /></el-icon>
                  STL
                </el-radio-button>
              </el-radio-group>
              <div class="format-hint">
                <span>GLB: 通用3D格式，推荐使用</span>
                <span>OBJ: 传统3D格式，兼容性好</span>
                <span>STL: 3D打印格式</span>
              </div>
            </el-form-item>
          </el-form>
        </div>

        <!-- 生成按钮 -->
        <el-button
          type="primary"
          size="large"
          class="generate-btn"
          :loading="generating"
          :disabled="!canGenerate"
          @click="startGenerate"
        >
          <el-icon v-if="!generating"><VideoPlay /></el-icon>
          {{ generating ? '生成中...' : '开始生成' }}
        </el-button>
      </div>

      <!-- 右侧：结果预览区域 -->
      <div class="result-section">
        <div class="page-card result-card">
          <h3 class="card-title">
            <el-icon><PictureFilled /></el-icon>
            生成结果
          </h3>

          <!-- 无任务状态 -->
          <div v-if="!currentTask" class="result-empty">
            <el-icon :size="64" color="#dcdfe6"><PictureFilled /></el-icon>
            <p>上传设计图并点击生成按钮</p>
            <p class="result-hint">生成的3D模型将在此处预览</p>
          </div>

          <!-- 生成中状态 -->
          <div v-else-if="currentTask.status === 'waiting' || currentTask.status === 'processing'" class="result-generating">
            <el-progress
              type="circle"
              :percentage="taskProgress"
              :width="120"
              :stroke-width="8"
              :color="progressColor"
            >
              <template #default="{ percentage }">
                <span class="progress-text">{{ percentage }}%</span>
              </template>
            </el-progress>
            <p class="generating-status">
              {{ currentTask.status === 'waiting' ? '任务排队中...' : '正在生成3D模型...' }}
            </p>
            <p class="generating-hint">生成过程可能需要几分钟，请耐心等待</p>
          </div>

          <!-- 生成失败状态 -->
          <div v-else-if="currentTask.status === 'failed'" class="result-failed">
            <el-icon :size="48" color="#f56c6c"><CircleCloseFilled /></el-icon>
            <p class="failed-text">生成失败</p>
            <p class="failed-reason">{{ currentTask.error_message || '未知错误' }}</p>
            <el-button type="primary" @click="startGenerate">重新生成</el-button>
          </div>

          <!-- 生成完成状态 -->
          <div v-else-if="currentTask.status === 'completed'" class="result-completed">
            <!-- 3D模型预览 -->
            <div class="model-preview-wrapper">
              <ModelViewer
                v-if="modelPreviewUrl"
                :model-url="modelPreviewUrl"
                :model-format="generateParams.output_format"
              />
            </div>

            <!-- 操作按钮 -->
            <div class="result-actions">
              <el-button type="success" :icon="Download" @click="downloadResult">
                下载模型
              </el-button>
              <el-button :icon="RefreshRight" @click="startGenerate">
                重新生成
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import {
  MagicStick, Upload, Grid, Setting, Box, Document, Files,
  VideoPlay, PictureFilled, CircleCloseFilled, Download, RefreshRight,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import FileUpload from '@/components/FileUpload.vue'
import InlaySelector from '@/components/InlaySelector.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import {
  generateImageTo3d,
  conditionGenerate,
  getTaskDetail,
  downloadResult as downloadResultApi,
  type InlayInfo,
  type TaskDetail,
} from '@/api'

// ==========================================
// 状态
// ==========================================

const imageUploadRef = ref<InstanceType<typeof FileUpload> | null>(null)
const selectedImage = ref<File | null>(null)
const selectedInlay = ref<InlayInfo | null>(null)
const generating = ref(false)
const currentTask = ref<TaskDetail | null>(null)
const taskProgress = ref(0)
const modelPreviewUrl = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

// 生成参数
const generateParams = ref({
  prompt: '',
  output_format: 'GLB' as 'OBJ' | 'GLB' | 'STL',
})

// 是否可以生成
const canGenerate = computed(() => {
  return selectedImage.value && !generating.value
})

// 进度条颜色
const progressColor = computed(() => {
  if (taskProgress.value < 30) return '#409eff'
  if (taskProgress.value < 70) return '#e6a23c'
  return '#67c23a'
})

// ==========================================
// 方法
// ==========================================

/** 图片选择回调 */
function onImageSelected(file: File) {
  selectedImage.value = file
}

/** 图片移除回调 */
function onImageRemoved() {
  selectedImage.value = null
}

/** 镶嵌结构选择回调 */
function onInlaySelect(inlay: InlayInfo | null) {
  selectedInlay.value = inlay
}

/** 开始生成 */
async function startGenerate() {
  if (!selectedImage.value) {
    ElMessage.warning('请先上传设计图')
    return
  }

  generating.value = true
  taskProgress.value = 0
  currentTask.value = null
  modelPreviewUrl.value = ''

  try {
    let result
    if (selectedInlay.value) {
      // 条件生成（带镶嵌结构）
      // 注意：这里需要获取镶嵌结构的文件，实际场景中可能需要从服务端下载
      ElMessage.info('条件生成模式：使用选定的镶嵌结构')
      result = await conditionGenerate(
        selectedImage.value,
        selectedImage.value, // 实际应传入镶嵌结构文件
        generateParams.value
      )
    } else {
      // 普通图片生成3D
      result = await generateImageTo3d(selectedImage.value, generateParams.value)
    }

    currentTask.value = result.data
    ElMessage.success('任务已提交，正在生成中...')

    // 开始轮询任务状态
    startPolling(result.data.task_id)
  } catch (err: any) {
    ElMessage.error(err.message || '生成任务提交失败')
    generating.value = false
  }
}

/** 开始轮询任务状态 */
function startPolling(taskId: string) {
  // 清除之前的轮询
  stopPolling()

  pollTimer = setInterval(async () => {
    try {
      const res = await getTaskDetail(taskId)
      const detail = res.data
      currentTask.value = detail

      // 更新进度
      if (detail.progress !== undefined) {
        taskProgress.value = detail.progress
      } else {
        // 模拟进度
        if (detail.status === 'waiting') {
          taskProgress.value = Math.min(taskProgress.value + 1, 10)
        } else if (detail.status === 'processing') {
          taskProgress.value = Math.min(taskProgress.value + 5, 95)
        }
      }

      // 任务完成或失败，停止轮询
      if (detail.status === 'completed' || detail.status === 'failed') {
        stopPolling()
        generating.value = false

        if (detail.status === 'completed') {
          taskProgress.value = 100
          ElMessage.success('3D模型生成完成！')
          // 设置模型预览URL
          modelPreviewUrl.value = `/api/tasks/${taskId}/download`
        } else {
          ElMessage.error('3D模型生成失败')
        }
      }
    } catch {
      // 轮询失败，继续尝试
      console.warn('轮询任务状态失败')
    }
  }, 3000) // 每3秒轮询一次
}

/** 停止轮询 */
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/** 下载结果 */
async function downloadResult() {
  if (!currentTask.value) return
  try {
    const blob = await downloadResultApi(currentTask.value.task_id)
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `model_${currentTask.value.task_id.substring(0, 8)}.${generateParams.value.output_format.toLowerCase()}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    ElMessage.success('下载成功')
  } catch {
    ElMessage.error('下载失败')
  }
}

// 组件卸载时清理
onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
}

.main-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  align-items: start;
}

/* 输入区域 */
.input-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 参数表单 */
.params-form {
  margin-top: 8px;
}

.format-group {
  display: flex;
  width: 100%;
}

.format-group .el-radio-button {
  flex: 1;
}

.format-group .el-radio-button :deep(.el-radio-button__inner) {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.format-hint {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

/* 生成按钮 */
.generate-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border-radius: var(--radius-md);
}

/* 结果区域 */
.result-section {
  position: sticky;
  top: 84px;
}

.result-card {
  min-height: 500px;
  display: flex;
  flex-direction: column;
}

.result-empty,
.result-generating,
.result-failed,
.result-completed {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px 20px;
}

.result-empty p,
.result-generating p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.result-hint,
.generating-hint {
  font-size: 12px !important;
  color: var(--text-muted) !important;
}

/* 生成中进度 */
.progress-text {
  font-size: 24px;
  font-weight: 700;
  color: #409eff;
}

.generating-status {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary) !important;
}

/* 失败状态 */
.failed-text {
  font-size: 16px;
  font-weight: 600;
  color: #f56c6c !important;
}

.failed-reason {
  font-size: 13px;
  color: var(--text-muted) !important;
  max-width: 300px;
  text-align: center;
}

/* 完成状态 */
.model-preview-wrapper {
  width: 100%;
  height: 360px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 16px;
}

.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

/* 响应式布局 */
@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
  }

  .result-section {
    position: static;
  }
}
</style>
