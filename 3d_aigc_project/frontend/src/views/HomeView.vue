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
        <!-- 上传设计图 / 多视图 -->
        <div class="page-card">
          <div class="upload-mode-header">
            <h3 class="card-title">
              <el-icon><Upload /></el-icon>
              {{ uploadModeTitle }}
            </h3>
            <el-radio-group v-model="uploadMode" size="small" @change="onUploadModeChange">
              <el-radio-button value="single">单图</el-radio-button>
              <el-radio-button value="sheet">单图多视角</el-radio-button>
              <el-radio-button value="multi">六面体</el-radio-button>
            </el-radio-group>
          </div>

          <template v-if="uploadMode === 'sheet'">
            <p class="multi-view-desc">
              上传珠宝 CAD 合一参考图，自动切分多个视角并分配到标准槽位，再进入多视图建模流程。
            </p>
            <SheetSplitUploader @applied="onSheetApplied" @staged="onSheetStaged" />
          </template>
          <template v-else-if="uploadMode === 'multi'">
            <p class="multi-view-desc">
              从六个标准视角上传图片（至少 2 个），帮助模型更准确理解物体结构。
              俯视图/仰视图可上传存档，当前生成引擎暂仅使用水平四向视角。
            </p>
            <MultiViewUploader
              v-model="viewImages"
              :max-size-m-b="20"
              :processed-preview-urls="processedViewPreviewUrls"
            />
          </template>
          <template v-else>
            <FileUpload
              ref="imageUploadRef"
              accept-types=".jpg,.jpeg,.png,.bmp"
              :max-size-m-b="20"
              @file-selected="onImageSelected"
              @file-removed="onImageRemoved"
            />
          </template>
        </div>

        <!-- 建模前图像预处理 -->
        <div class="page-card preprocess-section">
          <div class="preprocess-header">
            <div class="preprocess-title">
              <el-icon><Picture /></el-icon>
              <span>建模前图像处理</span>
            </div>
            <div class="preprocess-actions">
              <span class="preprocess-switch-label">启用背景扣除</span>
              <el-switch v-model="bgRemovalEnabled" size="small" />
            </div>
          </div>

          <div v-if="!bgRemovalEnabled" class="preprocess-hint">
            关闭时将直接使用原图生成 3D 模型
          </div>
          <template v-else>
            <p class="preprocess-desc">
              自动识别主体并扣除背景，避免深色背景被误识别为模型结构。
              <template v-if="useMultiViewWorkflow">多视图模式下将对<strong>全部已上传视角</strong>分别抠图。</template>
            </p>

            <!-- 单图对比 -->
            <div v-if="!useMultiViewWorkflow && preprocessSourceFile" class="preprocess-compare">
              <div class="compare-item">
                <span class="compare-label">原图</span>
                <div class="compare-frame">
                  <img :src="originalPreviewUrl" alt="原图" />
                </div>
              </div>
              <div class="compare-item">
                <span class="compare-label">处理后</span>
                <div class="compare-frame checkerboard">
                  <img v-if="processedPreviewUrl" :src="processedPreviewUrl" alt="处理后" />
                  <span v-else class="compare-placeholder">点击下方按钮处理</span>
                </div>
              </div>
            </div>

            <!-- 多视图：各视角对比 -->
            <div v-else-if="useMultiViewWorkflow && uploadedFaces.length" class="preprocess-mv-grid">
              <div v-for="face in uploadedFaces" :key="face" class="preprocess-mv-item">
                <div class="preprocess-mv-head">
                  <span class="preprocess-mv-label">{{ VIEW_LABELS[face] }}</span>
                  <el-button
                    v-if="processedViewFiles[face]"
                    link
                    type="warning"
                    size="small"
                    @click="openFineTuneEditor(face)"
                  >
                    微调
                  </el-button>
                </div>
                <div class="preprocess-compare preprocess-compare--compact">
                  <div class="compare-item">
                    <span class="compare-label">原图</span>
                    <div class="compare-frame compare-frame--sm">
                      <img :src="viewOriginalUrls[face]" :alt="VIEW_LABELS[face]" />
                    </div>
                  </div>
                  <div class="compare-item">
                    <span class="compare-label">处理后</span>
                    <div class="compare-frame compare-frame--sm checkerboard">
                      <img
                        v-if="processedViewPreviewUrls[face]"
                        :src="processedViewPreviewUrls[face]"
                        alt="处理后"
                      />
                      <span v-else class="compare-placeholder">待处理</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="preprocess-hint">
              {{ useMultiViewWorkflow ? '请至少上传 1 个视角图片' : '请先上传设计图' }}
            </div>

            <div class="preprocess-btn-row">
              <el-button
                type="primary"
                plain
                class="remove-bg-btn"
                :loading="removingBg"
                :disabled="!canRunPreprocess || removingBg"
                @click="runRemoveBackground"
              >
                <el-icon v-if="!removingBg"><Crop /></el-icon>
                {{
                  removingBg
                    ? (useMultiViewWorkflow ? `处理中 ${bgProcessProgress}...` : '处理中...')
                    : (useMultiViewWorkflow ? '一键扣除全部视角背景' : '一键扣除背景')
                }}
              </el-button>
              <el-button
                v-if="!useMultiViewWorkflow && processedImageFile"
                type="warning"
                plain
                class="fine-tune-btn"
                :disabled="removingBg"
                @click="openFineTuneEditor()"
              >
                <el-icon><EditPen /></el-icon>
                手动微调
              </el-button>
            </div>
            <p v-if="bgRemovalEnabled && preprocessAllReady" class="preprocess-ready">
              {{
                useMultiViewWorkflow
                  ? `全部 ${uploadedFaces.length} 个视角已完成抠图，生成时将使用处理后的图片`
                  : '已生成透明底图像，生成时将使用处理后的图片'
              }}
            </p>
            <p v-else-if="bgRemovalEnabled && useMultiViewWorkflow && partialPreprocessCount > 0" class="preprocess-partial">
              已完成 {{ partialPreprocessCount }} / {{ uploadedFaces.length }} 个视角抠图
            </p>
          </template>
        </div>

        <!-- 镶嵌结构选择（可选，可折叠） -->
        <div class="page-card inlay-section">
          <div class="inlay-section-header">
            <div class="inlay-section-title">
              <el-icon><Grid /></el-icon>
              <span>镶嵌结构</span>
              <el-tag type="info" size="small" effect="plain">可选</el-tag>
            </div>
            <div class="inlay-section-actions">
              <span class="inlay-switch-label">启用</span>
              <el-switch
                v-model="inlayEnabled"
                size="small"
                @change="onInlayEnabledChange"
              />
              <el-button
                v-if="inlayEnabled"
                link
                type="primary"
                class="inlay-toggle-btn"
                @click="inlayPanelOpen = !inlayPanelOpen"
              >
                {{ inlayPanelOpen ? '收起' : '展开' }}
                <el-icon>
                  <ArrowUp v-if="inlayPanelOpen" />
                  <ArrowDown v-else />
                </el-icon>
              </el-button>
            </div>
          </div>

          <div v-if="!inlayEnabled" class="inlay-collapsed-hint">
            未启用镶嵌结构，将仅根据图片/多视图生成 3D 主体
          </div>
          <div v-else-if="!inlayPanelOpen" class="inlay-collapsed-hint">
            <template v-if="selectedInlay">
              已选：<span class="selected-name">{{ selectedInlay.filename }}</span>
              <el-button link type="primary" @click="inlayPanelOpen = true">更改</el-button>
            </template>
            <template v-else>
              已折叠，点击「展开」浏览并选择镶嵌结构
            </template>
          </div>
          <InlaySelector
            v-else
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
          <div v-else-if="currentTask.status === 'pending' || currentTask.status === 'processing'" class="result-generating">
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
              {{ currentTask.status === 'pending' ? '任务排队中...' : '正在生成3D模型...' }}
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

    <PreprocessEditor
      v-model:visible="editorVisible"
      :image-source="editorPreviewUrl"
      :session-id="editorSessionId"
      :file-name="editorFileName"
      @saved="onEditorSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import {
  MagicStick, Upload, Grid, Setting, Box, Document, Files,
  VideoPlay, PictureFilled, CircleCloseFilled, Download, RefreshRight,
  ArrowUp, ArrowDown, Picture, Crop, EditPen,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import FileUpload from '@/components/FileUpload.vue'
