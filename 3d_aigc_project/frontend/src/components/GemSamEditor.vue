<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="min(92vw, 960px)"
    :close-on-click-modal="false"
    append-to-body
    destroy-on-close
    class="gem-sam-editor-dialog"
    @opened="onDialogOpened"
    @closed="onDialogClosed"
  >
    <p class="editor-hint">
      在<strong>主石中心</strong>单击添加前景点（绿）；按住 Shift 单击添加排除点（红，如金属高光）。
      预览蒙版确认边界后，再应用占位色。
    </p>

    <div class="editor-toolbar">
      <el-select v-model="localPreset" size="small" class="gem-preset-select" :disabled="segmenting || applying">
        <el-option label="红宝石" value="ruby" />
        <el-option label="蓝宝石" value="sapphire" />
        <el-option label="祖母绿" value="emerald" />
        <el-option label="钻石 (灰蓝)" value="diamond" />
        <el-option label="紫水晶" value="amethyst" />
      </el-select>

      <el-button size="small" :disabled="!canUndo || segmenting || applying" @click="undoSamStep">
        撤销
      </el-button>
      <el-button size="small" :disabled="!points.length || segmenting || applying" @click="clearPoints">
        清除点选
      </el-button>
      <el-button
        size="small"
        type="primary"
        plain
        :loading="segmenting"
        :disabled="positiveCount === 0 || segmenting || applying"
        @click="previewMask"
      >
        预览蒙版
      </el-button>

      <span v-if="coverage != null" class="coverage-tag">
        覆盖约 {{ (coverage * 100).toFixed(1) }}%
      </span>
      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
    </div>

    <div
      ref="viewportRef"
      class="editor-viewport checkerboard"
      :class="{ 'is-loading': loading, 'is-panning': isPanning, 'is-space-held': spaceHeld }"
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
        <svg class="points-overlay" :width="canvasSize.w" :height="canvasSize.h">
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

      <div v-show="!loading" class="viewport-hint">
        左键=宝石 · Shift+左键=排除 · Ctrl+Z 撤销 · 滚轮缩放 · 空格+拖拽平移
      </div>
    </div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button
        type="success"
        :loading="applying"
        :disabled="loading || positiveCount === 0 || applying"
        @click="applyFlatten"
      >
        应用占位色
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  gemSegmentSam,
  gemFlattenSam,
  fetchPreprocessPreview,
  type GemPoint,
  type GemPreset,
  type PreprocessResult,
} from '@/api'

const MIN_ZOOM = 0.1
const MAX_ZOOM = 12

const props = defineProps<{
  visible: boolean
  imageFile: File | null
  gemPreset?: GemPreset
  viewLabel?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  applied: [payload: { file: File; result: PreprocessResult }]
  cancel: []
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const dialogTitle = computed(() =>
  props.viewLabel ? `SAM 点选宝石 · ${props.viewLabel}` : 'SAM 点选宝石'
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const viewportRef = ref<HTMLDivElement | null>(null)
const localPreset = ref<GemPreset>(props.gemPreset ?? 'ruby')
const points = ref<GemPoint[]>([])
const loading = ref(false)
const segmenting = ref(false)
const applying = ref(false)
const coverage = ref<number | null>(null)
const segmentSessionId = ref('')
const maskPreviewLoaded = ref(false)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)
const spaceHeld = ref(false)
const canvasSize = ref({ w: 0, h: 0 })

let ctx: CanvasRenderingContext2D | null = null
let baseImageData: ImageData | null = null
let panStart = { x: 0, y: 0, panX: 0, panY: 0 }

const positiveCount = computed(() => points.value.filter((p) => p.label === 1).length)

const canUndo = computed(
  () => maskPreviewLoaded.value || points.value.length > 0
)

const stageStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
  width: `${canvasSize.value.w}px`,
  height: `${canvasSize.value.h}px`,
}))

watch(
  () => props.gemPreset,
  (v) => {
    if (v) localPreset.value = v
  }
)

function resetState() {
  ctx = null
  baseImageData = null
  points.value = []
  coverage.value = null
  segmentSessionId.value = ''
  maskPreviewLoaded.value = false
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  isPanning.value = false
}

function clearMaskPreviewState() {
  if (maskPreviewLoaded.value) {
    redrawBaseImage()
  }
  maskPreviewLoaded.value = false
  coverage.value = null
  segmentSessionId.value = ''
}

function undoSamStep() {
  if (maskPreviewLoaded.value) {
    clearMaskPreviewState()
    return
  }
  if (points.value.length > 0) {
    points.value = points.value.slice(0, -1)
    if (points.value.length === 0) {
      coverage.value = null
      segmentSessionId.value = ''
      redrawBaseImage()
    }
  }
}

