<template>
  <div class="home-view">
    <!-- 工作流步骤指示器 -->
    <div class="workflow-header">
      <div class="workflow-steps">
        <div
          v-for="(step, idx) in workflowSteps"
          :key="step.id"
          class="workflow-step"
          :class="{
            'is-active': currentWorkflowStep === step.id,
            'is-completed': step.completed,
          }"
        >
          <div class="step-indicator">
            <span v-if="step.completed && currentWorkflowStep !== step.id" class="step-check">✓</span>
            <span v-else class="step-num">{{ idx + 1 }}</span>
          </div>
          <span class="step-label">{{ step.label }}</span>
          <div v-if="idx < workflowSteps.length - 1" class="step-connector" />
        </div>
      </div>
      <div class="workflow-header-actions">
        <el-tag v-if="activeDraftId" type="success" size="small" effect="plain" class="draft-active-tag">
          草稿编辑中
        </el-tag>
        <el-badge :value="draftList.length" :max="99" :hidden="!draftList.length" class="draft-count-badge">
          <el-button class="draft-box-btn" @click="openDrawer">
            <el-icon><FolderOpened /></el-icon>
            草稿箱
          </el-button>
        </el-badge>
      </div>
    </div>

    <!-- 工作室布局：左侧控制面板 + 右侧 3D 画布 -->
    <div class="studio-layout">
      <!-- 左侧：步骤面板 -->
      <aside class="studio-sidebar">
        <!-- Step 1: 上传 -->
        <section
          id="step-upload"
          class="sidebar-section"
          :class="{ 'is-active': currentWorkflowStep === 'upload', 'is-completed': hasUploadContent }"
        >
          <div class="section-header">
            <div class="section-title">
              <span class="section-step">1</span>
              <el-icon><Upload /></el-icon>
              {{ uploadModeTitle }}
            </div>
            <el-radio-group v-model="uploadMode" size="small" @change="onUploadModeChange">
              <el-radio-button value="single">单图</el-radio-button>
              <el-radio-button value="sheet">单图多视角</el-radio-button>
              <el-radio-button value="multi">六面体</el-radio-button>
            </el-radio-group>
          </div>

          <template v-if="uploadMode === 'sheet'">
            <p class="section-desc">
              上传珠宝 CAD 合一参考图，可自动或手动切分多个视角并分配到标准槽位，再进入多视图建模流程。
            </p>
            <SheetSplitUploader
              :key="`sheet-${uploadRemountKey}`"
              ref="sheetSplitRef"
              @applied="onSheetApplied"
              @staged="onSheetStaged"
              @state-changed="scheduleAutoSave"
            />
          </template>
          <template v-else-if="uploadMode === 'multi'">
            <p class="section-desc">
              从六个标准视角上传图片（至少 2 个），帮助模型更准确理解物体结构。
              俯视图/仰视图可上传存档，当前生成引擎暂仅使用水平四向视角。
            </p>
            <MultiViewUploader
              :key="`multi-${uploadRemountKey}`"
              v-model="viewImages"
              :max-size-m-b="20"
              :processed-preview-urls="processedViewPreviewUrls"
            />
          </template>
          <template v-else>
            <FileUpload
              :key="`single-${uploadRemountKey}`"
              ref="imageUploadRef"
              accept-types=".jpg,.jpeg,.png,.bmp"
              :max-size-m-b="20"
              @file-selected="onImageSelected"
              @file-removed="onImageRemoved"
            />
          </template>
        </section>

        <!-- Step 2: 预处理 -->
        <section
          id="step-preprocess"
          class="sidebar-section preprocess-section"
          :class="{ 'is-active': currentWorkflowStep === 'preprocess', 'is-completed': preprocessAllReady }"
        >
          <div class="section-header">
            <div class="section-title">
              <span class="section-step">2</span>
              <el-icon><Picture /></el-icon>
              <span>图像预处理</span>
            </div>
            <div class="preprocess-actions">
              <span class="preprocess-switch-label">启用</span>
              <el-switch v-model="bgRemovalEnabled" size="small" />
              <span class="preprocess-switch-label gem-repaint-label">AI 去反光</span>
              <el-switch v-model="enableGemRepaint" size="small" :disabled="!bgRemovalEnabled" />
            </div>
          </div>

          <div v-if="!bgRemovalEnabled" class="preprocess-hint">
            关闭时将直接使用原图生成 3D 模型
          </div>
          <template v-else>
            <p class="preprocess-desc">
              自动识别主体并扣除背景，避免深色背景被误识别为模型结构。
              <template v-if="useMultiViewWorkflow">多视图模式下可<strong>按视角独立</strong>进入微调（抠图、SAM 点选、手动编辑）；未处理的视角生成时将使用原图。</template>
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
                  <div class="preprocess-mv-actions">
                    <el-button link type="primary" size="small" @click="copyViewFace(face)">
                      复制
                    </el-button>
                    <el-button link type="danger" size="small" @click="removeViewFace(face)">
                      删除
                    </el-button>
                    <el-button
                      link
                      type="warning"
                      size="small"
                      :disabled="removingBg"
                      @click="openFineTuneEditor(face)"
                    >
                      微调
                    </el-button>
                  </div>
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
                v-if="canUndoBatchRemoveBg"
                type="info"
                plain
                class="undo-remove-bg-btn"
                :disabled="removingBg"
                @click="undoBatchRemoveBackground"
              >
                <el-icon><RefreshLeft /></el-icon>
                撤销抠图
              </el-button>
              <el-button
                v-if="hasPreprocessInput"
                type="warning"
                plain
                class="fine-tune-btn"
                :disabled="removingBg"
                @click="openFineTuneEditor()"
              >
                <el-icon><EditPen /></el-icon>
                逐个微调
              </el-button>
            </div>
            <p v-if="bgRemovalEnabled && preprocessAllReady" class="preprocess-ready">
              {{
                useMultiViewWorkflow
                  ? `全部 ${uploadedFaces.length} 个视角已处理，生成时将使用处理后的图片`
                  : '已生成透明底图像，生成时将使用处理后的图片'
              }}
            </p>
            <p v-else-if="bgRemovalEnabled && useMultiViewWorkflow && partialPreprocessCount > 0" class="preprocess-partial">
              已完成 {{ partialPreprocessCount }} / {{ uploadedFaces.length }} 个视角处理，其余视角将使用原图
            </p>
            <p v-else-if="bgRemovalEnabled && useMultiViewWorkflow && uploadedFaces.length" class="preprocess-partial">
              尚未处理任何视角，生成时将全部使用原图
            </p>
          </template>
        </section>

        <!-- Step 3: 镶嵌结构 -->
        <section
          id="step-inlay"
          class="sidebar-section inlay-section"
          :class="{ 'is-active': currentWorkflowStep === 'settings' }"
        >
          <div class="section-header">
            <div class="section-title">
              <span class="section-step">3</span>
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
        </section>

        <!-- Step 4: 生成参数 -->
        <section
          id="step-settings"
          class="sidebar-section"
          :class="{ 'is-active': currentWorkflowStep === 'settings' }"
        >
          <div class="section-header">
            <div class="section-title">
              <span class="section-step">4</span>
              <el-icon><Setting /></el-icon>
              <span>生成参数</span>
            </div>
          </div>

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

            <!-- 生成模式 -->
            <el-form-item label="生成模式">
              <el-radio-group v-model="generateParams.generation_mode" class="format-group">
                <el-radio-button value="fast">急速模式</el-radio-button>
                <el-radio-button value="quality">高质量模式</el-radio-button>
              </el-radio-group>
              <div class="format-hint">
                <span>急速模式：更快生成，接近旧版默认效果</span>
                <span>高质量模式：对称更规整、曲面更顺滑，耗时更长</span>
              </div>
            </el-form-item>
          </el-form>
        </section>
      </aside>

      <!-- 右侧：3D 预览画布 -->
      <main class="studio-canvas">
        <div class="canvas-card" :class="{ 'is-fullscreen': resultFullscreen }">
          <div class="canvas-header">
            <div class="canvas-title">
              <el-icon><PictureFilled /></el-icon>
              <span>3D 预览</span>
              <el-tag
                v-if="currentTask"
                :type="taskStatusTagType"
                size="small"
                effect="plain"
                class="canvas-status-tag"
              >
                {{ taskStatusLabel }}
              </el-tag>
            </div>
            <el-button
              class="result-fullscreen-btn"
              text
              :icon="resultFullscreen ? Close : FullScreen"
              :title="resultFullscreen ? '退出全屏 (Esc)' : '全屏预览'"
              @click="toggleResultFullscreen"
            />
          </div>

          <div class="canvas-body">
            <!-- 空状态 -->
            <div v-if="!currentTask" class="result-empty">
              <div class="empty-illustration">
                <el-icon :size="56"><Box /></el-icon>
              </div>
              <p class="empty-title">准备生成 3D 模型</p>
              <p class="result-hint">上传设计图并完成配置后，点击底部「开始生成」</p>
              <div class="empty-steps-hint">
                <span>上传</span>
                <span class="dot">→</span>
                <span>预处理</span>
                <span class="dot">→</span>
                <span>参数</span>
                <span class="dot">→</span>
                <span>生成</span>
              </div>
            </div>

            <!-- 生成中状态 -->
            <div v-else-if="currentTask.status === 'pending' || currentTask.status === 'queued' || currentTask.status === 'processing'" class="result-generating">
              <div class="progress-ring-wrap">
                <el-progress
                  type="circle"
                  :percentage="taskProgress"
                  :width="140"
                  :stroke-width="6"
                  :color="progressColor"
                  class="progress-ring"
                >
                  <template #default="{ percentage }">
                    <div class="progress-inner">
                      <span class="progress-text">{{ percentage }}%</span>
                      <span class="progress-sub">生成中</span>
                    </div>
                  </template>
                </el-progress>
              </div>
              <p class="generating-status">
                {{ currentTask.status === 'queued' ? '排队等待 GPU 推理...' : currentTask.status === 'pending' ? '任务已提交...' : '正在生成 3D 模型...' }}
              </p>
              <p class="generating-elapsed">已用时 {{ generationElapsedText }}</p>
              <p class="generating-hint">生成过程可能需要几分钟，请耐心等待</p>
            </div>

            <!-- 生成失败状态 -->
            <div v-else-if="currentTask.status === 'failed'" class="result-failed">
              <div class="failed-icon-wrap">
                <el-icon :size="40"><CircleCloseFilled /></el-icon>
              </div>
              <p class="failed-text">生成失败</p>
              <p v-if="lastGenerationDurationMs != null" class="generation-duration">
                本次生成用时 {{ lastGenerationDurationText }}
              </p>
              <p class="failed-reason">{{ currentTask.error_message || '未知错误' }}</p>
              <el-button type="primary" @click="startGenerate">重新生成</el-button>
            </div>

            <!-- 生成完成状态 -->
            <div v-else-if="currentTask.status === 'completed'" class="result-completed">
              <p v-if="lastGenerationDurationMs != null" class="generation-duration">
                本次生成用时 {{ lastGenerationDurationText }}
              </p>
              <div v-if="showModelPreviewModeToggle" class="model-preview-toolbar">
                <el-radio-group v-model="modelPreviewMode" size="small">
                  <el-radio-button value="colored">分色预览</el-radio-button>
                  <el-radio-button value="white">白模预览</el-radio-button>
                </el-radio-group>
                <span v-if="modelPreviewMode === 'colored'" class="preview-legend">
                  <span class="legend-swatch legend-inlay" />镶嵌结构
                  <span class="legend-swatch legend-generated" />AI 生成主体
                </span>
              </div>
              <div class="model-preview-wrapper">
                <ModelViewer
                  v-if="modelPreviewUrl"
                  :model-url="modelPreviewUrl"
                  :model-format="modelPreviewFormat"
                  :preview-mode="modelPreviewMode"
                  @error="onModelPreviewError"
                />
              </div>
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
      </main>
    </div>

    <!-- 底部固定操作栏 -->
    <div class="sticky-action-bar">
      <div class="action-bar-summary">
        <div class="summary-item" :class="{ ready: hasUploadContent }">
          <span class="summary-dot" />
          <span>{{ uploadSummaryText }}</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-item" :class="{ ready: !bgRemovalEnabled || preprocessAllReady }">
          <span class="summary-dot" />
          <span>{{ preprocessSummaryText }}</span>
        </div>
        <div class="summary-divider" />
        <div class="summary-item" :class="{ ready: canGenerate }">
          <span class="summary-dot" />
          <span>{{ generateSummaryText }}</span>
        </div>
      </div>
      <el-button
        type="primary"
        size="large"
        class="generate-btn"
        :loading="submitting"
        :disabled="!canGenerate"
        @click="startGenerate"
      >
        <el-icon v-if="!submitting"><VideoPlay /></el-icon>
        {{ submitting ? '提交中...' : '开始生成' }}
      </el-button>
    </div>

    <PreprocessEditor
      v-model:visible="editorVisible"
      :image-file="editorImageFile"
      :original-file="editorOriginalFile"
      :session-id="editorSessionId"
      :file-name="editorFileName"
      :gem-preset="gemPreset"
      :gem-sensitivity="gemSensitivity"
      :view-label="editorViewLabel"
      :batch-index="fineTuneBatchIndex"
      :batch-total="fineTuneBatchItems.length"
      :batch-labels="fineTuneBatchLabels"
      v-model:enable-gem-repaint="enableGemRepaint"
      v-model:gem-repaint-seed="gemRepaintSeed"
      @saved="onEditorSaved"
      @navigate="onEditorNavigate"
      @cancel="onEditorCancel"
    />

    <el-dialog v-model="copyViewDialogVisible" title="复制到其他视角" width="360px" append-to-body>
      <p class="copy-view-hint">
        将「{{ copyViewSource ? VIEW_LABELS[copyViewSource] : '' }}」复制到：
      </p>
      <el-select v-model="copyViewTarget" placeholder="选择目标视角" style="width: 100%">
        <el-option
          v-for="face in copyViewTargetOptions"
          :key="face"
          :label="VIEW_LABELS[face]"
          :value="face"
        />
      </el-select>
      <template #footer>
        <el-button @click="copyViewDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!copyViewTarget" @click="confirmCopyViewFace">
          确认复制
        </el-button>
      </template>
    </el-dialog>

    <GenerationDraftDrawer
      v-model="drawerVisible"
      :draft-list="draftList"
      :active-draft-id="activeDraftId"
      :format-updated-at="formatUpdatedAt"
      @restore="onRestoreDraft"
      @delete="onDeleteDraft"
      @new-draft="onNewDraft"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import {
  Upload, Grid, Setting, Box, Document, Files,
  VideoPlay, PictureFilled, CircleCloseFilled, Download, RefreshRight, RefreshLeft,
  ArrowUp, ArrowDown, Picture, Crop, EditPen, FullScreen, Close,
  FolderOpened,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import FileUpload from '@/components/FileUpload.vue'
import MultiViewUploader from '@/components/MultiViewUploader.vue'
import SheetSplitUploader from '@/components/SheetSplitUploader.vue'
import GenerationDraftDrawer from '@/components/GenerationDraftDrawer.vue'
import {
  useGenerationDraft,
  hasDraftContent,
  type DraftSnapshotInput,
} from '@/composables/useGenerationDraft'
import {
  useActiveGeneration,
  onActiveTaskComplete,
  onActiveTaskFailed,
  isActiveTaskStatus,
} from '@/composables/useActiveGeneration'
import {
  VIEW_FACES,
  VIEW_LABELS,
  hasMinimumViews,
  HY3D_SUPPORTED_FACES,
  type ViewFace,
  type ViewImages,
} from '@/types/multiView'
import InlaySelector from '@/components/InlaySelector.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import PreprocessEditor from '@/components/PreprocessEditor.vue'
import {
  generateImageTo3d,
  downloadResult as downloadResultApi,
  removeBackground,
  type GemPreset,
  fetchPreprocessPreview,
  type InlayInfo,
  type TaskDetail,
} from '@/api'

// ==========================================
// 状态
// ==========================================

const imageUploadRef = ref<InstanceType<typeof FileUpload> | null>(null)
const sheetSplitRef = ref<InstanceType<typeof SheetSplitUploader> | null>(null)
const uploadRemountKey = ref(0)
const isRestoringDraft = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null

const {
  draftList,
  activeDraftId,
  drawerVisible,
  saveDraftFromSnapshot,
  loadDraftForRestore,
  deleteDraft,
  startNewDraft,
  openDrawer,
  closeDrawer,
  formatUpdatedAt,
  refreshList,
} = useGenerationDraft()
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
const submitting = ref(false)
const {
  activeTask: currentTask,
  taskProgress,
  isGenerating,
  startPolling,
  resumePolling,
  clearActiveTask,
} = useActiveGeneration()
const bgRemovalEnabled = ref(false)
const enableGemRepaint = ref(false)
const gemRepaintSeed = ref(42)
const removingBg = ref(false)
const copyViewDialogVisible = ref(false)
const copyViewSource = ref<ViewFace | null>(null)
const copyViewTarget = ref<ViewFace | ''>('')
const gemPreset = ref<GemPreset>('ruby')
const gemSensitivity = ref(0.55)
const lastGemCoverage = ref<number | null>(null)
const processedImageFile = ref<File | null>(null)
const processedPreviewUrl = ref('')
const preprocessSessionId = ref('')
const processedViewFiles = ref<ViewImages>({})
const processedViewPreviewUrls = ref<Partial<Record<ViewFace, string>>>({})
const preprocessSessionIds = ref<Partial<Record<ViewFace, string>>>({})
const viewOriginalUrls = ref<Partial<Record<ViewFace, string>>>({})
const fineTuneFace = ref<ViewFace | null>(null)
const fineTuneBatchItems = ref<FineTuneBatchItem[]>([])
const fineTuneBatchIndex = ref(0)
const bgProcessProgress = ref('')

interface BatchRemoveBgSnapshot {
  multiView: boolean
  processedViewFiles?: ViewImages
  preprocessSessionIds?: Partial<Record<ViewFace, string>>
  processedImageFile?: File | null
  preprocessSessionId?: string
}

const batchRemoveBgUndoSnapshot = ref<BatchRemoveBgSnapshot | null>(null)
const canUndoBatchRemoveBg = computed(() => batchRemoveBgUndoSnapshot.value != null)

const editorVisible = ref(false)
const editorImageFile = ref<File | null>(null)
const editorOriginalFile = ref<File | null>(null)
const editorViewLabel = ref('')
const originalPreviewUrl = ref('')
const modelPreviewUrl = ref('')
const modelPreviewFormat = ref<'GLB' | 'OBJ' | 'STL'>('GLB')
const modelPreviewMode = ref<'white' | 'colored'>('colored')
const resultFullscreen = ref(false)

const generationElapsedMs = ref(0)
const lastGenerationDurationMs = ref<number | null>(null)
let generationTimerStart = 0
let generationTimerId: ReturnType<typeof setInterval> | null = null

function formatGenerationDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}小时${minutes}分${String(seconds).padStart(2, '0')}秒`
  }
  if (minutes > 0) {
    return `${minutes}分${String(seconds).padStart(2, '0')}秒`
  }
  return `${seconds}秒`
}

const generationElapsedText = computed(() => formatGenerationDuration(generationElapsedMs.value))
const lastGenerationDurationText = computed(() =>
  lastGenerationDurationMs.value != null
    ? formatGenerationDuration(lastGenerationDurationMs.value)
    : ''
)

function stopGenerationTimerInterval() {
  if (generationTimerId) {
    clearInterval(generationTimerId)
    generationTimerId = null
  }
}

function startGenerationTimer() {
  stopGenerationTimerInterval()
  generationElapsedMs.value = 0
  lastGenerationDurationMs.value = null
  generationTimerStart = Date.now()
  generationTimerId = setInterval(() => {
    generationElapsedMs.value = Date.now() - generationTimerStart
  }, 1000)
}

function finalizeGenerationTimer() {
  stopGenerationTimerInterval()
  const elapsed = Date.now() - generationTimerStart
  generationElapsedMs.value = elapsed
  lastGenerationDurationMs.value = elapsed
}

function resetGenerationTimer() {
  stopGenerationTimerInterval()
  generationElapsedMs.value = 0
  lastGenerationDurationMs.value = null
  generationTimerStart = 0
}

function notifyViewerResize() {
  nextTick(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  })
}

function setResultFullscreen(on: boolean) {
  resultFullscreen.value = on
  document.body.style.overflow = on ? 'hidden' : ''
  notifyViewerResize()
}

function toggleResultFullscreen() {
  setResultFullscreen(!resultFullscreen.value)
}

function onResultFullscreenKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && resultFullscreen.value) {
    setResultFullscreen(false)
  }
}

onMounted(() => {
  window.addEventListener('keydown', onResultFullscreenKeydown)
  window.addEventListener('beforeunload', onBeforeUnloadSave)
  refreshList()

  removeCompleteHandler = onActiveTaskComplete((detail) => {
    finalizeGenerationTimer()
    ElMessage.success('3D模型生成完成！')
    applyCompletedTaskPreview(detail)
  })

  removeFailedHandler = onActiveTaskFailed(() => {
    finalizeGenerationTimer()
    ElMessage.error('3D模型生成失败')
  })

  void resumePolling().then((detail) => {
    if (detail?.status === 'completed') {
      applyCompletedTaskPreview(detail)
      finalizeGenerationTimer()
    } else if (detail && isActiveTaskStatus(detail.status)) {
      startGenerationTimer()
    }
  })
})

let removeCompleteHandler: (() => void) | null = null
let removeFailedHandler: (() => void) | null = null

// 生成参数
const generateParams = ref({
  prompt: '',
  output_format: 'GLB' as 'OBJ' | 'GLB' | 'STL',
  generation_mode: 'fast' as 'fast' | 'quality',
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

const hasPreprocessInput = computed(() => canRunPreprocess.value)

const copyViewTargetOptions = computed(() => {
  if (!copyViewSource.value) return []
  return VIEW_FACES.filter((f) => f !== copyViewSource.value && !viewImages.value[f])
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
  if (useMultiViewWorkflow.value) {
    return hasMinimumViews(viewImages.value, 2)
  }
  if (!selectedImage.value) return false
  if (bgRemovalEnabled.value && !processedImageFile.value) return false
  return true
})

/** 本次任务是否使用了镶嵌结构（显示分色/白模切换） */
const showModelPreviewModeToggle = computed(
  () =>
    Boolean(
      modelPreviewUrl.value?.includes('/preview') && modelPreviewFormat.value === 'GLB'
    )
)

function getEffectiveViewFile(face: ViewFace): File | undefined {
  return processedViewFiles.value[face] ?? viewImages.value[face]
}

interface FineTuneBatchItem {
  key: string
  face?: ViewFace
  label: string
  imageFile: File
  originalFile: File
  sessionId?: string
}

function buildFineTuneBatchItems(): FineTuneBatchItem[] {
  if (useMultiViewWorkflow.value) {
    return uploadedFaces.value
      .map((face) => {
        const effective = getEffectiveViewFile(face)
        const original = viewImages.value[face]
        if (!effective || !original) return null
        return {
          key: face,
          face,
          label: VIEW_LABELS[face],
          imageFile: effective,
          originalFile: original,
          sessionId: preprocessSessionIds.value[face],
        }
      })
      .filter((item): item is FineTuneBatchItem => item != null)
  }

  const original = selectedImage.value
  if (!original) return []
  return [{
    key: 'single',
    label: '',
    imageFile: processedImageFile.value ?? original,
    originalFile: original,
    sessionId: preprocessSessionId.value || undefined,
  }]
}

const fineTuneBatchLabels = computed(() =>
  fineTuneBatchItems.value.map((item) => item.label || '图片')
)

function loadFineTuneBatchItem(index: number) {
  const item = fineTuneBatchItems.value[index]
  if (!item) return
  fineTuneBatchIndex.value = index
  fineTuneFace.value = item.face ?? null
  editorImageFile.value = item.imageFile
  editorOriginalFile.value = item.originalFile
  editorViewLabel.value = item.label
}

function resetFineTuneBatchState() {
  fineTuneBatchItems.value = []
  fineTuneBatchIndex.value = 0
}

function clearBatchRemoveBgUndo() {
  batchRemoveBgUndoSnapshot.value = null
}

function captureBatchRemoveBgSnapshot(): BatchRemoveBgSnapshot {
  if (useMultiViewWorkflow.value) {
    return {
      multiView: true,
      processedViewFiles: { ...processedViewFiles.value },
      preprocessSessionIds: { ...preprocessSessionIds.value },
    }
  }
  return {
    multiView: false,
    processedImageFile: processedImageFile.value,
    preprocessSessionId: preprocessSessionId.value,
  }
}

function undoBatchRemoveBackground() {
  const snap = batchRemoveBgUndoSnapshot.value
  if (!snap) return

  if (snap.multiView) {
    for (const face of VIEW_FACES) {
      const url = processedViewPreviewUrls.value[face]
      if (url) URL.revokeObjectURL(url)
    }
    processedViewPreviewUrls.value = {}
    processedViewFiles.value = { ...(snap.processedViewFiles ?? {}) }
    preprocessSessionIds.value = { ...(snap.preprocessSessionIds ?? {}) }
    for (const face of VIEW_FACES) {
      const file = processedViewFiles.value[face]
      if (file) {
        processedViewPreviewUrls.value[face] = URL.createObjectURL(file)
      }
    }
  } else {
    if (processedPreviewUrl.value) {
      URL.revokeObjectURL(processedPreviewUrl.value)
    }
    processedImageFile.value = snap.processedImageFile ?? null
    preprocessSessionId.value = snap.preprocessSessionId ?? ''
    processedPreviewUrl.value = snap.processedImageFile
      ? URL.createObjectURL(snap.processedImageFile)
      : ''
  }

  clearBatchRemoveBgUndo()
  ElMessage.success('已撤销最近一次一键抠图')
}

function applyEditorSavedPayload(payload: {
  file: File
  sessionId?: string
  gemCoverage?: number | null
}) {
  clearBatchRemoveBgUndo()
  const { file, sessionId, gemCoverage } = payload
  if (fineTuneFace.value) {
    const face = fineTuneFace.value
    if (processedViewPreviewUrls.value[face]) {
      URL.revokeObjectURL(processedViewPreviewUrls.value[face]!)
    }
    processedViewPreviewUrls.value[face] = URL.createObjectURL(file)
    processedViewFiles.value[face] = file
    if (sessionId) preprocessSessionIds.value[face] = sessionId
    bgRemovalEnabled.value = true
  } else {
    if (processedPreviewUrl.value) {
      URL.revokeObjectURL(processedPreviewUrl.value)
    }
    processedPreviewUrl.value = URL.createObjectURL(file)
    processedImageFile.value = file
    if (sessionId) preprocessSessionId.value = sessionId
    bgRemovalEnabled.value = true
  }
  if (gemCoverage != null) {
    lastGemCoverage.value = gemCoverage
  }

  const batchItem = fineTuneBatchItems.value[fineTuneBatchIndex.value]
  if (batchItem) {
    batchItem.imageFile = file
    if (sessionId) batchItem.sessionId = sessionId
  }
}

const editorSessionId = computed(() => {
  if (fineTuneFace.value) {
    return preprocessSessionIds.value[fineTuneFace.value] ?? ''
  }
  return preprocessSessionId.value
})

const editorFileName = computed(() => {
  if (fineTuneFace.value) {
    const face = fineTuneFace.value
    return processedViewFiles.value[face]?.name
      ?? viewImages.value[face]?.name
      ?? `${face}_edited.png`
  }
  return processedImageFile.value?.name
    ?? selectedImage.value?.name
    ?? 'edited.png'
})

// 进度条颜色
const progressColor = computed(() => {
  if (taskProgress.value < 30) return '#b8956a'
  if (taskProgress.value < 70) return '#d4a853'
  return '#22c55e'
})

// 工作流步骤
const hasUploadContent = computed(() => {
  if (useMultiViewWorkflow.value) {
    return uploadedFaces.value.length > 0
  }
  return !!selectedImage.value
})

const currentWorkflowStep = computed(() => {
  if (currentTask.value?.status === 'completed') return 'result'
  if (isGenerating.value || currentTask.value) return 'generate'
  if (hasUploadContent.value) return 'settings'
  return 'upload'
})

const workflowSteps = computed(() => [
  {
    id: 'upload',
    label: '上传',
    completed: hasUploadContent.value,
  },
  {
    id: 'preprocess',
    label: '预处理',
    completed: !bgRemovalEnabled.value || preprocessAllReady.value,
  },
  {
    id: 'settings',
    label: '参数设置',
    completed: hasUploadContent.value && canGenerate.value,
  },
  {
    id: 'generate',
    label: '生成',
    completed: currentTask.value?.status === 'completed',
  },
  {
    id: 'result',
    label: '结果',
    completed: currentTask.value?.status === 'completed',
  },
])

const taskStatusLabel = computed(() => {
  if (!currentTask.value) return ''
  const map: Record<string, string> = {
    pending: '等待中',
    queued: '排队中',
    processing: '生成中',
    completed: '已完成',
    failed: '失败',
  }
  return map[currentTask.value.status] ?? currentTask.value.status
})

const taskStatusTagType = computed(() => {
  if (!currentTask.value) return 'info'
  const map: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
    pending: 'info',
    queued: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
  }
  return map[currentTask.value.status] ?? 'info'
})

const uploadSummaryText = computed(() => {
  if (useMultiViewWorkflow.value) {
    const count = uploadedFaces.value.length
    if (count === 0) return '等待上传视角'
    return `已上传 ${count} 个视角`
  }
  return selectedImage.value ? '设计图已就绪' : '等待上传设计图'
})

const preprocessSummaryText = computed(() => {
  if (!bgRemovalEnabled.value) return '预处理已跳过'
  if (preprocessAllReady.value) return '背景已处理'
  if (partialPreprocessCount.value > 0) {
    return `部分处理 ${partialPreprocessCount.value}/${uploadedFaces.value.length}`
  }
  return '等待背景处理'
})

const generateSummaryText = computed(() => {
  if (isGenerating.value) return '正在生成...'
  if (currentTask.value?.status === 'completed') return '生成完成'
  if (canGenerate.value) return '可以开始生成'
  return '请完成上传与配置'
})

// ==========================================
// 草稿箱
// ==========================================

function buildDraftSnapshot(): DraftSnapshotInput {
  const sheetPersist = uploadMode.value === 'sheet'
    ? sheetSplitRef.value?.getPersistState() ?? null
    : null

  return {
    uploadMode: uploadMode.value,
    generateParams: { ...generateParams.value },
    inlayEnabled: inlayEnabled.value,
    inlayPanelOpen: inlayPanelOpen.value,
    selectedInlay: selectedInlay.value,
    bgRemovalEnabled: bgRemovalEnabled.value,
    enableGemRepaint: enableGemRepaint.value,
    gemRepaintSeed: gemRepaintSeed.value,
    gemPreset: gemPreset.value,
    gemSensitivity: gemSensitivity.value,
    lastGemCoverage: lastGemCoverage.value,
    preprocessSessionId: preprocessSessionId.value,
    preprocessSessionIds: { ...preprocessSessionIds.value },
    selectedImage: selectedImage.value,
    processedImageFile: processedImageFile.value,
    viewImages: { ...viewImages.value },
    processedViewFiles: { ...processedViewFiles.value },
    sheetSource: sheetPersist?.sourceFile ?? null,
    sheetState: sheetPersist
      ? {
          splitResult: sheetPersist.splitResult,
          splitMode: sheetPersist.splitMode,
          editorTool: sheetPersist.editorTool,
          assignments: sheetPersist.assignments,
          transforms: sheetPersist.transforms,
          cropBlobs: sheetPersist.cropBlobs,
        }
      : null,
  }
}

function scheduleAutoSave() {
  if (isRestoringDraft.value || submitting.value) return
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    void flushAutoSave()
  }, 1500)
}

async function flushAutoSave() {
  if (isRestoringDraft.value || submitting.value) return
  const snapshot = buildDraftSnapshot()
  if (!hasDraftContent(snapshot)) return
  try {
    await saveDraftFromSnapshot(snapshot, { draftId: activeDraftId.value })
  } catch {
    // 静默失败，避免打断用户操作
  }
}

function onBeforeUnloadSave() {
  if (isRestoringDraft.value || submitting.value) return
  const snapshot = buildDraftSnapshot()
  if (!hasDraftContent(snapshot)) return
  void saveDraftFromSnapshot(snapshot, { draftId: activeDraftId.value })
}

function revokeAllPreviewUrls() {
  if (originalPreviewUrl.value) {
    URL.revokeObjectURL(originalPreviewUrl.value)
    originalPreviewUrl.value = ''
  }
  if (processedPreviewUrl.value) {
    URL.revokeObjectURL(processedPreviewUrl.value)
    processedPreviewUrl.value = ''
  }
  for (const face of VIEW_FACES) {
    const orig = viewOriginalUrls.value[face]
    if (orig) URL.revokeObjectURL(orig)
    const proc = processedViewPreviewUrls.value[face]
    if (proc) URL.revokeObjectURL(proc)
  }
}

function clearWorkflowState() {
  clearActiveTask()
  resetGenerationTimer()
  modelPreviewUrl.value = ''
  modelPreviewMode.value = 'colored'
  uploadMode.value = 'single'
  selectedImage.value = null
  viewImages.value = {}
  imageUploadRef.value?.removeFile()
  resetPreprocessState()
  revokeAllPreviewUrls()
  inlayEnabled.value = false
  inlayPanelOpen.value = false
  selectedInlay.value = null
  lastGemCoverage.value = null
  bgRemovalEnabled.value = false
  generateParams.value = { prompt: '', output_format: 'GLB', generation_mode: 'fast' }
  uploadRemountKey.value += 1
}

async function onRestoreDraft(draftId: string) {
  const data = await loadDraftForRestore(draftId)
  if (!data) {
    ElMessage.error('草稿加载失败或已损坏')
    return
  }

  isRestoringDraft.value = true
  try {
    clearWorkflowState()
    activeDraftId.value = draftId

    const { payload } = data
    uploadMode.value = payload.uploadMode
    generateParams.value = {
      ...payload.generateParams,
      generation_mode: payload.generateParams.generation_mode ?? 'fast',
    }
    inlayEnabled.value = payload.inlayEnabled
    inlayPanelOpen.value = payload.inlayPanelOpen
    selectedInlay.value = payload.selectedInlay
    bgRemovalEnabled.value = payload.bgRemovalEnabled
    enableGemRepaint.value = payload.enableGemRepaint ?? false
    gemRepaintSeed.value = payload.gemRepaintSeed ?? 42
    gemPreset.value = payload.gemPreset
    gemSensitivity.value = payload.gemSensitivity
    lastGemCoverage.value = payload.lastGemCoverage
    preprocessSessionId.value = payload.preprocessSessionId
    preprocessSessionIds.value = { ...payload.preprocessSessionIds }

    uploadRemountKey.value += 1
    await nextTick()

    if (payload.uploadMode === 'single' && data.selectedImage) {
      selectedImage.value = data.selectedImage
      originalPreviewUrl.value = URL.createObjectURL(data.selectedImage)
      imageUploadRef.value?.setFileSilent(data.selectedImage)
    }

    if (payload.uploadMode === 'sheet' && data.sheetSource && payload.sheetState) {
      await sheetSplitRef.value?.restoreFromState({
        sourceFile: data.sheetSource,
        splitResult: payload.sheetState.splitResult,
        splitMode: payload.sheetState.splitMode,
        editorTool: payload.sheetState.editorTool,
        assignments: payload.sheetState.assignments,
        transforms: payload.sheetState.transforms,
        cropBlobs: data.sheetCropBlobs,
      })
    }

    if (Object.keys(data.viewImages).length) {
      viewImages.value = { ...data.viewImages }
      for (const face of VIEW_FACES) {
        const file = data.viewImages[face]
        if (!file) {
          delete viewFileRev.value[face]
          continue
        }
        viewFileRev.value[face] = `${file.name}:${file.size}:${file.lastModified}`
        viewOriginalUrls.value[face] = URL.createObjectURL(file)
      }
    }

    if (data.processedImageFile) {
      processedImageFile.value = data.processedImageFile
      processedPreviewUrl.value = URL.createObjectURL(data.processedImageFile)
    }

    processedViewFiles.value = { ...data.processedViewFiles }
    for (const face of VIEW_FACES) {
      const file = data.processedViewFiles[face]
      if (file) {
        processedViewPreviewUrls.value[face] = URL.createObjectURL(file)
      }
    }

    closeDrawer()
    ElMessage.success('草稿已恢复，可继续编辑')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '草稿恢复失败')
  } finally {
    isRestoringDraft.value = false
  }
}

async function onDeleteDraft(draftId: string) {
  await deleteDraft(draftId)
  ElMessage.success('草稿已删除')
}

function onNewDraft() {
  clearWorkflowState()
  startNewDraft()
  uploadMode.value = 'single'
  closeDrawer()
  ElMessage.success('已新建空白草稿')
}

watch(
  [
    uploadMode,
    generateParams,
    inlayEnabled,
    inlayPanelOpen,
    selectedInlay,
    bgRemovalEnabled,
    enableGemRepaint,
    gemRepaintSeed,
    gemPreset,
    gemSensitivity,
    lastGemCoverage,
    selectedImage,
    processedImageFile,
    viewImages,
    processedViewFiles,
    preprocessSessionId,
    preprocessSessionIds,
  ],
  () => scheduleAutoSave(),
  { deep: true }
)

// ==========================================
// 方法
// ==========================================

const viewFileRev = ref<Partial<Record<ViewFace, string>>>({})

watch(
  () => viewImages.value,
  (views) => {
    if (!useMultiViewWorkflow.value || isRestoringDraft.value) return
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
  clearBatchRemoveBgUndo()
  if (processedPreviewUrl.value) {
    URL.revokeObjectURL(processedPreviewUrl.value)
  }
  processedPreviewUrl.value = ''
  processedImageFile.value = null
  preprocessSessionId.value = ''
  fineTuneFace.value = null
  resetFineTuneBatchState()
  editorVisible.value = false
  editorImageFile.value = null
  editorOriginalFile.value = null
  editorViewLabel.value = ''

  for (const face of VIEW_FACES) {
    resetFacePreprocess(face)
  }
  for (const face of VIEW_FACES) {
    const url = viewOriginalUrls.value[face]
    if (url) URL.revokeObjectURL(url)
  }
  viewOriginalUrls.value = {}
  viewFileRev.value = {}
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
  const undoSnapshot = captureBatchRemoveBgSnapshot()

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
      if (ok > 0) {
        batchRemoveBgUndoSnapshot.value = undoSnapshot
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
    batchRemoveBgUndoSnapshot.value = undoSnapshot
    ElMessage.success('背景扣除完成')
  } catch (err: any) {
    ElMessage.error(err.message || '背景扣除失败')
  } finally {
    removingBg.value = false
  }
}

function removeViewFace(face: ViewFace) {
  if (!viewImages.value[face]) return
  const next = { ...viewImages.value }
  delete next[face]
  viewImages.value = next
  resetFacePreprocess(face)
  ElMessage.success(`已删除${VIEW_LABELS[face]}`)
}

function copyViewFace(from: ViewFace) {
  if (!viewImages.value[from]) return
  const targets = VIEW_FACES.filter((f) => f !== from && !viewImages.value[f])
  if (!targets.length) {
    ElMessage.warning('没有空闲视角槽位')
    return
  }
  copyViewSource.value = from
  copyViewTarget.value =
    targets.find((f) => HY3D_SUPPORTED_FACES.includes(f)) ?? targets[0]
  copyViewDialogVisible.value = true
}

function confirmCopyViewFace() {
  const from = copyViewSource.value
  const to = copyViewTarget.value
  if (!from || !to) return

  const sourceFile = processedViewFiles.value[from] ?? viewImages.value[from]
  if (!sourceFile) return

  const copy = new File(
    [sourceFile],
    `${to}_${sourceFile.name}`,
    { type: sourceFile.type || 'image/png' }
  )

  viewImages.value = { ...viewImages.value, [to]: copy }

  if (processedViewFiles.value[from]) {
    processedViewFiles.value[to] = copy
    const oldUrl = processedViewPreviewUrls.value[to]
    if (oldUrl) URL.revokeObjectURL(oldUrl)
    processedViewPreviewUrls.value[to] = URL.createObjectURL(copy)
    if (preprocessSessionIds.value[from]) {
      preprocessSessionIds.value[to] = preprocessSessionIds.value[from]
    }
  }

  copyViewDialogVisible.value = false
  ElMessage.success(`已复制到${VIEW_LABELS[to]}`)
}

function openFineTuneEditor(face?: ViewFace) {
  if (face) {
    const effective = getEffectiveViewFile(face)
    const original = viewImages.value[face]
    if (!effective) {
      ElMessage.warning(`${VIEW_LABELS[face]} 无可用图片`)
      return
    }
    resetFineTuneBatchState()
    fineTuneBatchItems.value = [{
      key: face,
      face,
      label: VIEW_LABELS[face],
      imageFile: effective,
      originalFile: original ?? effective,
      sessionId: preprocessSessionIds.value[face],
    }]
    loadFineTuneBatchItem(0)
    editorVisible.value = true
    return
  }

  const items = buildFineTuneBatchItems()
  if (!items.length) {
    ElMessage.warning(useMultiViewWorkflow.value ? '请至少上传 1 个视角图片' : '请先上传设计图')
    return
  }
  fineTuneBatchItems.value = items
  loadFineTuneBatchItem(0)
  editorVisible.value = true
}

function onEditorNavigate(index: number) {
  loadFineTuneBatchItem(index)
}

function onEditorCancel() {
  resetFineTuneBatchState()
  fineTuneFace.value = null
}

function onEditorSaved(payload: {
  file: File
  sessionId?: string
  gemCoverage?: number | null
  gemPreset?: GemPreset
  gemSensitivity?: number
  advance?: boolean
}) {
  applyEditorSavedPayload(payload)
  if (payload.gemPreset) gemPreset.value = payload.gemPreset
  if (payload.gemSensitivity != null) gemSensitivity.value = payload.gemSensitivity

  if (payload.advance && fineTuneBatchIndex.value < fineTuneBatchItems.value.length - 1) {
    loadFineTuneBatchItem(fineTuneBatchIndex.value + 1)
    return
  }

  resetFineTuneBatchState()
}

/** 获取用于生成的单图（非多视图模式） */
function getImageForGenerate(): File | null {
  if (bgRemovalEnabled.value && processedImageFile.value) {
    return processedImageFile.value
  }
  return selectedImage.value
}

/** 获取多视图图片集（优先使用各视角预处理结果，否则原图） */
function getViewsForGenerate(): ViewImages {
  const views: ViewImages = { ...viewImages.value }
  for (const face of VIEW_FACES) {
    if (views[face]) {
      views[face] = getEffectiveViewFile(face)!
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

function applyCompletedTaskPreview(detail: TaskDetail) {
  const taskId = detail.task_id
  if (detail.preview_url) {
    modelPreviewUrl.value = detail.preview_url
    modelPreviewFormat.value = 'GLB'
    modelPreviewMode.value = 'colored'
    return
  }
  modelPreviewUrl.value = `/api/tasks/${taskId}/download`
  modelPreviewFormat.value = generateParams.value.output_format
  modelPreviewMode.value = 'white'
}

/** 开始生成 */
async function startGenerate() {
  if (useMultiViewWorkflow.value) {
    if (!hasMinimumViews(viewImages.value, 2)) {
      ElMessage.warning('多视图模式下至少需要上传 2 个视角')
      return
    }
  } else {
    const imageFile = getImageForGenerate()
    if (!imageFile) {
      ElMessage.warning(bgRemovalEnabled.value ? '请先完成背景扣除' : '请先上传设计图')
      return
    }
  }

  submitting.value = true
  startGenerationTimer()
  modelPreviewUrl.value = ''
  modelPreviewMode.value = 'colored'

  try {
    const imageFile = useMultiViewWorkflow.value ? null : getImageForGenerate()
    const inputLabel = useMultiViewWorkflow.value
      ? `多视图(${Object.keys(getViewsForGenerate()).length}张)`
      : (imageFile?.name ?? '')

    const params = {
      ...generateParams.value,
      multi_view_enabled: useMultiViewWorkflow.value,
    }
    if (inlayEnabled.value) {
      if (!selectedInlay.value?.id) {
        ElMessage.warning('已启用镶嵌结构，请先选择镶嵌结构')
        resetGenerationTimer()
        return
      }
      params.inlay_structure_filename = selectedInlay.value.id
    }

    const result = await generateImageTo3d(
      imageFile,
      params,
      useMultiViewWorkflow.value ? getViewsForGenerate() : undefined
    )

    const taskId = (result.data as any).task_id || (result.data as any).taskId
    currentTask.value = {
      task_id: taskId,
      input_file: inputLabel,
      status: (result.data.status as TaskDetail['status']) || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    ElMessage.success('任务已提交，正在生成中...')
    startPolling(taskId)
  } catch (err: any) {
    ElMessage.error(err.message || '生成任务提交失败')
    resetGenerationTimer()
  } finally {
    submitting.value = false
  }
}

/** 分色 GLB 预览失败时回退到白模下载文件 */
function onModelPreviewError(message: string) {
  const taskId = currentTask.value?.task_id
  if (
    !taskId ||
    modelPreviewFormat.value !== 'GLB' ||
    !modelPreviewUrl.value.includes('/preview')
  ) {
    return
  }
  console.warn('colored GLB preview failed:', message)
  const permanent =
    message.includes('不存在') ||
    message.includes('JSON') ||
    message.includes('magic') ||
    message.includes('解析错误')
  ElMessage.warning(
    permanent
      ? `分色预览不可用：${message}`
      : `分色预览加载失败：${message}，已切换为白模预览`,
  )
  modelPreviewUrl.value = `/api/tasks/${taskId}/download`
  modelPreviewFormat.value = generateParams.value.output_format
  modelPreviewMode.value = 'white'
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

// 组件卸载时清理（轮询由全局 composable 维持，不在此停止）
onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  void flushAutoSave()
  removeCompleteHandler?.()
  removeFailedHandler?.()
  stopGenerationTimerInterval()
  resetPreprocessState()
  window.removeEventListener('keydown', onResultFullscreenKeydown)
  window.removeEventListener('beforeunload', onBeforeUnloadSave)
  if (resultFullscreen.value) {
    document.body.style.overflow = ''
  }
  revokeAllPreviewUrls()
})
</script>

<style scoped>
.home-view {
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
  padding-bottom: calc(var(--action-bar-height) + 16px);
  min-height: calc(100vh - var(--header-height) - 20px);
}

/* ── 工作流步骤条 ── */
.workflow-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.workflow-steps {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  min-width: 0;
}

.workflow-step {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.step-indicator {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-subtle);
  border: 2px solid var(--border-strong);
  flex-shrink: 0;
  transition: all 0.25s ease;
}

.step-num {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
}

.step-check {
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}

.step-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
  white-space: nowrap;
  transition: color 0.25s ease;
}

.step-connector {
  width: 32px;
  height: 2px;
  background: var(--border-strong);
  margin: 0 12px;
  flex-shrink: 0;
}

.workflow-step.is-completed .step-indicator {
  background: #22c55e;
  border-color: #22c55e;
}

.workflow-step.is-completed .step-label {
  color: var(--text-secondary);
}

.workflow-step.is-active .step-indicator {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-light);
}

.workflow-step.is-active .step-num {
  color: #fff;
}

.workflow-step.is-active .step-label {
  color: var(--text-primary);
  font-weight: 600;
}

.workflow-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.draft-count-badge :deep(.el-badge__content) {
  transform: none;
  position: static;
  display: inline-flex;
  vertical-align: middle;
}

/* ── 工作室布局 ── */
.studio-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  gap: clamp(16px, 1.5vw, 28px);
  align-items: start;
  min-width: 0;
  flex: 1;
  width: 100%;
}

.studio-sidebar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  max-height: calc(100vh - var(--header-height) - var(--action-bar-height) - 100px);
  overflow-y: auto;
  padding-right: 4px;
}

.studio-canvas {
  position: sticky;
  top: calc(var(--header-height) + 12px);
  min-width: 0;
}

/* ── 侧边栏分区 ── */
.section-desc {
  margin: 0 0 14px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.65;
}

.section-header .el-radio-group {
  flex-shrink: 0;
}

/* 参数表单 */
.params-form {
  margin-top: 0;
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
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* 镶嵌结构 */
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
  background: var(--bg-subtle);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.inlay-collapsed-hint .selected-name {
  color: var(--text-primary);
  font-weight: 500;
}

/* 图像预处理 */
.preprocess-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gem-repaint-label {
  margin-left: 8px;
}

.preprocess-switch-label {
  font-size: 12px;
  color: var(--text-muted);
}

.preprocess-hint,
.preprocess-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.65;
  margin: 0 0 12px 0;
}

.preprocess-compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.compare-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.compare-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.compare-frame {
  height: 120px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-subtle);
}

.compare-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.compare-frame.checkerboard {
  background-image:
    linear-gradient(45deg, #ddd 25%, transparent 25%),
    linear-gradient(-45deg, #ddd 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd 75%),
    linear-gradient(-45deg, transparent 75%, #ddd 75%);
  background-size: 14px 14px;
  background-position: 0 0, 0 7px, 7px -7px, -7px 0;
  background-color: #fff;
}

.compare-placeholder {
  font-size: 11px;
  color: var(--text-muted);
  padding: 8px;
  text-align: center;
}

.remove-bg-btn {
  flex: 1;
}

.undo-remove-bg-btn,
.fine-tune-btn {
  flex-shrink: 0;
}

.preprocess-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preprocess-ready {
  margin: 10px 0 0;
  font-size: 12px;
  color: #22c55e;
}

.preprocess-partial {
  margin: 10px 0 0;
  font-size: 12px;
  color: #d4a853;
}

.preprocess-mv-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.preprocess-mv-item {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 10px;
  background: var(--bg-subtle);
}

.preprocess-mv-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.preprocess-mv-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px 4px;
}

.preprocess-mv-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.preprocess-compare--compact {
  margin-bottom: 0;
}

.compare-frame--sm {
  height: 72px;
}

.copy-view-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

/* ── 3D 画布 ── */
.canvas-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - var(--header-height) - var(--action-bar-height) - 100px);
  overflow: hidden;
}

.canvas-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
}

.canvas-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.canvas-title .el-icon {
  color: var(--accent);
}

.canvas-status-tag {
  margin-left: 4px;
}

.canvas-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
}

.result-fullscreen-btn {
  flex-shrink: 0;
  font-size: 18px;
  color: var(--text-secondary);
}

.result-fullscreen-btn:hover {
  color: var(--accent);
}

.canvas-card.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  width: 100vw;
  height: 100vh;
  min-height: 100vh;
  margin: 0;
  border-radius: 0;
  box-shadow: none;
}

.canvas-card.is-fullscreen .canvas-body {
  flex: 1;
}

.canvas-card.is-fullscreen .model-preview-wrapper {
  flex: 1;
  height: auto;
  min-height: 0;
}

/* 空状态 */
.result-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 32px;
  background: linear-gradient(180deg, var(--bg-subtle) 0%, var(--card-bg) 100%);
}

.empty-illustration {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  margin-bottom: 8px;
}

.empty-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.result-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

.empty-steps-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-muted);
}

.empty-steps-hint .dot {
  color: var(--accent);
}

/* 生成中 */
.result-generating {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 32px;
}

.progress-ring-wrap {
  position: relative;
  padding: 8px;
}

.progress-ring-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}

.progress-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.progress-text {
  font-size: 26px;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.progress-sub {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.generating-status {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.generating-elapsed,
.generation-duration {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.generating-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}

/* 失败状态 */
.result-failed {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 32px;
}

.failed-icon-wrap {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(245, 108, 108, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f56c6c;
}

.failed-text {
  font-size: 16px;
  font-weight: 600;
  color: #f56c6c;
  margin: 0;
}

.failed-reason {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 360px;
  text-align: center;
  margin: 0;
}

/* 完成状态 */
.result-completed {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 20px;
  min-height: 0;
}

.model-preview-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.preview-legend {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.legend-swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  margin-right: 4px;
}

.legend-inlay {
  background: var(--accent);
}

.legend-generated {
  background: #409eff;
  margin-left: 8px;
}

.model-preview-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-subtle);
  border: 1px solid var(--border-color);
  margin-bottom: 16px;
}

.model-preview-wrapper :deep(.model-viewer) {
  flex: 1;
  min-height: 0;
  height: auto;
}

.result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-shrink: 0;
}

/* ── 底部固定操作栏 ── */
.sticky-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--action-bar-height);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--border-color);
  box-shadow: 0 -4px 24px rgba(28, 25, 23, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  z-index: 150;
  gap: 20px;
}

.action-bar-summary {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.summary-item.ready {
  color: var(--text-secondary);
}

.summary-item.ready .summary-dot {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
}

.summary-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-strong);
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.summary-divider {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  flex-shrink: 0;
}

.generate-btn {
  min-width: 160px;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  letter-spacing: 0.02em;
}

/* ── 响应式 ── */
@media (max-width: 1200px) {
  .studio-layout {
    grid-template-columns: 360px minmax(0, 1fr);
  }
}

@media (max-width: 1024px) {
  .studio-layout {
    grid-template-columns: 1fr;
  }

  .studio-sidebar {
    max-height: none;
    overflow-y: visible;
  }

  .studio-canvas {
    position: static;
  }

  .canvas-card {
    min-height: 480px;
  }

  .workflow-steps {
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .action-bar-summary {
    display: none;
  }

  .sticky-action-bar {
    justify-content: center;
    padding: 0 16px;
  }

  .generate-btn {
    width: 100%;
    max-width: 400px;
  }
}

@media (max-width: 640px) {
  .workflow-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .step-connector {
    width: 16px;
    margin: 0 6px;
  }

  .step-label {
    font-size: 11px;
  }
}
</style>