import MultiViewUploader from '@/components/MultiViewUploader.vue'
import SheetSplitUploader from '@/components/SheetSplitUploader.vue'
import {
  VIEW_FACES,
  VIEW_LABELS,
  hasMinimumViews,
  type ViewFace,
  type ViewImages,
} from '@/types/multiView'
import InlaySelector from '@/components/InlaySelector.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import PreprocessEditor from '@/components/PreprocessEditor.vue'
import {
  generateImageTo3d,
  getTaskDetail,
  downloadResult as downloadResultApi,
  removeBackground,
  fetchPreprocessPreview,
  type InlayInfo,
  type TaskDetail,
} from '@/api'

// ==========================================
// 状态
// ==========================================

const imageUploadRef = ref<InstanceType<typeof FileUpload> | null>(null)
const selectedImage = ref<File | null>(null)
type UploadMode = 'single' | 'sheet' | 'multi'
const uploadMode = ref<UploadMode>('single')
const multiViewEnabled = computed(() => uploadMode.value === 'multi')
/** 单图多视角切分后或六面体模式：走多视图抠图/生成流程 */
const useMultiViewWorkflow = computed(
  () => uploadMode.value === 'multi' || hasMinimumViews(viewImages.value, 2)
)
const uploadModeTitle = computed(() => {
  if (uploadMode.value === 'sheet') return '单图多视角切割'
  if (uploadMode.value === 'multi') return '多视图上传'
  return '上传设计图'
})
const viewImages = ref<ViewImages>({})
const selectedInlay = ref<InlayInfo | null>(null)
const inlayEnabled = ref(false)
const inlayPanelOpen = ref(false)
const generating = ref(false)
const bgRemovalEnabled = ref(false)
const removingBg = ref(false)
const processedImageFile = ref<File | null>(null)
const processedPreviewUrl = ref('')
const preprocessSessionId = ref('')
const processedViewFiles = ref<ViewImages>({})
const processedViewPreviewUrls = ref<Partial<Record<ViewFace, string>>>({})
const preprocessSessionIds = ref<Partial<Record<ViewFace, string>>>({})
const viewOriginalUrls = ref<Partial<Record<ViewFace, string>>>({})
const fineTuneFace = ref<ViewFace | null>(null)
const bgProcessProgress = ref('')
const editorVisible = ref(false)
const originalPreviewUrl = ref('')
const currentTask = ref<TaskDetail | null>(null)
const taskProgress = ref(0)
const modelPreviewUrl = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null

