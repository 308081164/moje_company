<template>
  <el-dialog
    v-model="dialogVisible"
    title="手动微调"
    width="min(92vw, 960px)"
    :close-on-click-modal="false"
    destroy-on-close
    class="preprocess-editor-dialog"
    @closed="onDialogClosed"
  >
    <p class="editor-hint">{{ toolHint }}</p>

    <div class="editor-toolbar">
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
        <el-radio-button value="ai" disabled>
          <el-icon><MagicStick /></el-icon>
          AI智能消除
          <el-tag size="small" type="info" class="coming-soon-tag">即将推出</el-tag>
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

      <el-button size="small" :disabled="!canUndo" @click="undo">
        <el-icon><RefreshLeft /></el-icon>
        撤销
      </el-button>

      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
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
      @contextmenu.prevent
    >
      <div v-if="loading" class="editor-loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <span>加载图像中...</span>
      </div>

      <div
        v-show="!loading"
        ref="stageRef"
        class="editor-stage"
        :style="stageStyle"
      >
        <canvas ref="canvasRef" class="editor-canvas" />
        <svg
          v-if="tool === 'pen' && penPoints.length > 0"
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
      </div>

      <div
        v-if="showBrushCursor && !loading && !isPanning"
        class="brush-cursor"
        :class="{ 'is-erase': tool === 'erase', 'is-restore': tool === 'restore' }"
        :style="brushCursorStyle"
      />

      <div v-if="!loading" class="viewport-hint">
        滚轮缩放 · 空格+拖拽平移 · 中键拖拽平移
      </div>
    </div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="loading" @click="handleApply">
        应用
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Brush, RefreshLeft, Loading, Aim, EditPen, MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { savePreprocess } from '@/api'

const MAX_UNDO = 10
const MIN_ZOOM = 0.1
const MAX_ZOOM = 12

type Tool = 'erase' | 'restore' | 'colorPick' | 'pen' | 'ai'

interface Point {
  x: number
  y: number
}

const props = defineProps<{
  visible: boolean
  imageSource: string
  sessionId?: string
  fileName?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [file: File]
  cancel: []
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const viewportRef = ref<HTMLDivElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)

const tool = ref<Tool>('erase')
const brushSize = ref(12)
const colorTolerance = ref(32)
const loading = ref(false)
const saving = ref(false)
const isDrawing = ref(false)
const canUndo = ref(false)
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

let ctx: CanvasRenderingContext2D | null = null
let baseImageData: ImageData | null = null
const undoStack: ImageData[] = []

let panStart = { x: 0, y: 0, panX: 0, panY: 0 }
let lastPaintPoint: Point | null = null
let penLastClickTime = 0

const toolHint = computed(() => {
  switch (tool.value) {
    case 'erase':
      return '擦除笔：在透明底图上涂抹，去除残留背景'
    case 'restore':
      return '恢复笔：还原误删的主体区域'
    case 'colorPick':
      return '取色消除：点击图像采样颜色，容差范围内相似像素将被透明化（类似魔棒）'
    case 'pen':
      return '钢笔圈画：单击添加节点，双击或点击「闭合」填充内部为透明'
    default:
      return 'AI 智能消除功能即将推出，敬请期待'
  }
})

const stageStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: '0 0',
  width: `${canvasSize.value.w}px`,
  height: `${canvasSize.value.h}px`,
}))

