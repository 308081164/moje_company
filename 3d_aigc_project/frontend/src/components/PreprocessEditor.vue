<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="min(92vw, 960px)"
    :close-on-click-modal="false"
    append-to-body
    destroy-on-close
    class="preprocess-editor-dialog"
    @opened="onDialogOpened"
    @closed="onDialogClosed"
  >
    <div v-if="batchTotal > 1" class="batch-nav">
      <el-button
        size="small"
        :disabled="batchIndex <= 0 || loading || saving"
        @click="requestNavigate(batchIndex - 1)"
      >
        上一张
      </el-button>
      <el-radio-group
        :model-value="batchIndex"
        size="small"
        class="batch-tabs"
        @change="(v: string | number | boolean) => requestNavigate(Number(v))"
      >
        <el-radio-button
          v-for="(label, i) in batchLabels"
          :key="i"
          :value="i"
        >
          {{ label }}
        </el-radio-button>
      </el-radio-group>
      <el-button
        size="small"
        :disabled="batchIndex >= batchTotal - 1 || loading || saving"
        @click="requestNavigate(batchIndex + 1)"
      >
        下一张
      </el-button>
      <span class="batch-counter">{{ batchIndex + 1 }} / {{ batchTotal }}</span>
    </div>

    <el-tabs v-model="activeTab" class="editor-tabs" @tab-change="onTabChange">
      <el-tab-pane label="抠图" name="matting" />
      <el-tab-pane label="AI 去反光" name="repaint" />
      <el-tab-pane label="SAM 点选" name="sam" />
      <el-tab-pane label="手动编辑" name="manual" />
    </el-tabs>

    <p class="editor-hint">{{ tabHint }}</p>

    <div v-if="activeTab === 'repaint'" class="repaint-bar">
      <span class="toolbar-label">通义万相蒙版去反光</span>
      <span class="repaint-note">
        拖拽框选宝石主石区域（绿色半透明预览），仅蒙版内去反光；强度建议 0.15–0.30
      </span>
      <el-checkbox v-model="repaintUseMask" size="small">使用蒙版（推荐）</el-checkbox>
      <template v-if="repaintUseMask">
        <el-radio-group v-model="repaintMaskTool" size="small">
          <el-radio-button value="rect">框选宝石</el-radio-button>
          <el-radio-button value="eraser">框选擦除</el-radio-button>
          <el-radio-button value="brush">涂抹宝石</el-radio-button>
        </el-radio-group>
        <template v-if="repaintMaskTool === 'brush'">
          <span class="toolbar-label">笔刷</span>
          <el-slider
            v-model="brushSize"
            :min="4"
            :max="80"
            :step="2"
            class="repaint-brush-slider"
          />
        </template>
        <el-button size="small" @click="clearRepaintMask">清除蒙版</el-button>
      </template>
      <span class="toolbar-label">强度</span>
      <el-slider
        v-model="localGemRepaintStrength"
        :min="0.1"
        :max="0.45"
        :step="0.05"
        :format-tooltip="(v: number) => v.toFixed(2)"
        class="gem-repaint-strength-slider"
      />
    </div>

    <div class="editor-toolbar">
      <!-- 抠图 -->
      <template v-if="activeTab === 'matting'">
        <el-button
          type="primary"
          size="small"
          :loading="matting"
          :disabled="loading || matting || !originalFile"
          @click="runMatting"
        >
          执行抠图
        </el-button>
        <span class="toolbar-note">基于原图自动扣除背景，可撤销后重试</span>
      </template>

      <!-- AI 去反光：整图重绘 -->
      <template v-else-if="activeTab === 'repaint'">
        <el-button
          type="primary"
          :loading="applyingRepaint"
          :disabled="applyingRepaint || loading || !props.imageFile"
          @click="applyGemRepaint"
        >
          一键 AI 去反光重绘
        </el-button>
        <span class="toolbar-note">蒙版模式：先框选主石再重绘；关闭蒙版则整图编辑（易误删主石）</span>
      </template>

      <!-- SAM -->
      <template v-else-if="activeTab === 'sam'">
        <el-select
          v-model="localGemPreset"
          size="small"
          class="gem-preset-select"
          :disabled="segmenting || applyingSam || applyingHsv"
        >
          <el-option label="红宝石" value="ruby" />
          <el-option label="蓝宝石" value="sapphire" />
          <el-option label="祖母绿" value="emerald" />
          <el-option label="钻石 (灰蓝)" value="diamond" />
          <el-option label="紫水晶" value="amethyst" />
        </el-select>
        <el-button
          size="small"
          type="success"
          plain
          :loading="applyingHsv"
          :disabled="applyingHsv || applyingSam || segmenting || loading || !props.imageFile"
          @click="applyHsvFlatten"
        >
          自动检测（HSV）
        </el-button>
        <el-button
          size="small"
          :disabled="!points.length || segmenting || applyingSam || applyingHsv"
          @click="clearSamPoints"
        >
          清除点选
        </el-button>
        <el-button
          size="small"
          type="primary"
          plain
          :loading="segmenting"
          :disabled="positiveCount === 0 || segmenting || applyingSam || applyingHsv"
          @click="previewMask"
        >
          预览蒙版
        </el-button>
        <el-button
          size="small"
          type="success"
          :loading="applyingSam"
          :disabled="positiveCount === 0 || applyingSam || applyingHsv || applyingRepaint || loading"
          @click="applySamFlatten"
        >
          应用占位色
        </el-button>
        <span v-if="samCoverage != null" class="coverage-tag">
          覆盖约 {{ (samCoverage * 100).toFixed(1) }}%
        </span>
      </template>

      <!-- 手动编辑 -->
      <template v-else>
        <el-radio-group v-model="tool" size="small" @change="onToolChange">
          <el-radio-button value="erase">
            <el-icon><Brush /></el-icon>
            擦除笔
          </el-radio-button>
          <el-radio-button value="restore">
            <el-icon><RefreshLeft /></el-icon>
            恢复笔
          </el-radio-button>
          <el-radio-button value="colorPick">
            <el-icon><Aim /></el-icon>
            取色消除
          </el-radio-button>
          <el-radio-button value="pen">
            <el-icon><EditPen /></el-icon>
            钢笔圈画
          </el-radio-button>
        </el-radio-group>

        <div v-if="tool === 'erase' || tool === 'restore'" class="brush-control">
          <span class="brush-label">笔刷</span>
          <el-slider
            v-model="brushSize"
            :min="1"
            :max="80"
            :show-tooltip="true"
            :format-tooltip="(v: number) => `${v}px`"
            style="width: 120px"
          />
        </div>

        <div v-if="tool === 'colorPick'" class="brush-control">
          <span class="brush-label">容差</span>
          <el-slider
            v-model="colorTolerance"
            :min="0"
            :max="100"
            :show-tooltip="true"
            :format-tooltip="(v: number) => `${v}`"
            style="width: 120px"
          />
          <span
            v-if="pickedColor"
            class="picked-color-swatch"
            :style="{ background: pickedColorCss }"
            :title="pickedColorCss"
          />
        </div>

        <el-button
          v-if="tool === 'pen' && penPoints.length >= 3"
          size="small"
          type="primary"
          @click="closePenPath"
        >
          闭合
        </el-button>
      </template>

      <el-button size="small" :disabled="!canUndo" @click="handleUndo">
        <el-icon><RefreshLeft /></el-icon>
        撤销
      </el-button>

      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
    </div>

    <div v-if="activeTab === 'repaint' && repaintCompareVisible" class="repaint-compare-bar">
      <div class="repaint-compare-header">
        <span class="toolbar-label">去反光结果对比</span>
        <el-radio-group v-model="repaintCompareMode" size="small">
          <el-radio-button value="before">原图</el-radio-button>
          <el-radio-button value="after">结果</el-radio-button>
          <el-radio-button value="split">对比</el-radio-button>
        </el-radio-group>
        <div class="repaint-compare-actions">
          <el-button type="primary" size="small" @click="acceptRepaintResult">
            应用结果
          </el-button>
          <el-button size="small" @click="rejectRepaintResult">
            放弃 / 重试
          </el-button>
        </div>
      </div>
      <div
        class="repaint-compare-panel"
        :class="{ 'is-split': repaintCompareMode === 'split' }"
      >
        <template v-if="repaintCompareMode === 'split'">
          <div class="repaint-compare-item">
            <span class="repaint-compare-label">原图</span>
            <div class="repaint-compare-frame checkerboard">
              <img :src="repaintBeforeUrl" alt="去反光前" />
            </div>
          </div>
          <div class="repaint-compare-item">
            <span class="repaint-compare-label">结果</span>
            <div class="repaint-compare-frame checkerboard">
              <img :src="repaintAfterUrl" alt="去反光后" />
            </div>
          </div>
        </template>
        <template v-else>
          <div class="repaint-compare-item repaint-compare-item--single">
            <span class="repaint-compare-label">
              {{ repaintCompareMode === 'before' ? '原图' : '结果' }}
            </span>
            <div class="repaint-compare-frame checkerboard">
              <img
                :src="repaintCompareMode === 'before' ? repaintBeforeUrl : repaintAfterUrl"
                :alt="repaintCompareMode === 'before' ? '去反光前' : '去反光后'"
              />
            </div>
          </div>
        </template>
      </div>
    </div>

    <div
      ref="viewportRef"
      class="editor-viewport checkerboard"
      :class="{
        'is-loading': loading,
        'is-panning': isPanning,
        'is-space-held': spaceHeld,
      }"
      @wheel.prevent="onWheel"
      @mousedown="onViewportMouseDown"
      @mousemove="onViewportMouseMove"
      @mouseup="onViewportMouseUp"
      @mouseleave="onViewportMouseLeave"
      @contextmenu.prevent="onContextMenu"
    >
      <div v-if="loading" class="editor-loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <span>加载图像中...</span>
      </div>

      <div ref="stageRef" class="editor-stage" :style="stageStyle">
        <canvas ref="canvasRef" class="editor-canvas" />
        <canvas
          v-if="activeTab === 'repaint'"
          v-show="repaintUseMask"
          ref="maskOverlayRef"
          class="mask-overlay-canvas"
        />
        <svg
          v-if="activeTab === 'manual' && tool === 'pen' && penPoints.length > 0"
          class="pen-overlay"
          :width="canvasSize.w"
          :height="canvasSize.h"
        >
          <polyline
            v-if="penPoints.length >= 2"
            :points="penPolylinePoints"
            fill="none"
            stroke="#409eff"
            stroke-width="2"
            stroke-dasharray="6 4"
          />
          <line
            v-if="penHoverPoint && penPoints.length > 0"
            :x1="penPoints[penPoints.length - 1].x"
            :y1="penPoints[penPoints.length - 1].y"
            :x2="penHoverPoint.x"
            :y2="penHoverPoint.y"
            stroke="#409eff"
            stroke-width="1.5"
            stroke-dasharray="4 3"
            opacity="0.7"
          />
          <circle
            v-for="(pt, i) in penPoints"
            :key="i"
            :cx="pt.x"
            :cy="pt.y"
            r="3"
            fill="#409eff"
            stroke="#fff"
            stroke-width="1"
          />
        </svg>
        <svg
          v-if="activeTab === 'repaint' && repaintUseMask && rectPreview"
          class="rect-select-overlay"
          :width="canvasSize.w"
          :height="canvasSize.h"
        >
          <rect
            :x="rectPreview.x"
            :y="rectPreview.y"
            :width="rectPreview.w"
            :height="rectPreview.h"
            fill="rgba(103, 194, 58, 0.12)"
            stroke="#67c23a"
            stroke-width="2"
            stroke-dasharray="6 4"
            pointer-events="none"
          />
        </svg>
        <svg
          v-if="activeTab === 'sam' && !maskPreviewLoaded"
          class="points-overlay"
          :width="canvasSize.w"
          :height="canvasSize.h"
        >
          <circle
            v-for="(pt, i) in points"
            :key="i"
            :cx="pt.x"
            :cy="pt.y"
            r="6"
            :fill="pt.label === 1 ? '#67c23a' : '#f56c6c'"
            stroke="#fff"
            stroke-width="2"
          />
        </svg>
      </div>

      <div
        v-if="showBrushCursor && !loading && !isPanning"
        class="brush-cursor"
        :class="{
          'is-erase': activeTab === 'manual' && tool === 'erase',
          'is-restore': activeTab === 'manual' && tool === 'restore',
          'is-mask-brush': activeTab === 'repaint' && repaintUseMask && repaintMaskTool === 'brush',
          'is-mask-eraser': activeTab === 'repaint' && repaintUseMask && repaintMaskTool === 'eraser',
        }"
        :style="brushCursorStyle"
      />

      <div v-if="!loading" class="viewport-hint">{{ viewportHint }}</div>
    </div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="loading" @click="handleApply">
        {{ applyButtonLabel }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Brush, RefreshLeft, Loading, Aim, EditPen } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  savePreprocess,
  removeBackground,
  gemFlatten,
  gemSegmentSam,
  gemFlattenSam,
  gemRepaint,
  fetchPreprocessPreview,
  type GemPoint,
  type GemPreset,
} from '@/api'

