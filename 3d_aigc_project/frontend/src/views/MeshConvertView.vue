<template>
  <div class="mesh-convert-view">
    <h2 class="page-title">
      <el-icon><Switch /></el-icon>
      3D 格式转换
    </h2>

    <div class="convert-layout">
      <!-- 左侧：上传与配置 -->
      <div class="convert-panel">
        <div class="page-card">
          <h3 class="card-title">
            <el-icon><Upload /></el-icon>
            上传源文件
          </h3>
          <FileUpload
            ref="uploadRef"
            accept-types=".obj,.glb,.stl"
            :max-size-m-b="100"
            @file-selected="onFileSelected"
            @file-removed="onFileRemoved"
          />
          <p v-if="sourceFormat" class="format-hint">
            检测到源格式：<el-tag size="small" type="info">{{ sourceFormat }}</el-tag>
          </p>
        </div>

        <div class="page-card">
          <h3 class="card-title">
            <el-icon><Setting /></el-icon>
            转换设置
          </h3>
          <div class="format-row">
            <span class="format-label">目标格式</span>
            <el-radio-group v-model="targetFormat" size="default">
              <el-radio-button
                v-for="fmt in availableTargets"
                :key="fmt"
                :value="fmt"
                :disabled="fmt === sourceFormat"
              >
                {{ fmt }}
              </el-radio-button>
            </el-radio-group>
          </div>
          <p v-if="!availableTargets.length && sourceFormat" class="format-hint warn">
            当前源格式无其他可转换目标
          </p>
          <div class="action-row">
            <el-button
              type="primary"
              :icon="Switch"
              :loading="converting"
              :disabled="!canConvert"
              @click="handleConvert"
            >
              {{ converting ? '转换中...' : '开始转换' }}
            </el-button>
            <el-button
              v-if="convertResult"
              type="warning"
              plain
              :loading="addingToInlay"
              @click="handleCropAndAddToInlay"
            >
              裁剪并加入镶嵌库
            </el-button>
            <el-button
              v-if="convertResult"
              type="success"
              :icon="Download"
              @click="handleDownload"
            >
              下载结果
            </el-button>
          </div>
        </div>

        <div class="page-card formats-card">
          <h3 class="card-title">
            <el-icon><InfoFilled /></el-icon>
            支持格式
          </h3>
          <p class="formats-desc">系统支持 OBJ、GLB、STL 三种网格格式互转（共 6 种转换路径）。</p>
          <el-table v-if="formatMatrix" :data="formatTableRows" size="small" stripe>
            <el-table-column prop="source" label="源格式" width="90" />
            <el-table-column prop="targets" label="可转为" />
          </el-table>
        </div>
      </div>

      <!-- 右侧：预览 -->
      <div class="preview-panel">
        <div class="page-card preview-card">
          <div class="preview-header">
            <h3 class="card-title">
              <el-icon><View /></el-icon>
              模型预览
            </h3>
            <el-radio-group v-if="showPreviewToggle" v-model="previewMode" size="small">
              <el-radio-button value="source">源文件</el-radio-button>
              <el-radio-button value="result" :disabled="!convertResult">转换结果</el-radio-button>
            </el-radio-group>
          </div>

          <div v-if="convertResult && previewMode === 'result'" class="result-meta">
            <el-tag type="success" size="small">
              {{ convertResult.sourceFormat }} → {{ convertResult.outputFormat }}
            </el-tag>
            <span class="meta-text">
              {{ formatFileSize(convertResult.fileSize) }}
              · {{ convertResult.vertexCount }} 顶点 · {{ convertResult.faceCount }} 面
            </span>
          </div>

          <div class="viewer-wrap">
            <ModelViewer
              :model-url="activePreviewUrl"
              :model-format="activePreviewFormat"
              preview-mode="white"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Switch,
  Upload,
  Setting,
  Download,
  View,
  InfoFilled,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import FileUpload from '@/components/FileUpload.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import { useRouter } from 'vue-router'
import {
  convertMeshFormat,
  downloadConvertedMesh,
  getMeshConvertFormats,
  createInlayV2Item,
  type MeshFormat,
  type MeshConvertResult,
} from '@/api'

const MESH_FORMATS: MeshFormat[] = ['OBJ', 'GLB', 'STL']

const uploadRef = ref<InstanceType<typeof FileUpload> | null>(null)
const sourceFile = ref<File | null>(null)
const sourceFormat = ref<MeshFormat | ''>('')
const targetFormat = ref<MeshFormat>('GLB')
const converting = ref(false)
const convertResult = ref<MeshConvertResult | null>(null)
const previewMode = ref<'source' | 'result'>('source')
const sourcePreviewUrl = ref('')
const formatMatrix = ref<Record<string, string[]> | null>(null)
const addingToInlay = ref(false)
const router = useRouter()

const availableTargets = computed(() => {
  if (!sourceFormat.value) return MESH_FORMATS
  return MESH_FORMATS.filter((f) => f !== sourceFormat.value)
})