function clearPoints() {
  points.value = []
  clearMaskPreviewState()
  redrawBaseImage()
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

function redrawBaseImage() {
  if (!ctx || !baseImageData) return
  ctx.putImageData(baseImageData, 0, 0)
}

async function waitForCanvas(maxAttempts = 12): Promise<HTMLCanvasElement> {
  for (let i = 0; i < maxAttempts; i++) {
    await nextTick()
    const canvas = canvasRef.value
    if (canvas) return canvas
  }
  throw new Error('画布未就绪')
}

async function loadImageFile(file: File) {
  loading.value = true
  resetState()
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
            baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
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

function onDialogOpened() {
  if (props.imageFile) {
    void loadImageFile(props.imageFile)
  }
}

function screenToCanvas(clientX: number, clientY: number) {
  const viewport = viewportRef.value!
  const rect = viewport.getBoundingClientRect()
  return {
    x: (clientX - rect.left - panX.value) / zoom.value,
    y: (clientY - rect.top - panY.value) / zoom.value,
  }
}

function isInCanvas(p: { x: number; y: number }) {
  return p.x >= 0 && p.y >= 0 && p.x < canvasSize.value.w && p.y < canvasSize.value.h
}

function shouldPan(e: MouseEvent) {
  return e.button === 1 || (spaceHeld.value && e.button === 0)
}

function onViewportMouseDown(e: MouseEvent) {
  if (loading.value) return
  if (shouldPan(e)) {
    isPanning.value = true
    panStart = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
    e.preventDefault()
    return
  }
  if (e.button !== 0) return
  const pt = screenToCanvas(e.clientX, e.clientY)
  if (!isInCanvas(pt)) return
  clearMaskPreviewState()
  const label = e.shiftKey ? 0 : 1
  points.value = [...points.value, { x: pt.x, y: pt.y, label }]
}

function onContextMenu(e: MouseEvent) {
  const pt = screenToCanvas(e.clientX, e.clientY)
  if (!isInCanvas(pt)) return
  clearMaskPreviewState()
  points.value = [...points.value, { x: pt.x, y: pt.y, label: 0 }]
}

function onViewportMouseMove(e: MouseEvent) {
  if (!isPanning.value) return
  panX.value = panStart.panX + (e.clientX - panStart.x)
  panY.value = panStart.panY + (e.clientY - panStart.y)
}

function onViewportMouseUp(e: MouseEvent) {
  if (isPanning.value && (e.button === 1 || e.button === 0)) {
    isPanning.value = false
  }
}

function onViewportMouseLeave() {
  isPanning.value = false
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

async function previewMask() {
  if (!props.imageFile || positiveCount.value === 0) return
  segmenting.value = true
  try {
    const res = await gemSegmentSam(
      props.imageFile,
      points.value,
      segmentSessionId.value || undefined
    )
    segmentSessionId.value = res.data.sessionId
    coverage.value = res.data.gemCoverageRatio ?? null
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
    ElMessage.success('蒙版预览已更新，请确认边界后应用占位色')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '蒙版预览失败')
  } finally {
    segmenting.value = false
  }
}

async function applyFlatten() {
  if (!props.imageFile || positiveCount.value === 0) return
  applying.value = true
  try {
    const res = await gemFlattenSam(props.imageFile, points.value, {
      gemPreset: localPreset.value,
      preserveEdges: true,
      sessionId: segmentSessionId.value || undefined,
    })
    const blob = await fetchPreprocessPreview(res.data.previewUrl)
    const file = new File(
      [blob],
      props.imageFile.name.replace(/\.[^.]+$/, '') + '_gem_flat.png',
      { type: 'image/png' }
    )
    emit('applied', { file, result: res.data })
    dialogVisible.value = false
    ElMessage.success('SAM 宝石占位色已应用')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '应用占位色失败')
  } finally {
    applying.value = false
  }
}

function handleCancel() {
  emit('cancel')
  dialogVisible.value = false
}

function onDialogClosed() {
  resetState()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !spaceHeld.value) {
    spaceHeld.value = true
    e.preventDefault()
  }
  if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
    e.preventDefault()
    undoSamStep()
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spaceHeld.value = false
    isPanning.value = false
  }
}

watch(
  () => props.imageFile,
  (file, prev) => {
    if (props.visible && file && file !== prev) {
      void loadImageFile(file)
    }
  }
)

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
.editor-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.gem-preset-select {
  width: 140px;
}

.coverage-tag {
  font-size: 12px;
  color: var(--text-muted);
  padding: 2px 8px;
  background: #f0f9eb;
  border-radius: 4px;
}

.zoom-label {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
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
}

.points-overlay {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
}

.viewport-hint {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.88);
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