const MAX_MANUAL_UNDO = 10
const MAX_MASK_UNDO = 10
const MAX_GLOBAL_HISTORY = 20
const MIN_ZOOM = 0.1
const MAX_ZOOM = 12

type TabId = 'matting' | 'repaint' | 'sam' | 'manual'
type Tool = 'erase' | 'restore' | 'colorPick' | 'pen'
type RepaintCompareMode = 'before' | 'after' | 'split'

interface Point {
  x: number
  y: number
}

interface HistoryEntry {
  file: File
  sessionId: string
  gemCoverage: number | null
  label: string
}

const props = defineProps<{
  visible: boolean
  imageFile: File | null
  originalFile?: File | null
  sessionId?: string
  fileName?: string
  gemPreset?: GemPreset
  gemSensitivity?: number
  viewLabel?: string
  batchIndex?: number
  batchTotal?: number
  batchLabels?: string[]
  enableGemRepaint?: boolean
  gemRepaintSeed?: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:enableGemRepaint': [value: boolean]
  'update:gemRepaintSeed': [value: number]
  saved: [payload: {
    file: File
    sessionId?: string
    gemCoverage?: number | null
    gemPreset?: GemPreset
    gemSensitivity?: number
    advance?: boolean
  }]
  navigate: [index: number]
  cancel: []
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const batchIndex = computed(() => props.batchIndex ?? 0)
const batchTotal = computed(() => props.batchTotal ?? 1)
const batchLabels = computed(() => props.batchLabels ?? [])

const dialogTitle = computed(() => {
  if (batchTotal.value > 1) {
    const label = props.viewLabel || batchLabels.value[batchIndex.value] || ''
    return label ? `逐个微调 · ${label}` : '逐个微调'
  }
  return props.viewLabel ? `图像微调 · ${props.viewLabel}` : '图像微调'
})

const applyButtonLabel = computed(() => {
  if (batchTotal.value > 1 && batchIndex.value < batchTotal.value - 1) {
    return '应用并继续下一张'
  }
  return '应用并保存'
})

const hasUnsavedEdits = computed(
  () => historyIndex.value > 0 || manualDirty.value || points.value.length > 0
)

const activeTab = ref<TabId>('matting')
const canvasRef = ref<HTMLCanvasElement | null>(null)
const viewportRef = ref<HTMLDivElement | null>(null)

const tool = ref<Tool>('erase')
const brushSize = ref(12)
const colorTolerance = ref(32)
const loading = ref(false)
const saving = ref(false)
const matting = ref(false)
const segmenting = ref(false)
const applyingSam = ref(false)
const applyingRepaint = ref(false)
const applyingHsv = ref(false)
const isDrawing = ref(false)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const spaceHeld = ref(false)
const cursorPos = ref<Point | null>(null)
const canvasSize = ref({ w: 0, h: 0 })

const penPoints = ref<Point[]>([])
const penHoverPoint = ref<Point | null>(null)
const pickedColor = ref<{ r: number; g: number; b: number; a: number } | null>(null)

const localGemPreset = ref<GemPreset>(props.gemPreset ?? 'ruby')
const localGemSensitivity = ref(props.gemSensitivity ?? 0.55)
const points = ref<GemPoint[]>([])
const samCoverage = ref<number | null>(null)
const segmentSessionId = ref('')
const maskPreviewLoaded = ref(false)

const workingFile = ref<File | null>(null)
const workingSessionId = ref('')
const workingGemCoverage = ref<number | null>(null)
const originalFile = computed(() => props.originalFile ?? props.imageFile)

const historyStack = ref<HistoryEntry[]>([])
const historyIndex = ref(-1)
const manualUndoStack: ImageData[] = []
const maskUndoStack: ImageData[] = []

let ctx: CanvasRenderingContext2D | null = null
let baseImageData: ImageData | null = null
let panStart = { x: 0, y: 0, panX: 0, panY: 0 }
let lastPaintPoint: Point | null = null
let penLastClickTime = 0
const manualDirty = ref(false)

const positiveCount = computed(() => points.value.filter((p) => p.label === 1).length)

const canSamStepUndo = computed(
  () => maskPreviewLoaded.value || points.value.length > 0
)

const canUndo = computed(() => {
  if (activeTab.value === 'manual' && manualUndoStack.length > 0) return true
  if (activeTab.value === 'sam' && canSamStepUndo.value) return true
  if (activeTab.value === 'repaint' && repaintUseMask.value && maskUndoStack.length > 0) {
    return true
  }
  return historyIndex.value > 0
})

const localEnableGemRepaint = computed({
  get: () => props.enableGemRepaint === true,
  set: (v) => emit('update:enableGemRepaint', v),
})

const localGemRepaintSeed = computed({
  get: () => props.gemRepaintSeed ?? 42,
  set: (v) => emit('update:gemRepaintSeed', v),
})

const localGemRepaintStrength = ref(0.20)
const repaintUseMask = ref(true)
const repaintCompareVisible = ref(false)
const repaintCompareMode = ref<RepaintCompareMode>('split')
const repaintBeforeUrl = ref('')
const repaintAfterUrl = ref('')
const repaintPendingFile = ref<File | null>(null)
const repaintPendingSessionId = ref('')
type RepaintMaskTool = 'rect' | 'brush' | 'eraser'
const repaintMaskTool = ref<RepaintMaskTool>('rect')
const maskOverlayRef = ref<HTMLCanvasElement | null>(null)

let maskCanvas: HTMLCanvasElement | null = null
let maskCtx: CanvasRenderingContext2D | null = null
let maskOverlayCtx: CanvasRenderingContext2D | null = null

const rectSelectStart = ref<Point | null>(null)
const rectSelectCurrent = ref<Point | null>(null)
const isRectSelecting = ref(false)

const rectPreview = computed(() => {
  const start = rectSelectStart.value
  const current = rectSelectCurrent.value
  if (!start || !current) return null
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    w: Math.abs(current.x - start.x),
    h: Math.abs(current.y - start.y),
  }
})