// 生成参数
const generateParams = ref({
  prompt: '',
  output_format: 'GLB' as 'OBJ' | 'GLB' | 'STL',
})

// 预处理源图（单图模式）
const preprocessSourceFile = computed(() => {
  if (useMultiViewWorkflow.value) return null
  return selectedImage.value
})

const uploadedFaces = computed(() =>
  VIEW_FACES.filter((f) => viewImages.value[f])
)

const canRunPreprocess = computed(() => {
  if (useMultiViewWorkflow.value) return uploadedFaces.value.length > 0
  return !!preprocessSourceFile.value
})

const partialPreprocessCount = computed(() =>
  uploadedFaces.value.filter((f) => processedViewFiles.value[f]).length
)

const preprocessAllReady = computed(() => {
  if (!bgRemovalEnabled.value) return false
  if (useMultiViewWorkflow.value) {
    return uploadedFaces.value.length > 0
      && uploadedFaces.value.every((f) => processedViewFiles.value[f])
  }
  return !!processedImageFile.value
})

// 是否可以生成
const canGenerate = computed(() => {
  if (generating.value) return false
  if (useMultiViewWorkflow.value) {
    if (!hasMinimumViews(viewImages.value, 2)) return false
    if (bgRemovalEnabled.value) {
      const faces = uploadedFaces.value
      if (faces.length === 0) return false
      if (!faces.every((f) => processedViewFiles.value[f])) return false
    }
    return true
  }
  if (!selectedImage.value) return false
  if (bgRemovalEnabled.value && !processedImageFile.value) return false
  return true
})

const editorPreviewUrl = computed(() => {
  if (fineTuneFace.value) {
    return processedViewPreviewUrls.value[fineTuneFace.value] ?? ''
  }
  return processedPreviewUrl.value
})