const showBrushCursor = computed(
  () =>
    (tool.value === 'erase' || tool.value === 'restore') &&
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

function resetEditorState() {
  ctx = null
  baseImageData = null
  undoStack.length = 0
  canUndo.value = false
  isDrawing.value = false
  isPanning.value = false
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  cursorPos.value = null
  penPoints.value = []
  penHoverPoint.value = null
  pickedColor.value = null
  lastPaintPoint = null
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

function loadImageToCanvas(src: string) {
  loading.value = true
  resetEditorState()

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = async () => {
    await nextTick()
    const canvas = canvasRef.value
    if (!canvas) return

    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvasSize.value = { w: canvas.width, h: canvas.height }
    ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    ctx.drawImage(img, 0, 0)
    baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    await nextTick()
    fitCanvasToViewport()
    loading.value = false
  }
  img.onerror = () => {
    loading.value = false
    ElMessage.error('图像加载失败')
  }
  img.src = src
}

function screenToCanvas(clientX: number, clientY: number): Point {
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
  return (
    p.x >= 0 &&
    p.y >= 0 &&
    p.x < canvasSize.value.w &&
    p.y < canvasSize.value.h
  )
}

function pushUndo() {
  if (!ctx || !canvasRef.value) return
  const snapshot = ctx.getImageData(0, 0, canvasRef.value.width, canvasRef.value.height)
  undoStack.push(snapshot)
  if (undoStack.length > MAX_UNDO) {
    undoStack.shift()
  }
  canUndo.value = undoStack.length > 0
}

function undo() {
  const snapshot = undoStack.pop()
  if (snapshot && ctx) {
    ctx.putImageData(snapshot, 0, 0)
  }
  canUndo.value = undoStack.length > 0
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

function fillPolygonErase(points: Point[]) {
  if (!ctx || !canvasRef.value || points.length < 3) return

  const canvas = canvasRef.value
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y)
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
  pushUndo()
  fillPolygonErase(penPoints.value)
  penPoints.value = []
  penHoverPoint.value = null
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

  if (tool.value === 'erase' || tool.value === 'restore') {
    pushUndo()
    isDrawing.value = true
    lastPaintPoint = canvasPt
    paint(canvasPt.x, canvasPt.y)
    return
  }

  if (tool.value === 'colorPick') {
    pushUndo()
    floodFillErase(canvasPt.x, canvasPt.y, colorTolerance.value)
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

function onViewportMouseMove(e: MouseEvent) {
  cursorPos.value = viewportCoords(e.clientX, e.clientY)

  if (isPanning.value) {
    panX.value = panStart.panX + (e.clientX - panStart.x)
    panY.value = panStart.panY + (e.clientY - panStart.y)
    return
  }

  const canvasPt = screenToCanvas(e.clientX, e.clientY)

  if (tool.value === 'pen') {
    penHoverPoint.value = isInCanvas(canvasPt) ? canvasPt : null
  }

  if (!isDrawing.value || (tool.value !== 'erase' && tool.value !== 'restore')) return
  if (!isInCanvas(canvasPt)) return

  if (lastPaintPoint) {
    paintStroke(lastPaintPoint, canvasPt)
  } else {
    paint(canvasPt.x, canvasPt.y)
  }
  lastPaintPoint = canvasPt
}

function onViewportMouseUp(e: MouseEvent) {
  if (isPanning.value && (e.button === 1 || e.button === 0)) {
    isPanning.value = false
  }
  isDrawing.value = false
  lastPaintPoint = null
}

function onViewportMouseLeave() {
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
  if (e.code === 'Escape' && tool.value === 'pen' && penPoints.value.length > 0) {
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

function exportPngBlob(): Promise<Blob> {
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

function handleCancel() {
  emit('cancel')
  dialogVisible.value = false
}

async function handleApply() {
  saving.value = true
  try {
    const blob = await exportPngBlob()
    const file = new File([blob], props.fileName || 'no_bg.png', { type: 'image/png' })
    if (props.sessionId) {
      await savePreprocess(props.sessionId, file)
    }
    emit('saved', file)
    dialogVisible.value = false
    ElMessage.success('手动微调已保存')
  } catch (err: any) {
    ElMessage.error(err.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function onDialogClosed() {
  resetEditorState()
}

watch(
  () => props.visible,
  (open) => {
    if (open && props.imageSource) {
      loadImageToCanvas(props.imageSource)
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
  line-height: 1.5;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
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

.picked-color-swatch {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.coming-soon-tag {
  margin-left: 4px;
  vertical-align: middle;
  transform: scale(0.85);
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

.pen-overlay {
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