const tabHint = computed(() => {
  switch (activeTab.value) {
    case 'matting':
      return '自动识别主体并扣除背景。执行后可切换其他标签继续处理，支持撤销。'
    case 'repaint':
      return repaintUseMask.value
        ? '在画布上拖拽框选宝石主石区域（绿色半透明预览），再点击「一键 AI 去反光重绘」。白色蒙版区域才会被万相编辑。'
        : '整图模式：万相可能误删主石，不推荐。建议开启「使用蒙版」。'
    case 'sam':
      return '手动 SAM 点选 + 占位色/HSV 极速方案。AI 整图去反光请使用「AI 去反光」标签页。'
    default:
      switch (tool.value) {
        case 'erase':
          return '擦除笔：在透明底图上涂抹，去除残留背景'
        case 'restore':
          return '恢复笔：还原误删的主体区域'
        case 'colorPick':
          return '取色消除：点击图像采样颜色，容差范围内相似像素将被透明化'
        case 'pen':
          return '钢笔圈画：单击添加节点，双击或点击「闭合」填充内部为透明'
        default:
          return ''
      }
  }
})

const viewportHint = computed(() => {
  if (activeTab.value === 'repaint' && repaintUseMask.value) {
    if (repaintMaskTool.value === 'brush') {
      return '左键涂抹蒙版 · 滚轮缩放 · 空格+拖拽平移 · Ctrl+Z 撤销'
    }
    if (repaintMaskTool.value === 'eraser') {
      return '左键拖拽框选擦除蒙版 · 滚轮缩放 · 空格+拖拽平移 · Ctrl+Z 撤销'
    }
    return '左键拖拽框选宝石 · 滚轮缩放 · 空格+拖拽平移 · Ctrl+Z 撤销'
  }
  if (activeTab.value === 'sam') {
    return '左键=宝石 · Shift+左键=排除 · Ctrl+Z 撤销 · 滚轮缩放 · 空格+拖拽平移'
  }
  return '滚轮缩放 · 空格+拖拽平移 · 中键拖拽平移 · Ctrl+Z 撤销'
})

const stageStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
  width: `${canvasSize.value.w}px`,
  height: `${canvasSize.value.h}px`,
}))

const showBrushCursor = computed(
  () =>
    ((activeTab.value === 'manual' &&
      (tool.value === 'erase' || tool.value === 'restore')) ||
      (activeTab.value === 'repaint' &&
        repaintUseMask.value &&
        repaintMaskTool.value === 'brush')) &&
    cursorPos.value !== null &&
    !loading.value
)

