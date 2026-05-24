<template>
  <div
    class="file-upload"
    :class="{ 'is-dragover': isDragover, 'has-file': selectedFile }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="triggerFileInput"
  >
    <!-- 隐藏的文件输入框 -->
    <input
      ref="fileInputRef"
      type="file"
      :accept="acceptTypes"
      style="display: none"
      @change="onFileChange"
    />

    <!-- 上传区域内容 -->
    <div v-if="!selectedFile" class="upload-placeholder">
      <el-icon class="upload-icon"><UploadFilled /></el-icon>
      <div class="upload-text">
        <p class="upload-title">将文件拖拽到此处，或点击选择文件</p>
        <p class="upload-hint">支持 {{ acceptTypes }} 格式，最大 {{ maxSizeMB }}MB</p>
      </div>
    </div>

    <!-- 已选择文件预览 -->
    <div v-else class="file-preview">
      <!-- 图片预览 -->
      <div v-if="isImageFile" class="image-preview">
        <img :src="previewUrl" alt="预览" />
      </div>
      <!-- 文件图标 -->
      <div v-else class="file-icon-wrapper">
        <el-icon :size="48" color="#409eff"><Document /></el-icon>
      </div>

      <!-- 文件信息 -->
      <div class="file-info">
        <p class="file-name" :title="selectedFile.name">{{ selectedFile.name }}</p>
        <p class="file-size">{{ formatFileSize(selectedFile.size) }}</p>
      </div>

      <!-- 操作按钮 -->
      <div class="file-actions">
        <el-button type="danger" :icon="Delete" circle size="small" @click.stop="removeFile" />
      </div>
    </div>

    <!-- 上传进度条 -->
    <el-progress
      v-if="uploading"
      :percentage="uploadProgress"
      :stroke-width="4"
      :show-text="false"
      class="upload-progress"
      status="success"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UploadFilled, Document, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// ==========================================
// Props & Emits
// ==========================================

interface Props {
  /** 接受的文件类型 */
  acceptTypes?: string
  /** 最大文件大小(MB) */
  maxSizeMB?: number
  /** 是否正在上传中 */
  uploading?: boolean
  /** 上传进度 0-100 */
  uploadProgress?: number
}

const props = withDefaults(defineProps<Props>(), {
  acceptTypes: '.jpg,.jpeg,.png',
  maxSizeMB: 20,
  uploading: false,
  uploadProgress: 0,
})

const emit = defineEmits<{
  'file-selected': [file: File]
  'file-removed': []
}>()

// ==========================================
// 状态
// ==========================================

const fileInputRef = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const isDragover = ref(false)
const previewUrl = ref<string>('')

// 是否为图片文件
const isImageFile = computed(() => {
  if (!selectedFile.value) return false
  return selectedFile.value.type.startsWith('image/')
})

// ==========================================
// 方法
// ==========================================

/** 触发文件选择 */
function triggerFileInput() {
  if (!props.uploading) {
    fileInputRef.value?.click()
  }
}

/** 拖拽进入 */
function onDragOver() {
  isDragover.value = true
}

/** 拖拽离开 */
function onDragLeave() {
  isDragover.value = false
}

/** 拖拽放下 */
function onDrop(event: DragEvent) {
  isDragover.value = false
  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
}

/** 文件选择变更 */
function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
  // 重置input以允许重复选择同一文件
  input.value = ''
}

/** 处理文件 */
function handleFile(file: File) {
  // 文件大小验证
  const maxSize = props.maxSizeMB * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error(`文件大小不能超过 ${props.maxSizeMB}MB`)
    return
  }

  // 文件类型验证
  const acceptList = props.acceptTypes.split(',').map(t => t.trim().toLowerCase())
  const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!acceptList.some(ext => fileExt.endsWith(ext))) {
    ElMessage.error(`仅支持 ${props.acceptTypes} 格式的文件`)
    return
  }

  selectedFile.value = file

  // 生成图片预览URL
  if (file.type.startsWith('image/')) {
    previewUrl.value = URL.createObjectURL(file)
  } else {
    previewUrl.value = ''
  }

  emit('file-selected', file)
}

/** 移除已选文件 */
function removeFile() {
  // 释放预览URL
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  selectedFile.value = null
  previewUrl.value = ''
  emit('file-removed')
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 暴露方法供父组件调用
defineExpose({
  getSelectedFile: () => selectedFile.value,
  removeFile,
})
</script>

<style scoped>
.file-upload {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 32px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background-color: #fafbfc;
  position: relative;
}

.file-upload:hover {
  border-color: #409eff;
  background-color: #f0f7ff;
}

.file-upload.is-dragover {
  border-color: #409eff;
  background-color: #e6f1ff;
  transform: scale(1.01);
}

.file-upload.has-file {
  border-style: solid;
  border-color: #c6e2ff;
  background-color: #f0f7ff;
  cursor: default;
  padding: 16px 20px;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.upload-icon {
  font-size: 48px;
  color: #c0c4cc;
  transition: color 0.3s;
}

.file-upload:hover .upload-icon {
  color: #409eff;
}

.upload-title {
  font-size: 14px;
  color: var(--text-primary);
  margin: 0;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  text-align: left;
}

.image-preview {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.file-icon-wrapper {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #ecf5ff;
  border-radius: var(--radius-sm);
}

.file-info {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

.file-actions {
  flex-shrink: 0;
}

.upload-progress {
  margin-top: 12px;
}
</style>