const editorSessionId = computed(() => {
  if (fineTuneFace.value) {
    return preprocessSessionIds.value[fineTuneFace.value] ?? ''
  }
  return preprocessSessionId.value
})

const editorFileName = computed(() => {
  if (fineTuneFace.value) {
    return processedViewFiles.value[fineTuneFace.value]?.name
  }
  return processedImageFile.value?.name
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

const viewFileRev = ref<Partial<Record<ViewFace, string>>>({})

watch(
  () => viewImages.value,
  (views) => {
    if (!useMultiViewWorkflow.value) return
    for (const face of VIEW_FACES) {
      const file = views[face]
      const key = file ? `${file.name}:${file.size}:${file.lastModified}` : ''
      if (viewFileRev.value[face] === key) continue
      viewFileRev.value[face] = key
      resetFacePreprocess(face)
      const oldUrl = viewOriginalUrls.value[face]
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      if (file) {
        viewOriginalUrls.value[face] = URL.createObjectURL(file)
      } else {
        delete viewOriginalUrls.value[face]
      }
    }
  },
  { deep: true }
)

/** 图片选择回调 */
function onImageSelected(file: File) {
  selectedImage.value = file
  resetPreprocessState()
  if (originalPreviewUrl.value) {
    URL.revokeObjectURL(originalPreviewUrl.value)
  }
  originalPreviewUrl.value = URL.createObjectURL(file)
}

/** 图片移除回调 */
function onImageRemoved() {
  selectedImage.value = null
  resetPreprocessState()
  if (originalPreviewUrl.value) {
    URL.revokeObjectURL(originalPreviewUrl.value)
    originalPreviewUrl.value = ''
  }
}

function resetFacePreprocess(face: ViewFace) {
  const url = processedViewPreviewUrls.value[face]
  if (url) URL.revokeObjectURL(url)
  delete processedViewPreviewUrls.value[face]
  delete processedViewFiles.value[face]
  delete preprocessSessionIds.value[face]
}

function resetPreprocessState() {
  if (processedPreviewUrl.value) {
    URL.revokeObjectURL(processedPreviewUrl.value)
  }
  processedPreviewUrl.value = ''
  processedImageFile.value = null
  preprocessSessionId.value = ''
  fineTuneFace.value = null
  editorVisible.value = false

  for (const face of VIEW_FACES) {
    resetFacePreprocess(face)
  }
  for (const face of VIEW_FACES) {
    const url = viewOriginalUrls.value[face]
    if (url) URL.revokeObjectURL(url)
  }
  viewOriginalUrls.value = {}
}

function revokeViewOriginalUrls() {
  for (const face of VIEW_FACES) {
    const url = viewOriginalUrls.value[face]
    if (url) URL.revokeObjectURL(url)
  }
  viewOriginalUrls.value = {}
}

function onUploadModeChange(mode: UploadMode) {
  if (mode === 'single') {
    viewImages.value = {}
    revokeViewOriginalUrls()
    resetPreprocessState()
  } else if (mode === 'sheet') {
    selectedImage.value = null
    imageUploadRef.value?.removeFile()
    viewImages.value = {}
    revokeViewOriginalUrls()
    resetPreprocessState()
  } else {
    selectedImage.value = null
    imageUploadRef.value?.removeFile()
    resetPreprocessState()
  }
}

function onSheetStaged(views: ViewImages) {
  if (!hasMinimumViews(views, 2)) {
    if (uploadMode.value === 'sheet') {
      viewImages.value = {}
      revokeViewOriginalUrls()
    }
    return
  }
  viewImages.value = { ...views }
}

function onSheetApplied(views: ViewImages) {
  resetPreprocessState()
  uploadMode.value = 'multi'
  viewImages.value = { ...views }
}

async function processOneFaceBackground(face: ViewFace, source: File) {
  const res = await removeBackground(source)
  const previewUrl = res.data.previewUrl
  const blob = await fetchPreprocessPreview(previewUrl)
  const oldUrl = processedViewPreviewUrls.value[face]
  if (oldUrl) URL.revokeObjectURL(oldUrl)
  processedViewPreviewUrls.value[face] = URL.createObjectURL(blob)
  processedViewFiles.value[face] = new File(
    [blob],
    `no_bg_${face}_${source.name.replace(/\.[^.]+$/, '')}.png`,
    { type: 'image/png' }
  )
  preprocessSessionIds.value[face] = res.data.sessionId
}

/** 一键扣除背景（单图或全部已上传视角） */
async function runRemoveBackground() {
  if (useMultiViewWorkflow.value) {
    const faces = uploadedFaces.value
    if (!faces.length) {
      ElMessage.warning('请先上传至少 1 个视角图片')
      return
    }
    removingBg.value = true
    let ok = 0
    let fail = 0
    try {
      for (let i = 0; i < faces.length; i++) {
        const face = faces[i]
        const source = viewImages.value[face]
        if (!source) continue
        bgProcessProgress.value = `${i + 1}/${faces.length}`
        try {
          await processOneFaceBackground(face, source)
          ok++
        } catch {
          fail++
        }
      }
      if (fail === 0) {
        ElMessage.success(`全部 ${ok} 个视角背景扣除完成`)
      } else if (ok > 0) {
        ElMessage.warning(`${ok} 个视角成功，${fail} 个失败，可重试`)
      } else {
        ElMessage.error('背景扣除失败')
      }
    } finally {
      removingBg.value = false
      bgProcessProgress.value = ''
    }
    return
  }

  const source = preprocessSourceFile.value
  if (!source) {
    ElMessage.warning('请先上传设计图')
    return
  }

  removingBg.value = true
  try {
    const res = await removeBackground(source)
    const previewUrl = res.data.previewUrl
    const blob = await fetchPreprocessPreview(previewUrl)

    if (processedPreviewUrl.value) {
      URL.revokeObjectURL(processedPreviewUrl.value)
    }
    processedPreviewUrl.value = URL.createObjectURL(blob)
    processedImageFile.value = new File(
      [blob],
      `no_bg_${source.name.replace(/\.[^.]+$/, '')}.png`,
      { type: 'image/png' }
    )
    preprocessSessionId.value = res.data.sessionId
    ElMessage.success('背景扣除完成')
  } catch (err: any) {
    ElMessage.error(err.message || '背景扣除失败')
  } finally {
    removingBg.value = false
  }
}

function openFineTuneEditor(face?: ViewFace) {
  if (useMultiViewWorkflow.value) {
    if (!face) return
    if (!processedViewFiles.value[face]) {
      ElMessage.warning(`请先完成${VIEW_LABELS[face]}的背景扣除`)
      return
    }
    fineTuneFace.value = face
  } else {
    fineTuneFace.value = null
    if (!processedPreviewUrl.value) {
      ElMessage.warning('请先完成背景扣除')
      return
    }
  }
  editorVisible.value = true
}

function onEditorSaved(file: File) {
  if (fineTuneFace.value) {
    const face = fineTuneFace.value
    if (processedViewPreviewUrls.value[face]) {
      URL.revokeObjectURL(processedViewPreviewUrls.value[face]!)
    }
    processedViewPreviewUrls.value[face] = URL.createObjectURL(file)
    processedViewFiles.value[face] = file
  } else {
    if (processedPreviewUrl.value) {
      URL.revokeObjectURL(processedPreviewUrl.value)
    }
    processedPreviewUrl.value = URL.createObjectURL(file)
    processedImageFile.value = file
  }
}

/** 获取用于生成的单图（非多视图模式） */
function getImageForGenerate(): File | null {
  if (bgRemovalEnabled.value && processedImageFile.value) {
    return processedImageFile.value
  }
  return selectedImage.value
}

/** 获取多视图图片集（含各视角预处理结果） */
function getViewsForGenerate(): ViewImages {
  const views: ViewImages = { ...viewImages.value }
  if (bgRemovalEnabled.value) {
    for (const face of VIEW_FACES) {
      if (views[face] && processedViewFiles.value[face]) {
        views[face] = processedViewFiles.value[face]!
      }
    }
  }
  return views
}

/** 镶嵌结构选择回调 */
function onInlaySelect(inlay: InlayInfo | null) {
  selectedInlay.value = inlay
}

/** 启用/关闭镶嵌结构 */
function onInlayEnabledChange(enabled: boolean) {
  if (!enabled) {
    selectedInlay.value = null
    inlayPanelOpen.value = false
    return
  }
  inlayPanelOpen.value = true
}

/** 开始生成 */
async function startGenerate() {
  if (useMultiViewWorkflow.value) {
    if (!hasMinimumViews(viewImages.value, 2)) {
      ElMessage.warning('多视图模式下至少需要上传 2 个视角')
      return
    }
    if (bgRemovalEnabled.value) {
      const pending = uploadedFaces.value.filter((f) => !processedViewFiles.value[f])
      if (pending.length) {
        ElMessage.warning(`请先完成全部已上传视角的背景扣除（还差 ${pending.length} 个）`)
        return
      }
    }
  } else {
    const imageFile = getImageForGenerate()
    if (!imageFile) {
      ElMessage.warning(bgRemovalEnabled.value ? '请先完成背景扣除' : '请先上传设计图')
      return
    }
  }

  generating.value = true
  taskProgress.value = 0
  currentTask.value = null
  modelPreviewUrl.value = ''

  try {
    const imageFile = useMultiViewWorkflow.value ? null : getImageForGenerate()
    const inputLabel = useMultiViewWorkflow.value
      ? `多视图(${Object.keys(getViewsForGenerate()).length}张)`
      : (imageFile?.name ?? '')

    const params = {
      ...generateParams.value,
      multi_view_enabled: useMultiViewWorkflow.value,
    }
    if (selectedInlay.value && inlayEnabled.value) {
      if (!selectedInlay.value.id) {
        throw new Error('请选择镶嵌结构')
      }
      params.inlay_structure_filename = selectedInlay.value.id
    }

    const result = await generateImageTo3d(
      imageFile,
      params,
      useMultiViewWorkflow.value ? getViewsForGenerate() : undefined
    )

    currentTask.value = {
      task_id: result.data.taskId || (result.data as any).task_id,
      input_file: inputLabel,
      status: (result.data.status as TaskDetail['status']) || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    ElMessage.success('任务已提交，正在生成中...')
    const taskId = (result.data as any).task_id || (result.data as any).taskId
    startPolling(taskId)
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
        if (detail.status === 'pending') {
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
  resetPreprocessState()
  if (originalPreviewUrl.value) {
    URL.revokeObjectURL(originalPreviewUrl.value)
  }
})
</script>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.main-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
  min-width: 0;
}

/* 输入区域 */
.input-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  max-width: 100%;
}

.input-section :deep(.page-card) {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
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

.upload-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  min-width: 0;
}

.upload-mode-header .el-radio-group {
  flex-shrink: 0;
}

.upload-mode-header .card-title {
  margin-bottom: 0;
}

.upload-mode-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.upload-mode-label {
  font-size: 12px;
  color: var(--text-muted);
}

.multi-view-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.inlay-section {
  padding-top: 16px;
}

.inlay-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.inlay-section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.inlay-section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.inlay-switch-label {
  font-size: 12px;
  color: var(--text-muted);
}

.inlay-toggle-btn {
  padding-left: 4px;
  padding-right: 4px;
}

.inlay-collapsed-hint {
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: #f5f7fa;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.inlay-collapsed-hint .selected-name {
  color: var(--text-primary);
  font-weight: 500;
}

/* 图像预处理 */
.preprocess-section {
  padding-top: 16px;
}

.preprocess-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.preprocess-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.preprocess-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preprocess-switch-label {
  font-size: 12px;
  color: var(--text-muted);
}

.preprocess-hint,
.preprocess-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.preprocess-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.compare-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-label {
  font-size: 12px;
  color: var(--text-muted);
}

.compare-frame {
  height: 140px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.compare-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.compare-frame.checkerboard {
  background-image:
    linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
    linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-color: #fff;
}

.compare-placeholder {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px;
  text-align: center;
}

.remove-bg-btn {
  flex: 1;
}

.preprocess-btn-row {
  display: flex;
  gap: 8px;
}

.fine-tune-btn {
  flex-shrink: 0;
}

.preprocess-ready {
  margin: 10px 0 0;
  font-size: 12px;
  color: #67c23a;
}

.preprocess-partial {
  margin: 10px 0 0;
  font-size: 12px;
  color: #e6a23c;
}

.preprocess-mv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.preprocess-mv-item {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 8px;
  background: #fafbfc;
}

.preprocess-mv-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.preprocess-mv-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.preprocess-compare--compact {
  margin-bottom: 0;
}

.compare-frame--sm {
  height: 88px;
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