const brushCursorStyle = computed(() => {
  if (!cursorPos.value) return {}
  const diameter = brushSize.value * zoom.value * 2
  return {
    left: `${cursorPos.value.x - brushSize.value * zoom.value}px`,
    top: `${cursorPos.value.y - brushSize.value * zoom.value}px`,
    width: `${diameter}px`,
    height: `${diameter}px`,
  }
})

const penPolylinePoints = computed(() =>
  penPoints.value.map((p) => `${p.x},${p.y}`).join(' ')
)

const pickedColorCss = computed(() => {
  if (!pickedColor.value) return 'transparent'
  const { r, g, b, a } = pickedColor.value
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`
})

function resetSamState() {
  points.value = []
  samCoverage.value = null
  segmentSessionId.value = ''
  maskPreviewLoaded.value = false
}

function ensureRepaintMaskReady(): boolean {
  const canvas = canvasRef.value
  if (!canvas || canvas.width <= 0 || canvas.height <= 0) return false
  if (
    !maskCanvas ||
    !maskCtx ||
    maskCanvas.width !== canvas.width ||
    maskCanvas.height !== canvas.height
  ) {
    initRepaintMaskCanvas(canvas.width, canvas.height)
  }
  if (activeTab.value === 'repaint' && repaintUseMask.value) {
    bindRepaintMaskOverlay(canvas.width, canvas.height)
  }
  return !!maskCtx
}

function bindRepaintMaskOverlay(w: number, h: number): boolean {
  const overlay = maskOverlayRef.value
  if (!overlay) return false
  if (overlay.width !== w || overlay.height !== h) {
    overlay.width = w
    overlay.height = h
  }
  maskOverlayCtx = overlay.getContext('2d')
  return !!maskOverlayCtx
}

function syncRepaintMaskOverlayFromState() {
  if (activeTab.value !== 'repaint' || !repaintUseMask.value) return
  const canvas = canvasRef.value
  if (!canvas) return
  void nextTick(() => {
    syncMaskOverlayCanvas(canvas.width, canvas.height)
  })
}

function resetMaskUndoStack() {
  maskUndoStack.length = 0
}

function pushMaskUndo() {
  if (!maskCtx || !maskCanvas) return
  const snapshot = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
  maskUndoStack.push(snapshot)
  if (maskUndoStack.length > MAX_MASK_UNDO) {
    maskUndoStack.shift()
  }
}

function undoMask() {
  const snapshot = maskUndoStack.pop()
  if (snapshot && maskCtx) {
    maskCtx.putImageData(snapshot, 0, 0)
    refreshRepaintMaskOverlay()
  }
}

function initRepaintMaskCanvas(w: number, h: number) {
  maskCanvas = document.createElement('canvas')
  maskCanvas.width = w
  maskCanvas.height = h
  maskCtx = maskCanvas.getContext('2d')
  resetMaskUndoStack()
  clearRepaintMaskCanvas()
}

function syncMaskOverlayCanvas(w: number, h: number) {
  if (!bindRepaintMaskOverlay(w, h)) return
  refreshRepaintMaskOverlay()
}

function clearRepaintMaskCanvas() {
  if (!maskCtx || !maskCanvas) return
  maskCtx.fillStyle = '#000'
  maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height)
  refreshRepaintMaskOverlay()
}

function clearRepaintMask() {
  if (!ensureRepaintMaskReady()) return
  pushMaskUndo()
  clearRepaintMaskCanvas()
  ElMessage.success('蒙版已清除')
}

function paintRepaintMask(x: number, y: number) {
  if (!ensureRepaintMaskReady() || !maskCtx) return
  maskCtx.fillStyle = repaintMaskTool.value === 'eraser' ? '#000000' : '#ffffff'
  maskCtx.beginPath()
  maskCtx.arc(x, y, brushSize.value, 0, Math.PI * 2)
  maskCtx.fill()
  refreshRepaintMaskOverlay()
}

function paintRepaintMaskStroke(from: Point, to: Point) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const step = Math.max(1, brushSize.value * 0.25)
  const steps = Math.max(1, Math.ceil(dist / step))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    paintRepaintMask(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
  }
}

function refreshRepaintMaskOverlay() {
  const overlay = maskOverlayRef.value
  if (!overlay || !maskCanvas || !maskCtx || !repaintUseMask.value) return
  if (!bindRepaintMaskOverlay(maskCanvas.width, maskCanvas.height)) return
  const octx = maskOverlayCtx!
  const w = overlay.width
  const h = overlay.height
  octx.clearRect(0, 0, w, h)
  const maskData = maskCtx.getImageData(0, 0, w, h)
  const overlayData = octx.createImageData(w, h)
  const src = maskData.data
  const dst = overlayData.data
  const greenA = Math.round(0.45 * 255)
  for (let i = 0; i < src.length; i += 4) {
    if (src[i] > 128) {
      dst[i] = 103
      dst[i + 1] = 194
      dst[i + 2] = 58
      dst[i + 3] = greenA
    }
  }
  octx.putImageData(overlayData, 0, 0)
}

function fillRepaintMaskRect(x0: number, y0: number, x1: number, y1: number) {
  if (!ensureRepaintMaskReady() || !maskCtx || !maskCanvas) return
  const left = Math.max(0, Math.min(x0, x1))
  const top = Math.max(0, Math.min(y0, y1))
  const right = Math.min(maskCanvas.width, Math.max(x0, x1))
  const bottom = Math.min(maskCanvas.height, Math.max(y0, y1))
  const width = right - left
  const height = bottom - top
  if (width < 1 || height < 1) return
  pushMaskUndo()
  maskCtx.fillStyle = repaintMaskTool.value === 'eraser' ? '#000000' : '#ffffff'
  maskCtx.fillRect(left, top, width, height)
  refreshRepaintMaskOverlay()
}

function resetRectSelectState() {
  rectSelectStart.value = null
  rectSelectCurrent.value = null
  isRectSelecting.value = false
}

function hasRepaintMaskContent(): boolean {
  if (!maskCtx || !maskCanvas) return false
  const data = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) return true
  }
  return false
}

async function exportRepaintMaskBlob(): Promise<Blob> {
  if (!maskCanvas) throw new Error('蒙版画布未就绪')
  return new Promise((resolve, reject) => {
    maskCanvas!.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('蒙版导出失败'))
    }, 'image/png')
  })
}

function resetManualState() {
  manualUndoStack.length = 0
  manualDirty.value = false
  penPoints.value = []
  penHoverPoint.value = null
  pickedColor.value = null
  isDrawing.value = false
  lastPaintPoint = null
}

function resetEditorState() {
  ctx = null
  baseImageData = null
  historyStack.value = []
  historyIndex.value = -1
  workingFile.value = null
  workingSessionId.value = ''
  workingGemCoverage.value = null
  clearRepaintCompare()
  resetSamState()
  resetManualState()
  resetMaskUndoStack()
  resetRectSelectState()
  isPanning.value = false
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  cursorPos.value = null
  activeTab.value = 'matting'
}

function clearRepaintCompare() {
  if (repaintBeforeUrl.value) {
    URL.revokeObjectURL(repaintBeforeUrl.value)
  }
  if (repaintAfterUrl.value) {
    URL.revokeObjectURL(repaintAfterUrl.value)
  }
  repaintCompareVisible.value = false
  repaintCompareMode.value = 'split'
  repaintBeforeUrl.value = ''
  repaintAfterUrl.value = ''
  repaintPendingFile.value = null
  repaintPendingSessionId.value = ''
}

async function acceptRepaintResult() {
  const file = repaintPendingFile.value
  if (!file) return
  const sessionId = repaintPendingSessionId.value || workingSessionId.value
  clearRepaintCompare()
  await pushGlobalHistory('AI 去反光', file, sessionId, null)
  ElMessage.success('已应用 AI 去反光结果')
}

function rejectRepaintResult() {
  clearRepaintCompare()
  ElMessage.info('已放弃本次去反光结果，可调整蒙版或强度后重试')
}

function syncManualBase() {
  if (!ctx || !canvasRef.value) return
  baseImageData = ctx.getImageData(0, 0, canvasRef.value.width, canvasRef.value.height)
  resetManualState()
}

function onTabChange() {
  void commitManualEdits()
  penPoints.value = []
  penHoverPoint.value = null
  isDrawing.value = false
  if (activeTab.value === 'repaint' && repaintUseMask.value) {
    void nextTick(() => {
      ensureRepaintMaskReady()
      refreshRepaintMaskOverlay()
    })
  }
}

function onToolChange() {
  penPoints.value = []
  penHoverPoint.value = null
  isDrawing.value = false
}

function fitCanvasToViewport() {
  const canvas = canvasRef.value
  const viewport = viewportRef.value
  if (!canvas || !viewport || canvas.width === 0) return

  const maxW = viewport.clientWidth - 16
  const maxH = viewport.clientHeight - 40
  const fitZoom = Math.min(maxW / canvas.width, maxH / canvas.height, 1)
  zoom.value = fitZoom
  panX.value = (viewport.clientWidth - canvas.width * fitZoom) / 2
  panY.value = (viewport.clientHeight - canvas.height * fitZoom) / 2
}

async function waitForCanvas(maxAttempts = 12): Promise<HTMLCanvasElement> {
  for (let i = 0; i < maxAttempts; i++) {
    await nextTick()
    const canvas = canvasRef.value
    if (canvas) return canvas
  }
  throw new Error('画布未就绪')
}

async function loadFileToCanvas(file: File, resetHistory: boolean) {
  loading.value = true
  if (resetHistory) {
    ctx = null
    baseImageData = null
    historyStack.value = []
    historyIndex.value = -1
    resetSamState()
    resetManualState()
  }

  const url = URL.createObjectURL(file)
  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        void (async () => {
          try {
            const canvas = await waitForCanvas()
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            canvasSize.value = { w: canvas.width, h: canvas.height }
            ctx = canvas.getContext('2d', { willReadFrequently: true })
            if (!ctx) {
              reject(new Error('无法创建画布'))
              return
            }
            ctx.drawImage(img, 0, 0)
            syncManualBase()
            initRepaintMaskCanvas(canvas.width, canvas.height)
            await nextTick()
            fitCanvasToViewport()
            resolve()
          } catch (err) {
            reject(err instanceof Error ? err : new Error('图像加载失败'))
          }
        })()
      }
      img.onerror = () => reject(new Error('图像加载失败'))
      img.src = url
    })
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '图像加载失败')
  } finally {
    URL.revokeObjectURL(url)
    loading.value = false
  }
}

async function exportPngBlob(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = canvasRef.value
    if (!canvas) {
      reject(new Error('画布未就绪'))
      return
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('导出图像失败'))
    }, 'image/png')
  })
}

async function exportPngFile(): Promise<File> {
  const blob = await exportPngBlob()
  const baseName = workingFile.value?.name ?? props.fileName ?? 'edited.png'
  return new File([blob], baseName.replace(/\.[^.]+$/, '') + '_edit.png', { type: 'image/png' })
}

async function pushGlobalHistory(
  label: string,
  file: File,
  sessionId: string,
  gemCoverage: number | null = workingGemCoverage.value
) {
  if (historyIndex.value < historyStack.value.length - 1) {
    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1)
  }
  historyStack.value.push({ file, sessionId, gemCoverage, label })
  if (historyStack.value.length > MAX_GLOBAL_HISTORY) {
    historyStack.value.shift()
  } else {
    historyIndex.value++
  }
  workingFile.value = file
  workingSessionId.value = sessionId
  workingGemCoverage.value = gemCoverage
  await loadFileToCanvas(file, false)
  resetSamState()
}

async function globalUndo() {
  if (historyIndex.value <= 0) return
  historyIndex.value--
  const entry = historyStack.value[historyIndex.value]
  workingFile.value = entry.file
  workingSessionId.value = entry.sessionId
  workingGemCoverage.value = entry.gemCoverage
  await loadFileToCanvas(entry.file, false)
  resetSamState()
}

async function commitManualEdits() {
  if (!manualDirty.value) return
  const file = await exportPngFile()
  await pushGlobalHistory('手动编辑', file, workingSessionId.value)
}

function pushManualUndo() {
  if (!ctx || !canvasRef.value) return
  const snapshot = ctx.getImageData(0, 0, canvasRef.value.width, canvasRef.value.height)
  manualUndoStack.push(snapshot)
  if (manualUndoStack.length > MAX_MANUAL_UNDO) {
    manualUndoStack.shift()
  }
  manualDirty.value = true
}

function undoManual() {
  const snapshot = manualUndoStack.pop()
  if (snapshot && ctx) {
    ctx.putImageData(snapshot, 0, 0)
  }
  if (manualUndoStack.length === 0) {
    manualDirty.value = false
  }
}

function clearSamPoints() {
  if (maskPreviewLoaded.value) {
    redrawBaseImage()
  }
  resetSamState()
}

function redrawBaseImage() {
  if (!ctx || !baseImageData) return
  ctx.putImageData(baseImageData, 0, 0)
}

function undoSamStep() {
  if (maskPreviewLoaded.value) {
    redrawBaseImage()
    maskPreviewLoaded.value = false
    samCoverage.value = null
    segmentSessionId.value = ''
    return
  }
  if (points.value.length > 0) {
    points.value = points.value.slice(0, -1)
    if (points.value.length === 0) {
      samCoverage.value = null
      segmentSessionId.value = ''
    }
  }
}

async function handleUndo() {
  if (activeTab.value === 'manual' && manualUndoStack.length > 0) {
    undoManual()
    return
  }
  if (activeTab.value === 'sam' && canSamStepUndo.value) {
    undoSamStep()
    return
  }
  if (activeTab.value === 'repaint' && repaintUseMask.value && maskUndoStack.length > 0) {
    undoMask()
    return
  }
  await globalUndo()
}

async function runMatting() {
  const source = originalFile.value
  if (!source) {
    ElMessage.warning('无可用原图')
    return
  }
  matting.value = true
  try {
    const res = await removeBackground(source)
    const blob = await fetchPreprocessPreview(res.data.previewUrl)
    const file = new File(
      [blob],
      `no_bg_${source.name.replace(/\.[^.]+$/, '')}.png`,
      { type: 'image/png' }
    )
    await pushGlobalHistory('抠图', file, res.data.sessionId, res.data.gemCoverageRatio ?? null)
    ElMessage.success('抠图完成，可继续 SAM 或手动编辑')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '抠图失败')
  } finally {
    matting.value = false
  }
}

async function previewMask() {
  const file = workingFile.value ?? props.imageFile
  if (!file || positiveCount.value === 0) return
  segmenting.value = true
  try {
    const res = await gemSegmentSam(file, points.value, segmentSessionId.value || undefined)
    segmentSessionId.value = res.data.sessionId
    samCoverage.value = res.data.gemCoverageRatio ?? null
    const blob = await fetchPreprocessPreview(res.data.maskPreviewUrl)
    const url = URL.createObjectURL(blob)
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        if (ctx && canvasRef.value) {
          ctx.drawImage(img, 0, 0)
          maskPreviewLoaded.value = true
        }
        URL.revokeObjectURL(url)
        resolve()
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('蒙版预览加载失败'))
      }
      img.src = url
    })
    ElMessage.success('蒙版预览已更新')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '蒙版预览失败')
  } finally {
    segmenting.value = false
  }
}

async function applySamFlatten() {
  const file = workingFile.value ?? props.imageFile
  if (!file || positiveCount.value === 0) return
  applyingSam.value = true
  try {
    const res = await gemFlattenSam(file, points.value, {
      gemPreset: localGemPreset.value,
      preserveEdges: true,
      sessionId: segmentSessionId.value || undefined,
    })
    const blob = await fetchPreprocessPreview(res.data.previewUrl)
    const outFile = new File(
      [blob],
      file.name.replace(/\.[^.]+$/, '') + '_gem_flat.png',
      { type: 'image/png' }
    )
    await pushGlobalHistory(
      'SAM 占位色',
      outFile,
      res.data.sessionId,
      res.data.gemCoverageRatio ?? null
    )
    ElMessage.success('SAM 占位色已应用')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '应用占位色失败')
  } finally {
    applyingSam.value = false
  }
}

async function applyGemRepaint() {
  const file = workingFile.value ?? props.imageFile
  if (!file) {
    ElMessage.warning('无可用图像')
    return
  }
  if (repaintUseMask.value && !hasRepaintMaskContent()) {
    ElMessage.warning('请先在画布上框选或涂抹宝石区域蒙版')
    return
  }
  clearRepaintCompare()
  applyingRepaint.value = true
  const beforeUrl = URL.createObjectURL(file)
  try {
    let maskFile: File | undefined
    if (repaintUseMask.value) {
      const maskBlob = await exportRepaintMaskBlob()
      maskFile = new File([maskBlob], 'gem_mask.png', { type: 'image/png' })
    }
    const res = await gemRepaint(file, {
      strength: localGemRepaintStrength.value,
      sessionId: workingSessionId.value || undefined,
      useMask: repaintUseMask.value,
      mask: maskFile,
    })
    const blob = await fetchPreprocessPreview(res.data.previewUrl)
    const outFile = new File(
      [blob],
      file.name.replace(/\.[^.]+$/, '') + '_gem_repaint.png',
      { type: 'image/png' }
    )
    repaintBeforeUrl.value = beforeUrl
    repaintAfterUrl.value = URL.createObjectURL(outFile)
    repaintPendingFile.value = outFile
    repaintPendingSessionId.value = res.data.sessionId ?? workingSessionId.value
    repaintCompareMode.value = 'split'
    repaintCompareVisible.value = true
    ElMessage.success(
      res.data.segmentMethod === 'wanx_mask'
        ? '通义万相蒙版去反光完成，请对比后确认是否应用'
        : '通义万相整图去反光完成，请对比后确认是否应用'
    )
  } catch (err: unknown) {
    URL.revokeObjectURL(beforeUrl)
    const msg =
      err instanceof Error
        ? err.message
        : 'AI 去反光失败'
    ElMessage.error(
      msg.includes('512') && msg.includes('4096')
        ? '图像尺寸不符合万相要求，请使用更大的原图或重新抠图后再试'
        : msg
    )
  } finally {
    applyingRepaint.value = false
  }
}

async function applyHsvFlatten() {
  const file = workingFile.value ?? props.imageFile
  if (!file) {
    ElMessage.warning('无可用图像')
    return
  }
  applyingHsv.value = true
  try {
    const res = await gemFlatten(file, {
      gemPreset: localGemPreset.value,
      sensitivity: localGemSensitivity.value,
      preserveEdges: true,
    })
    const blob = await fetchPreprocessPreview(res.data.previewUrl)
    const outFile = new File(
      [blob],
      file.name.replace(/\.[^.]+$/, '') + '_gem_hsv.png',
      { type: 'image/png' }
    )
    const coverage = res.data.gemCoverageRatio ?? null
    await pushGlobalHistory('HSV 占位色', outFile, res.data.sessionId, coverage)
    if (coverage != null) {
      ElMessage.success(`HSV 自动检测完成，覆盖约 ${(coverage * 100).toFixed(1)}%`)
    } else {
      ElMessage.success('HSV 自动检测完成')
    }
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : 'HSV 自动检测失败')
  } finally {
    applyingHsv.value = false
  }
}

function screenToCanvas(clientX: number, clientY: number): Point {
  const canvas = canvasRef.value
  if (canvas) {
    const rect = canvas.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height,
      }
    }
  }
  const viewport = viewportRef.value!
  const rect = viewport.getBoundingClientRect()
  return {
    x: (clientX - rect.left - panX.value) / zoom.value,
    y: (clientY - rect.top - panY.value) / zoom.value,
  }
}

function viewportCoords(clientX: number, clientY: number): Point {
  const viewport = viewportRef.value!
  const rect = viewport.getBoundingClientRect()
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}

function isInCanvas(p: Point): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < canvasSize.value.w && p.y < canvasSize.value.h
}

function paint(x: number, y: number) {
  if (!ctx || !canvasRef.value || !baseImageData) return

  const canvas = canvasRef.value
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const base = baseImageData.data
  const radius = brushSize.value

  const x0 = Math.max(0, Math.floor(x - radius))
  const y0 = Math.max(0, Math.floor(y - radius))
  const x1 = Math.min(canvas.width - 1, Math.ceil(x + radius))
  const y1 = Math.min(canvas.height - 1, Math.ceil(y + radius))
  const r2 = radius * radius

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dx = px - x
      const dy = py - y
      if (dx * dx + dy * dy > r2) continue

      const i = (py * canvas.width + px) * 4
      if (tool.value === 'erase') {
        data[i + 3] = 0
      } else if (tool.value === 'restore') {
        data[i] = base[i]
        data[i + 1] = base[i + 1]
        data[i + 2] = base[i + 2]
        data[i + 3] = base[i + 3]
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

function paintStroke(from: Point, to: Point) {
  const dist = Math.hypot(to.x - from.x, to.y - from.y)
  const step = Math.max(1, brushSize.value * 0.25)
  const steps = Math.max(1, Math.ceil(dist / step))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    paint(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
  }
}

function floodFillErase(startX: number, startY: number, tolerance: number) {
  if (!ctx || !canvasRef.value) return

  const canvas = canvasRef.value
  const w = canvas.width
  const h = canvas.height
  const sx = Math.floor(startX)
  const sy = Math.floor(startY)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return

  const imageData = ctx.getImageData(0, 0, w, h)
  const data = imageData.data
  const startIdx = (sy * w + sx) * 4
  const targetR = data[startIdx]
  const targetG = data[startIdx + 1]
  const targetB = data[startIdx + 2]
  const targetA = data[startIdx + 3]

  if (targetA === 0) return

  pickedColor.value = { r: targetR, g: targetG, b: targetB, a: targetA }

  const maxDist = (tolerance / 100) * 441.67
  const visited = new Uint8Array(w * h)
  const stack: number[] = [sx, sy]

  function matches(idx: number): boolean {
    const dr = data[idx] - targetR
    const dg = data[idx + 1] - targetG
    const db = data[idx + 2] - targetB
    const da = data[idx + 3] - targetA
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= maxDist
  }

  while (stack.length > 0) {
    const y = stack.pop()!
    const x = stack.pop()!
    const pi = y * w + x
    if (x < 0 || y < 0 || x >= w || y >= h || visited[pi]) continue

    const idx = pi * 4
    if (!matches(idx)) continue

    visited[pi] = 1
    data[idx + 3] = 0

    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1)
  }

  ctx.putImageData(imageData, 0, 0)
}

function fillPolygonErase(pointsArg: Point[]) {
  if (!ctx || !canvasRef.value || pointsArg.length < 3) return

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(pointsArg[0].x, pointsArg[0].y)
  for (let i = 1; i < pointsArg.length; i++) {
    ctx.lineTo(pointsArg[i].x, pointsArg[i].y)
  }
  ctx.closePath()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.fill('evenodd')
  ctx.restore()
  ctx.globalCompositeOperation = 'source-over'
}

function closePenPath() {
  if (penPoints.value.length < 3) {
    ElMessage.warning('至少需要 3 个点才能闭合')
    return
  }
  pushManualUndo()
  fillPolygonErase(penPoints.value)
  penPoints.value = []
  penHoverPoint.value = null
  void commitManualEdits()
}

function onWheel(e: WheelEvent) {
  const viewport = viewportRef.value
  if (!viewport) return

  const rect = viewport.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top
  const canvasX = (mouseX - panX.value) / zoom.value
  const canvasY = (mouseY - panY.value) / zoom.value

  const factor = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value * factor))

  panX.value = mouseX - canvasX * newZoom
  panY.value = mouseY - canvasY * newZoom
  zoom.value = newZoom
}

function shouldPan(e: MouseEvent): boolean {
  return e.button === 1 || (spaceHeld.value && e.button === 0)
}

function clearMaskPreviewState() {
  if (maskPreviewLoaded.value) {
    redrawBaseImage()
  }
  maskPreviewLoaded.value = false
  samCoverage.value = null
  segmentSessionId.value = ''
}

function onViewportMouseDown(e: MouseEvent) {
  if (loading.value) return

  cursorPos.value = viewportCoords(e.clientX, e.clientY)

  if (shouldPan(e)) {
    isPanning.value = true
    panStart = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
    e.preventDefault()
    return
  }

  if (e.button !== 0) return

  const canvasPt = screenToCanvas(e.clientX, e.clientY)
  if (!isInCanvas(canvasPt)) return

  if (activeTab.value === 'sam') {
    clearMaskPreviewState()
    const label = e.shiftKey ? 0 : 1
    points.value = [...points.value, { x: canvasPt.x, y: canvasPt.y, label }]
    return
  }

  if (activeTab.value === 'repaint' && repaintUseMask.value) {
    if (!ensureRepaintMaskReady()) return
    if (repaintMaskTool.value === 'rect' || repaintMaskTool.value === 'eraser') {
      isRectSelecting.value = true
      rectSelectStart.value = canvasPt
      rectSelectCurrent.value = canvasPt
      return
    }
    pushMaskUndo()
    isDrawing.value = true
    lastPaintPoint = canvasPt
    paintRepaintMask(canvasPt.x, canvasPt.y)
    return
  }

  if (activeTab.value !== 'manual') return

  if (tool.value === 'erase' || tool.value === 'restore') {
    pushManualUndo()
    isDrawing.value = true
    lastPaintPoint = canvasPt
    paint(canvasPt.x, canvasPt.y)
    return
  }

  if (tool.value === 'colorPick') {
    pushManualUndo()
    floodFillErase(canvasPt.x, canvasPt.y, colorTolerance.value)
    void commitManualEdits()
    return
  }

  if (tool.value === 'pen') {
    const now = Date.now()
    if (now - penLastClickTime < 350 && penPoints.value.length >= 3) {
      closePenPath()
      penLastClickTime = 0
      return
    }
    penLastClickTime = now
    penPoints.value = [...penPoints.value, canvasPt]
  }
}

function onContextMenu(e: MouseEvent) {
  if (activeTab.value !== 'sam') return
  const pt = screenToCanvas(e.clientX, e.clientY)
  if (!isInCanvas(pt)) return
  clearMaskPreviewState()
  points.value = [...points.value, { x: pt.x, y: pt.y, label: 0 }]
}

function onViewportMouseMove(e: MouseEvent) {
  cursorPos.value = viewportCoords(e.clientX, e.clientY)

  if (isPanning.value) {
    panX.value = panStart.panX + (e.clientX - panStart.x)
    panY.value = panStart.panY + (e.clientY - panStart.y)
    return
  }

  const canvasPt = screenToCanvas(e.clientX, e.clientY)

  if (activeTab.value === 'manual' && tool.value === 'pen') {
    penHoverPoint.value = isInCanvas(canvasPt) ? canvasPt : null
  }

  if (isRectSelecting.value && activeTab.value === 'repaint' && repaintUseMask.value) {
    rectSelectCurrent.value = canvasPt
    return
  }

  if (isDrawing.value && activeTab.value === 'repaint' && repaintUseMask.value) {
    if (!isInCanvas(canvasPt)) return
    if (lastPaintPoint) {
      paintRepaintMaskStroke(lastPaintPoint, canvasPt)
    } else {
      paintRepaintMask(canvasPt.x, canvasPt.y)
    }
    lastPaintPoint = canvasPt
    return
  }

  if (!isDrawing.value || activeTab.value !== 'manual') return
  if (tool.value !== 'erase' && tool.value !== 'restore') return
  if (!isInCanvas(canvasPt)) return

  if (lastPaintPoint) {
    paintStroke(lastPaintPoint, canvasPt)
  } else {
    paint(canvasPt.x, canvasPt.y)
  }
  lastPaintPoint = canvasPt
}

async function onViewportMouseUp(e: MouseEvent) {
  if (isPanning.value && (e.button === 1 || e.button === 0)) {
    isPanning.value = false
  }
  if (
    isRectSelecting.value &&
    activeTab.value === 'repaint' &&
    repaintUseMask.value &&
    rectSelectStart.value &&
    rectSelectCurrent.value
  ) {
    fillRepaintMaskRect(
      rectSelectStart.value.x,
      rectSelectStart.value.y,
      rectSelectCurrent.value.x,
      rectSelectCurrent.value.y
    )
    resetRectSelectState()
  }
  if (isDrawing.value && activeTab.value === 'manual') {
    await commitManualEdits()
  }
  isDrawing.value = false
  lastPaintPoint = null
}

function onViewportMouseLeave() {
  if (isRectSelecting.value) {
    resetRectSelectState()
  }
  isDrawing.value = false
  isPanning.value = false
  lastPaintPoint = null
  cursorPos.value = null
  penHoverPoint.value = null
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !spaceHeld.value) {
    spaceHeld.value = true
    e.preventDefault()
  }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
    e.preventDefault()
    void handleUndo()
  }
  if (e.code === 'Escape' && activeTab.value === 'manual' && tool.value === 'pen' && penPoints.value.length > 0) {
    penPoints.value = []
    penHoverPoint.value = null
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spaceHeld.value = false
    isPanning.value = false
  }
}

function handleCancel() {
  emit('cancel')
  dialogVisible.value = false
}

async function requestNavigate(targetIndex: number) {
  if (targetIndex === batchIndex.value) return
  if (targetIndex < 0 || targetIndex >= batchTotal.value) return
  if (loading.value || saving.value) return

  if (hasUnsavedEdits.value) {
    try {
      await ElMessageBox.confirm(
        '当前图片有未保存的修改，切换后将丢失。是否继续？',
        '切换图片',
        { type: 'warning', confirmButtonText: '切换', cancelButtonText: '留在此页' }
      )
    } catch {
      return
    }
  }
  emit('navigate', targetIndex)
}

async function handleApply() {
  saving.value = true
  try {
    await commitManualEdits()
    const file = workingFile.value ?? await exportPngFile()
    const sessionId = workingSessionId.value || props.sessionId
    if (sessionId) {
      await savePreprocess(sessionId, file)
    }
    const shouldAdvance = batchTotal.value > 1 && batchIndex.value < batchTotal.value - 1
    emit('saved', {
      file,
      sessionId: sessionId || undefined,
      gemCoverage: workingGemCoverage.value ?? undefined,
      gemPreset: localGemPreset.value,
      gemSensitivity: localGemSensitivity.value,
      advance: shouldAdvance,
    })
    if (shouldAdvance) {
      const nextLabel = batchLabels.value[batchIndex.value + 1] ?? ''
      ElMessage.success(nextLabel ? `已保存，继续 ${nextLabel}` : '已保存，继续下一张')
    } else {
      dialogVisible.value = false
      ElMessage.success(
        batchTotal.value > 1 ? '全部图片微调已完成' : '图像微调已保存'
      )
    }
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function initDialog() {
  if (!props.imageFile) return
  if (props.gemPreset) localGemPreset.value = props.gemPreset
  if (props.gemSensitivity != null) localGemSensitivity.value = props.gemSensitivity

  workingFile.value = props.imageFile
  workingSessionId.value = props.sessionId ?? ''
  workingGemCoverage.value = null

  await loadFileToCanvas(props.imageFile, true)
  historyStack.value = [{
    file: props.imageFile,
    sessionId: props.sessionId ?? '',
    gemCoverage: null,
    label: '初始',
  }]
  historyIndex.value = 0
  activeTab.value = props.enableGemRepaint ? 'repaint' : 'matting'
  if (activeTab.value === 'repaint' && repaintUseMask.value) {
    await nextTick()
    ensureRepaintMaskReady()
    refreshRepaintMaskOverlay()
  }
}

function onDialogOpened() {
  void initDialog()
}

function onDialogClosed() {
  resetEditorState()
}

watch(
  () => props.gemPreset,
  (v) => {
    if (v) localGemPreset.value = v
  }
)

watch(
  () => props.gemSensitivity,
  (v) => {
    if (v != null) localGemSensitivity.value = v
  }
)

watch(
  () => props.imageFile,
  (file, prev) => {
    if (props.visible && file && file !== prev) {
      void initDialog()
    }
  }
)

watch([activeTab, repaintUseMask], () => {
  if (activeTab.value === 'repaint' && repaintUseMask.value) {
    void nextTick(() => {
      ensureRepaintMaskReady()
      refreshRepaintMaskOverlay()
    })
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<style scoped>
.batch-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.batch-tabs {
  flex: 1;
  min-width: 0;
}

.batch-tabs :deep(.el-radio-button__inner) {
  padding: 5px 10px;
}

.batch-counter {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.editor-tabs {
  margin-bottom: 8px;
}

.editor-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.toolbar-note {
  font-size: 12px;
  color: var(--text-muted);
}

.brush-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brush-label,
.zoom-label {
  font-size: 13px;
  color: var(--text-muted);
  white-space: nowrap;
}

.zoom-label {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.gem-preset-select {
  width: 140px;
}

.sam-gem-repaint-bar,
.repaint-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
}

.repaint-note {
  flex: 1 1 240px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.toolbar-label {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.gem-repaint-seed-input {
  width: 120px;
}

.gem-repaint-strength-slider {
  width: 100px;
}

.sam-repaint-note {
  flex: 1 1 200px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.sam-repaint-note.muted {
  color: var(--text-muted);
}

.coverage-tag {
  font-size: 12px;
  color: var(--text-muted);
  padding: 2px 8px;
  background: #f0f9eb;
  border-radius: 4px;
}

.picked-color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.editor-viewport {
  position: relative;
  min-height: 280px;
  height: 480px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  overflow: hidden;
  cursor: crosshair;
}

.editor-viewport.is-panning,
.editor-viewport.is-space-held {
  cursor: grab;
}

.editor-viewport.is-panning:active {
  cursor: grabbing;
}

.editor-viewport.checkerboard {
  background-image:
    linear-gradient(45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(-45deg, #e0e0e0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e0e0e0 75%),
    linear-gradient(-45deg, transparent 75%, #e0e0e0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-color: #fff;
}

.editor-stage {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.editor-canvas {
  display: block;
  image-rendering: auto;
}

.mask-overlay-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.pen-overlay,
.points-overlay,
.rect-select-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.brush-cursor {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  box-sizing: border-box;
  z-index: 10;
}

.brush-cursor.is-erase {
  border: 2px solid rgba(245, 108, 108, 0.85);
  background: rgba(245, 108, 108, 0.12);
}

.brush-cursor.is-restore {
  border: 2px solid rgba(103, 194, 58, 0.85);
  background: rgba(103, 194, 58, 0.12);
}

.brush-cursor.is-mask-brush {
  border: 2px solid rgba(103, 194, 58, 0.9);
  background: rgba(103, 194, 58, 0.15);
}

.brush-cursor.is-mask-eraser {
  border: 2px solid rgba(245, 108, 108, 0.9);
  background: rgba(245, 108, 108, 0.12);
}

.repaint-brush-slider {
  width: 120px;
  margin: 0 8px;
}

.repaint-compare-bar {
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-lighter);
}

.repaint-compare-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.repaint-compare-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}

.repaint-compare-panel {
  display: flex;
  gap: 10px;
}

.repaint-compare-panel.is-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.repaint-compare-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.repaint-compare-item--single {
  flex: 1;
}

.repaint-compare-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.repaint-compare-frame {
  height: 140px;
  border-radius: var(--el-border-radius-base);
  border: 1px solid var(--el-border-color);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-blank);
}

.repaint-compare-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.repaint-compare-frame.checkerboard {
  background-image:
    linear-gradient(45deg, #ddd 25%, transparent 25%),
    linear-gradient(-45deg, #ddd 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd 75%),
    linear-gradient(-45deg, transparent 75%, #ddd 75%);
  background-size: 14px 14px;
  background-position: 0 0, 0 7px, 7px -7px, -7px 0;
}

.viewport-hint {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.85);
  padding: 4px 10px;
  border-radius: 12px;
  pointer-events: none;
  white-space: nowrap;
}

.editor-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
  z-index: 5;
}
</style>