const canConvert = computed(
  () =>
    !!sourceFile.value &&
    !!sourceFormat.value &&
    !!targetFormat.value &&
    targetFormat.value !== sourceFormat.value &&
    !converting.value
)

const showPreviewToggle = computed(() => !!sourceFile.value)

const activePreviewUrl = computed(() => {
  if (previewMode.value === 'result' && convertResult.value?.previewUrl) {
    const url = convertResult.value.previewUrl
    return url.startsWith('/api') ? url : `/api${url}`
  }
  return sourcePreviewUrl.value
})

const activePreviewFormat = computed<MeshFormat>(() => {
  if (previewMode.value === 'result' && convertResult.value) {
    return convertResult.value.outputFormat
  }
  return (sourceFormat.value || 'GLB') as MeshFormat
})

const formatTableRows = computed(() => {
  if (!formatMatrix.value) return []
  return Object.entries(formatMatrix.value).map(([source, targets]) => ({
    source,
    targets: targets.join('、'),
  }))
})

function detectFormat(filename: string): MeshFormat | '' {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'obj') return 'OBJ'
  if (ext === 'glb') return 'GLB'
  if (ext === 'stl') return 'STL'
  return ''
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function revokeSourcePreview() {
  if (sourcePreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
  sourcePreviewUrl.value = ''
}

function onFileSelected(file: File) {
  revokeSourcePreview()
  sourceFile.value = file
  convertResult.value = null
  previewMode.value = 'source'

  const fmt = detectFormat(file.name)
  if (!fmt) {
    ElMessage.error('不支持的文件格式，请上传 OBJ/GLB/STL 文件')
    uploadRef.value?.removeFile()
    return
  }
  sourceFormat.value = fmt
  if (targetFormat.value === fmt) {
    targetFormat.value = availableTargets.value[0] || 'GLB'
  }
  sourcePreviewUrl.value = URL.createObjectURL(file)
}

function onFileRemoved() {
  revokeSourcePreview()
  sourceFile.value = null
  sourceFormat.value = ''
  convertResult.value = null
  previewMode.value = 'source'
}

async function handleConvert() {
  if (!sourceFile.value || !canConvert.value) return

  converting.value = true
  try {
    const res = await convertMeshFormat(sourceFile.value, targetFormat.value)
    convertResult.value = res.data
    previewMode.value = 'result'
    ElMessage.success(res.message || '格式转换完成')
  } catch {
    // 错误已由 interceptor 提示
  } finally {
    converting.value = false
  }
}

async function handleDownload() {
  if (!convertResult.value) return
  try {
    const blob = await downloadConvertedMesh(convertResult.value.sessionId)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `converted.${convertResult.value.outputFormat.toLowerCase()}`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    ElMessage.error('下载失败')
  }
}

async function handleCropAndAddToInlay() {
  if (!convertResult.value) return
  addingToInlay.value = true
  try {
    const blob = await downloadConvertedMesh(convertResult.value.sessionId)
    const ext = convertResult.value.outputFormat.toLowerCase()
    const baseName = sourceFile.value?.name.replace(/\.[^.]+$/, '') || 'converted'
    const file = new File([blob], `${baseName}.${ext}`, { type: 'application/octet-stream' })
    const res = await createInlayV2Item({ source: file, display_name: baseName })
    const id = res.data?.id
    if (!id) {
      ElMessage.error('加入镶嵌库失败')
      return
    }
    ElMessage.success('已加入镶嵌库，正在打开网格裁剪模式')
    router.push({ name: 'inlay-library', query: { mode: 'crop', id, name: baseName } })
  } catch {
    ElMessage.error('加入镶嵌库失败')
  } finally {
    addingToInlay.value = false
  }
}

watch(sourceFormat, (fmt) => {
  if (fmt && targetFormat.value === fmt) {
    targetFormat.value = MESH_FORMATS.find((f) => f !== fmt) || 'GLB'
  }
})

onMounted(async () => {
  try {
    const res = await getMeshConvertFormats()
    formatMatrix.value = res.data.matrix
  } catch {
    formatMatrix.value = {
      OBJ: ['GLB', 'STL'],
      GLB: ['OBJ', 'STL'],
      STL: ['OBJ', 'GLB'],
    }
  }
})
</script>

<style scoped>
.mesh-convert-view {
  max-width: 1400px;
}

.convert-layout {
  display: grid;
  grid-template-columns: minmax(320px, 420px) 1fr;
  gap: 24px;
  align-items: start;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}

.convert-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.format-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}

.format-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.format-hint {
  margin-top: 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.format-hint.warn {
  color: #e6a23c;
}

.action-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.formats-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 12px;
}

.preview-card {
  min-height: 520px;
  display: flex;
  flex-direction: column;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.preview-header .card-title {
  margin-bottom: 0;
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.meta-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.viewer-wrap {
  flex: 1;
  min-height: 440px;
  border-radius: 8px;
  overflow: hidden;
  background: #1a1a2e;
}

@media (max-width: 960px) {
  .convert-layout {
    grid-template-columns: 1fr;
  }
}
</style>
