<template>
  <div class="sheet-split-uploader">
    <div v-if="!sourceFile" class="sheet-upload-zone">
      <el-upload
        drag
        :auto-upload="false"
        :show-file-list="false"
        accept=".jpg,.jpeg,.png,.bmp"
        :on-change="onFilePick"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">拖拽或点击上传「多视图合一」CAD 参考图</div>
        <div class="upload-hint">支持灰底/黑底珠宝三视图、四视图排版</div>
      </el-upload>
    </div>

    <template v-else>
      <div class="sheet-toolbar">
        <span class="sheet-name">{{ sourceFile.name }}</span>
        <el-button size="small" @click="resetAll">重新上传</el-button>
        <el-radio-group v-model="splitMode" size="small" @change="onSplitModeChange">
          <el-radio-button value="auto">自动切分</el-radio-button>
          <el-radio-button value="manual">手动切分</el-radio-button>
        </el-radio-group>
        <el-button
          v-if="splitMode === 'auto'"
          type="primary"
          size="small"
          :loading="splitting"
          @click="runSplit"
        >
          {{ splitResult?.crops?.length ? '重新切分' : '自动切分' }}
        </el-button>
      </div>

      <div v-if="splitMode === 'manual'" class="manual-toolbar">
        <el-radio-group v-model="editorTool" size="small">
          <el-radio-button value="select">选择/调整</el-radio-button>
          <el-radio-button value="draw">绘制框</el-radio-button>
        </el-radio-group>
        <el-button
          size="small"
          type="danger"
          plain
          :disabled="!activeCropId"
          @click="activeCropId && removeCrop(activeCropId)"
        >
          删除选中
        </el-button>
        <span class="manual-toolbar-hint">
          拖拽空白处绘制新框；选中后可拖动移动，拖角点缩放
        </span>
      </div>

      <div v-if="sourcePreviewUrl" class="sheet-preview-wrap">
        <div
          class="sheet-preview"
          :class="{
            'is-manual': splitMode === 'manual',
            'is-drawing': editorTool === 'draw' && splitMode === 'manual',
          }"
          @mousedown="onPreviewMouseDown"
          @mousemove="onPreviewMouseMove"
          @mouseup="onPreviewMouseUp"
          @mouseleave="onPreviewMouseLeave"
        >
          <img
            ref="sourceImgRef"
            :src="sourcePreviewUrl"
            alt="CAD 原图"
            class="sheet-source-img"
            draggable="false"
            @load="onSourceImageLoad"
          />
          <div
            v-for="crop in splitResult?.crops ?? []"
            :key="crop.id"
            class="bbox"
            :class="{
              active: activeCropId === crop.id,
              manual: crop.manual,
            }"
            :style="bboxStyle(crop)"
            @click="activeCropId = crop.id"
            @mousedown.stop="onBboxMouseDown($event, crop.id)"
          >
            <template v-if="splitMode === 'manual' && activeCropId === crop.id">
              <span
                v-for="handle in resizeHandles"
                :key="handle"
                class="resize-handle"
                :class="`handle-${handle}`"
                @mousedown.stop="onResizeMouseDown($event, crop.id, handle)"
              />
            </template>
          </div>
          <div
            v-if="draftRect"
            class="bbox draft"
            :style="draftRectStyle"
          />
        </div>
        <p class="sheet-preview-hint">
          <template v-if="splitMode === 'manual'">
            手动模式：绘制矩形框切分各视角；橙色虚线为手动框，蓝色实线为自动检测框
          </template>
          <template v-else>
            点击框线可选中对应切分块；若自动切分不准，可切换到「手动切分」调整
          </template>
        </p>
      </div>

      <div v-if="splitResult?.crops?.length" class="crop-assign-panel">
        <p class="panel-title">将切分结果分配到标准视角（至少 2 个用于多视图生成，分配后即可抠图或生成）</p>
        <div class="crop-grid">
          <div
            v-for="crop in splitResult.crops"
            :key="crop.id"
            class="crop-card"
            :class="{ active: activeCropId === crop.id }"
            @click="activeCropId = crop.id"
          >
            <img :src="cropPreviewUrls[crop.id]" :alt="crop.id" class="crop-thumb" />
            <div class="crop-transforms" @click.stop>
              <el-tooltip content="水平翻转" placement="top">
                <el-button size="small" @click="onFlipH(crop.id)">↔</el-button>
              </el-tooltip>
              <el-tooltip content="垂直翻转" placement="top">
                <el-button size="small" @click="onFlipV(crop.id)">↕</el-button>
              </el-tooltip>
              <el-tooltip content="逆时针 90°" placement="top">
                <el-button size="small" @click="onRotateCCW(crop.id)">↺</el-button>
              </el-tooltip>
              <el-tooltip content="顺时针 90°" placement="top">
                <el-button size="small" @click="onRotateCW(crop.id)">↻</el-button>
              </el-tooltip>
              <el-tooltip content="复制切分块" placement="top">
                <el-button size="small" @click="duplicateCrop(crop.id)">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="删除切分块" placement="top">
                <el-button size="small" type="danger" plain @click="removeCrop(crop.id)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
            <div class="crop-meta">
              <span class="crop-id">
                {{ crop.id }}
                <el-tag v-if="crop.manual" size="small" type="warning" effect="plain">手动</el-tag>
              </span>
              <el-select
                v-model="assignments[crop.id]"
                size="small"
                placeholder="分配视角"
                clearable
                @click.stop
              >
                <el-option
                  v-for="face in VIEW_FACES"
                  :key="face"
                  :label="viewOptionLabel(face, crop.id)"
                  :value="face"
                  :disabled="isFaceTakenByOther(face, crop.id)"
                />
              </el-select>
              <span v-if="crop.guess" class="crop-guess">
                建议: {{ VIEW_LABELS[crop.guess as ViewFace] }}
              </span>
            </div>
          </div>
        </div>

        <div class="apply-bar">
          <span class="assign-count">已分配 {{ assignedCount }} 个视角</span>
          <el-button
            type="success"
            :disabled="assignedCount < 2 || applying"
            :loading="applying"
            @click="applyToMultiView"
          >
            确认并进入多视图建模
          </el-button>
        </div>
      </div>

      <div
        v-else-if="splitMode === 'manual' && splitResult"
        class="manual-empty-hint"
      >
        在上方原图上拖拽绘制切分框，至少添加 2 个区域后再分配视角
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount, watch } from 'vue'
import { UploadFilled, CopyDocument, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  VIEW_FACES,
  VIEW_LABELS,
  HY3D_SUPPORTED_FACES,
  hasMinimumViews,
  type ViewFace,
  type ViewImages,
} from '@/types/multiView'
import {
  splitMultiViewSheet,
  fetchPreprocessPreview,
  type SplitMultiViewResult,
  type ViewCropItem,
} from '@/api'
import {
  DEFAULT_IMAGE_TRANSFORM,
  applyImageTransform,
  rotateCCW,
  rotateCW,
  toggleFlipH,
  toggleFlipV,
  type ImageTransform,
} from '@/utils/imageTransform'
import {
  clampRect,
  cropImageRegion,
  normalizeDrawRect,
  type CropRect,
} from '@/utils/sheetCrop'

const emit = defineEmits<{
  applied: [views: ViewImages]
  staged: [views: ViewImages]
  'state-changed': []
}>()

type SplitMode = 'auto' | 'manual'
type EditorTool = 'select' | 'draw'
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se'

const resizeHandles: ResizeHandle[] = ['nw', 'ne', 'sw', 'se']

const sourceFile = ref<File | null>(null)
const sourcePreviewUrl = ref('')
const sourceImgRef = ref<HTMLImageElement | null>(null)
const splitting = ref(false)
const applying = ref(false)
const splitResult = ref<SplitMultiViewResult | null>(null)
const splitMode = ref<SplitMode>('auto')
const editorTool = ref<EditorTool>('select')
const cropPreviewUrls = reactive<Record<string, string>>({})
const cropRawBlobs = reactive<Record<string, Blob>>({})
const transforms = reactive<Record<string, ImageTransform>>({})
const assignments = reactive<Record<string, ViewFace | ''>>({})
const activeCropId = ref<string | null>(null)
const draftRect = ref<CropRect | null>(null)
let stagedEmitTimer: ReturnType<typeof setTimeout> | null = null
let manualCropCounter = 0

type DragKind = 'draw' | 'move' | 'resize'
interface DragState {
  kind: DragKind
  cropId?: string
  handle?: ResizeHandle
  startX: number
  startY: number
  originRect?: CropRect
  moveOffsetX?: number
  moveOffsetY?: number
}

let dragState: DragState | null = null

const assignedCount = computed(() =>
  Object.values(assignments).filter((v) => !!v).length
)

const draftRectStyle = computed(() => {
  const meta = splitResult.value
  if (!meta?.sourceWidth || !meta.sourceHeight || !draftRect.value) return {}
  const r = draftRect.value
  return {
    left: `${(r.x / meta.sourceWidth) * 100}%`,
    top: `${(r.y / meta.sourceHeight) * 100}%`,
    width: `${(r.width / meta.sourceWidth) * 100}%`,
    height: `${(r.height / meta.sourceHeight) * 100}%`,
  }
})

function viewOptionLabel(face: ViewFace, cropId: string): string {
  const base = VIEW_LABELS[face]
  if (!HY3D_SUPPORTED_FACES.includes(face)) {
    return `${base}（仅存档）`
  }
  const taken = Object.entries(assignments).find(([id, f]) => f === face && id !== cropId)
  return taken ? `${base}（已被占用）` : base
}

function isFaceTakenByOther(face: ViewFace, cropId: string): boolean {
  return Object.entries(assignments).some(([id, f]) => id !== cropId && f === face)
}

function ensureTransform(cropId: string): ImageTransform {
  if (!transforms[cropId]) {
    transforms[cropId] = { ...DEFAULT_IMAGE_TRANSFORM }
  }
  return transforms[cropId]
}

async function refreshCropPreview(cropId: string) {
  const raw = cropRawBlobs[cropId]
  if (!raw) return
  const out = await applyImageTransform(raw, ensureTransform(cropId))
  if (cropPreviewUrls[cropId]) URL.revokeObjectURL(cropPreviewUrls[cropId])
  cropPreviewUrls[cropId] = URL.createObjectURL(out)
}

async function refreshCropFromRegion(cropId: string) {
  const meta = splitResult.value
  const file = sourceFile.value
  const crop = meta?.crops.find((c) => c.id === cropId)
  if (!meta || !file || !crop) return

  const blob = await cropImageRegion(file, {
    x: crop.x,
    y: crop.y,
    width: crop.width,
    height: crop.height,
  })
  cropRawBlobs[cropId] = blob
  await refreshCropPreview(cropId)
}

async function buildViewFile(cropId: string, face: ViewFace): Promise<File> {
  const raw = cropRawBlobs[cropId]
  if (!raw) throw new Error(`切分块 ${cropId} 数据缺失`)
  const out = await applyImageTransform(raw, ensureTransform(cropId))
  return new File([out], `${face}_${cropId}.png`, { type: 'image/png' })
}

async function buildAssignedViews(): Promise<ViewImages> {
  const views: ViewImages = {}
  for (const [cropId, face] of Object.entries(assignments)) {
    if (!face) continue
    views[face] = await buildViewFile(cropId, face)
  }
  return views
}

function notifyStateChanged() {
  emit('state-changed')
}

function scheduleStagedEmit() {
  if (stagedEmitTimer) clearTimeout(stagedEmitTimer)
  stagedEmitTimer = setTimeout(async () => {
    try {
      if (assignedCount.value < 2) {
        emit('staged', {})
        notifyStateChanged()
        return
      }
      const views = await buildAssignedViews()
      emit('staged', views)
      notifyStateChanged()
    } catch {
      // 预览刷新失败时忽略，避免打断用户操作
    }
  }, 200)
}

async function onFlipH(cropId: string) {
  transforms[cropId] = toggleFlipH(ensureTransform(cropId))
  await refreshCropPreview(cropId)
  scheduleStagedEmit()
}

async function onFlipV(cropId: string) {
  transforms[cropId] = toggleFlipV(ensureTransform(cropId))
  await refreshCropPreview(cropId)
  scheduleStagedEmit()
}

async function onRotateCCW(cropId: string) {
  transforms[cropId] = rotateCCW(ensureTransform(cropId))
  await refreshCropPreview(cropId)
  scheduleStagedEmit()
}

async function onRotateCW(cropId: string) {
  transforms[cropId] = rotateCW(ensureTransform(cropId))
  await refreshCropPreview(cropId)
  scheduleStagedEmit()
}

function nextCopyCropId(sourceId: string): string {
  const crops = splitResult.value?.crops ?? []
  let n = 1
  let id = `${sourceId}_copy${n}`
  while (crops.some((c) => c.id === id)) {
    n += 1
    id = `${sourceId}_copy${n}`
  }
  return id
}

function nextManualCropId(): string {
  manualCropCounter += 1
  return `manual_${manualCropCounter}`
}

async function duplicateCrop(sourceId: string) {
  const meta = splitResult.value
  const src = meta?.crops.find((c) => c.id === sourceId)
  const raw = cropRawBlobs[sourceId]
  if (!meta || !src || !raw) return

  const newId = nextCopyCropId(sourceId)
  cropRawBlobs[newId] = raw.slice()
  transforms[newId] = { ...ensureTransform(sourceId) }
  assignments[newId] = ''

  meta.crops.push({
    ...src,
    id: newId,
    guess: undefined,
    manual: src.manual ?? true,
    previewUrl: src.previewUrl,
  })
  await refreshCropPreview(newId)
  activeCropId.value = newId
  scheduleStagedEmit()
  ElMessage.success('已复制切分块')
}

function removeCrop(cropId: string) {
  const meta = splitResult.value
  if (!meta) return
  const allowEmpty = splitMode.value === 'manual'
  if (!allowEmpty && meta.crops.length <= 1) {
    ElMessage.warning('至少保留一个切分块')
    return
  }

  meta.crops = meta.crops.filter((c) => c.id !== cropId)
  delete assignments[cropId]
  delete transforms[cropId]
  if (cropPreviewUrls[cropId]) URL.revokeObjectURL(cropPreviewUrls[cropId])
  delete cropPreviewUrls[cropId]
  delete cropRawBlobs[cropId]

  if (activeCropId.value === cropId) {
    activeCropId.value = meta.crops[0]?.id ?? null
  }
  scheduleStagedEmit()
  ElMessage.success('已删除切分块')
}

function onFilePick(uploadFile: { raw?: File }) {
  const file = uploadFile.raw
  if (!file) return
  resetSplitState()
  sourceFile.value = file
  if (sourcePreviewUrl.value) URL.revokeObjectURL(sourcePreviewUrl.value)
  sourcePreviewUrl.value = URL.createObjectURL(file)
  notifyStateChanged()
}

function bboxStyle(crop: ViewCropItem) {
  const meta = splitResult.value
  if (!meta?.sourceWidth || !meta.sourceHeight) return {}
  const sw = meta.sourceWidth
  const sh = meta.sourceHeight
  return {
    left: `${(crop.x / sw) * 100}%`,
    top: `${(crop.y / sh) * 100}%`,
    width: `${(crop.width / sw) * 100}%`,
    height: `${(crop.height / sh) * 100}%`,
  }
}

function applyGuessAssignments(crops: ViewCropItem[]) {
  for (const key of Object.keys(assignments)) delete assignments[key]
  const used = new Set<ViewFace>()
  for (const crop of crops) {
    const guess = crop.guess as ViewFace | undefined
    if (guess && VIEW_FACES.includes(guess) && !used.has(guess)) {
      assignments[crop.id] = guess
      used.add(guess)
    } else {
      assignments[crop.id] = ''
    }
  }
}

function getSourceDimensions(): { width: number; height: number } | null {
  const img = sourceImgRef.value
  if (img?.naturalWidth && img.naturalHeight) {
    return { width: img.naturalWidth, height: img.naturalHeight }
  }
  return null
}

async function ensureManualSplitMeta(): Promise<SplitMultiViewResult | null> {
  const dims = getSourceDimensions()
  if (!dims) {
    ElMessage.warning('请等待图片加载完成')
    return null
  }
  if (!splitResult.value) {
    splitResult.value = {
      sessionId: `manual_${Date.now()}`,
      sourceWidth: dims.width,
      sourceHeight: dims.height,
      crops: [],
    }
  } else {
    splitResult.value.sourceWidth = dims.width
    splitResult.value.sourceHeight = dims.height
  }
  return splitResult.value
}

function onSourceImageLoad() {
  const dims = getSourceDimensions()
  if (!dims || !splitResult.value) return
  splitResult.value.sourceWidth = dims.width
  splitResult.value.sourceHeight = dims.height
}

function onSplitModeChange(mode: SplitMode) {
  if (mode === 'manual') {
    void ensureManualSplitMeta()
    editorTool.value = 'draw'
  }
}

function pointerToImageCoords(clientX: number, clientY: number): { x: number; y: number } | null {
  const img = sourceImgRef.value
  const meta = splitResult.value
  if (!img || !meta?.sourceWidth || !meta.sourceHeight) return null
  const rect = img.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const relX = (clientX - rect.left) / rect.width
  const relY = (clientY - rect.top) / rect.height
  return {
    x: Math.round(relX * meta.sourceWidth),
    y: Math.round(relY * meta.sourceHeight),
  }
}

function findCropAt(x: number, y: number): ViewCropItem | undefined {
  const crops = splitResult.value?.crops ?? []
  for (let i = crops.length - 1; i >= 0; i -= 1) {
    const c = crops[i]
    if (x >= c.x && y >= c.y && x <= c.x + c.width && y <= c.y + c.height) {
      return c
    }
  }
  return undefined
}

function onPreviewMouseDown(e: MouseEvent) {
  if (splitMode.value !== 'manual' || e.button !== 0) return
  void (async () => {
    const meta = await ensureManualSplitMeta()
    if (!meta) return
    const pt = pointerToImageCoords(e.clientX, e.clientY)
    if (!pt) return

    if (editorTool.value === 'draw') {
      draftRect.value = { x: pt.x, y: pt.y, width: 0, height: 0 }
      dragState = { kind: 'draw', startX: pt.x, startY: pt.y }
      return
    }

    const hit = findCropAt(pt.x, pt.y)
    if (hit) {
      activeCropId.value = hit.id
      dragState = {
        kind: 'move',
        cropId: hit.id,
        startX: pt.x,
        startY: pt.y,
        originRect: { x: hit.x, y: hit.y, width: hit.width, height: hit.height },
        moveOffsetX: pt.x - hit.x,
        moveOffsetY: pt.y - hit.y,
      }
    } else {
      activeCropId.value = null
    }
  })()
}

function onBboxMouseDown(e: MouseEvent, cropId: string) {
  if (splitMode.value !== 'manual' || e.button !== 0) return
  activeCropId.value = cropId
  const pt = pointerToImageCoords(e.clientX, e.clientY)
  const crop = splitResult.value?.crops.find((c) => c.id === cropId)
  if (!pt || !crop) return
  dragState = {
    kind: 'move',
    cropId,
    startX: pt.x,
    startY: pt.y,
    originRect: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
    moveOffsetX: pt.x - crop.x,
    moveOffsetY: pt.y - crop.y,
  }
}

function onResizeMouseDown(e: MouseEvent, cropId: string, handle: ResizeHandle) {
  if (splitMode.value !== 'manual') return
  const pt = pointerToImageCoords(e.clientX, e.clientY)
  const crop = splitResult.value?.crops.find((c) => c.id === cropId)
  if (!pt || !crop) return
  activeCropId.value = cropId
  dragState = {
    kind: 'resize',
    cropId,
    handle,
    startX: pt.x,
    startY: pt.y,
    originRect: { x: crop.x, y: crop.y, width: crop.width, height: crop.height },
  }
}

function onPreviewMouseMove(e: MouseEvent) {
  if (!dragState || splitMode.value !== 'manual') return
  const meta = splitResult.value
  const pt = pointerToImageCoords(e.clientX, e.clientY)
  if (!meta || !pt) return

  if (dragState.kind === 'draw') {
    const normalized = normalizeDrawRect(
      dragState.startX,
      dragState.startY,
      pt.x,
      pt.y,
      meta.sourceWidth,
      meta.sourceHeight
    )
    draftRect.value = normalized ?? {
      x: Math.min(dragState.startX, pt.x),
      y: Math.min(dragState.startY, pt.y),
      width: Math.abs(pt.x - dragState.startX),
      height: Math.abs(pt.y - dragState.startY),
    }
    return
  }

  const crop = meta.crops.find((c) => c.id === dragState!.cropId)
  const origin = dragState.originRect
  if (!crop || !origin) return

  if (dragState.kind === 'move') {
    const offsetX = dragState.moveOffsetX ?? 0
    const offsetY = dragState.moveOffsetY ?? 0
    const next = clampRect(
      {
        x: pt.x - offsetX,
        y: pt.y - offsetY,
        width: origin.width,
        height: origin.height,
      },
      meta.sourceWidth,
      meta.sourceHeight
    )
    crop.x = next.x
    crop.y = next.y
    return
  }

  if (dragState.kind === 'resize' && dragState.handle) {
    let { x, y, width, height } = origin
    const right = origin.x + origin.width
    const bottom = origin.y + origin.height
    switch (dragState.handle) {
      case 'se':
        width = pt.x - origin.x
        height = pt.y - origin.y
        break
      case 'sw':
        x = pt.x
        width = right - pt.x
        height = pt.y - origin.y
        break
      case 'ne':
        y = pt.y
        width = pt.x - origin.x
        height = bottom - pt.y
        break
      case 'nw':
        x = pt.x
        y = pt.y
        width = right - pt.x
        height = bottom - pt.y
        break
    }
    const next = clampRect({ x, y, width, height }, meta.sourceWidth, meta.sourceHeight)
    crop.x = next.x
    crop.y = next.y
    crop.width = next.width
    crop.height = next.height
  }
}

async function finishDrag() {
  if (!dragState) return
  const state = dragState
  dragState = null

  if (state.kind === 'draw' && draftRect.value) {
    const meta = splitResult.value
    const file = sourceFile.value
    if (!meta || !file) {
      draftRect.value = null
      return
    }
    const normalized = normalizeDrawRect(
      state.startX,
      state.startY,
      draftRect.value.x + draftRect.value.width,
      draftRect.value.y + draftRect.value.height,
      meta.sourceWidth,
      meta.sourceHeight
    )
    draftRect.value = null
    if (!normalized) return

    const cropId = nextManualCropId()
    const crop: ViewCropItem = {
      id: cropId,
      ...normalized,
      manual: true,
    }
    meta.crops.push(crop)
    assignments[cropId] = ''
    transforms[cropId] = { ...DEFAULT_IMAGE_TRANSFORM }
    activeCropId.value = cropId
    await refreshCropFromRegion(cropId)
    scheduleStagedEmit()
    ElMessage.success('已添加切分区域')
    return
  }

  if ((state.kind === 'move' || state.kind === 'resize') && state.cropId) {
    await refreshCropFromRegion(state.cropId)
    scheduleStagedEmit()
  }
}

function onPreviewMouseUp() {
  void finishDrag()
}

function onPreviewMouseLeave() {
  if (dragState?.kind === 'draw') {
    draftRect.value = null
    dragState = null
    return
  }
  void finishDrag()
}

async function runSplit() {
  if (!sourceFile.value) return
  splitting.value = true
  try {
    const res = await splitMultiViewSheet(sourceFile.value)
    splitResult.value = res.data
    applyGuessAssignments(res.data.crops)

    for (const url of Object.values(cropPreviewUrls)) {
      URL.revokeObjectURL(url)
    }
    for (const key of Object.keys(cropPreviewUrls)) delete cropPreviewUrls[key]
    for (const key of Object.keys(cropRawBlobs)) delete cropRawBlobs[key]
    for (const key of Object.keys(transforms)) delete transforms[key]

    for (const crop of res.data.crops) {
      if (crop.previewUrl) {
        const blob = await fetchPreprocessPreview(crop.previewUrl)
        cropRawBlobs[crop.id] = blob
      } else {
        const blob = await cropImageRegion(sourceFile.value, crop)
        cropRawBlobs[crop.id] = blob
      }
      transforms[crop.id] = { ...DEFAULT_IMAGE_TRANSFORM }
      await refreshCropPreview(crop.id)
    }

    scheduleStagedEmit()
    notifyStateChanged()

    ElMessage.success(`已切分出 ${res.data.crops.length} 个视图区域`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '切分失败'
    ElMessage.error(msg)
    if (splitMode.value === 'auto') {
      splitMode.value = 'manual'
      editorTool.value = 'draw'
      await ensureManualSplitMeta()
      ElMessage.info('已切换到「手动切分」，请拖拽绘制各视角矩形框')
    }
  } finally {
    splitting.value = false
  }
}

async function applyToMultiView() {
  if (!splitResult.value || assignedCount.value < 2) return
  applying.value = true
  try {
    const views = await buildAssignedViews()
    if (!hasMinimumViews(views, 2)) {
      ElMessage.warning('请至少分配 2 个视角')
      return
    }
    emit('applied', views)
    ElMessage.success('已应用到多视图，可继续抠图并生成 3D')
  } catch (e: unknown) {
    ElMessage.error(e instanceof Error ? e.message : '应用失败')
  } finally {
    applying.value = false
  }
}

function resetSplitState() {
  splitResult.value = null
  activeCropId.value = null
  draftRect.value = null
  dragState = null
  manualCropCounter = 0
  for (const key of Object.keys(assignments)) delete assignments[key]
  for (const url of Object.values(cropPreviewUrls)) URL.revokeObjectURL(url)
  for (const key of Object.keys(cropPreviewUrls)) delete cropPreviewUrls[key]
  for (const key of Object.keys(cropRawBlobs)) delete cropRawBlobs[key]
  for (const key of Object.keys(transforms)) delete transforms[key]
  emit('staged', {})
}

watch(
  () => ({ ...assignments }),
  () => scheduleStagedEmit(),
  { deep: true }
)

function resetAll() {
  resetSplitState()
  sourceFile.value = null
  splitMode.value = 'auto'
  editorTool.value = 'select'
  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
    sourcePreviewUrl.value = ''
  }
}

export interface SheetRestoreState {
  sourceFile: File
  splitResult: SplitMultiViewResult | null
  splitMode: SplitMode
  editorTool: EditorTool
  assignments: Record<string, ViewFace | ''>
  transforms: Record<string, ImageTransform>
  cropBlobs: Record<string, Blob>
}

function getPersistState(): SheetRestoreState | null {
  if (!sourceFile.value) return null
  return {
    sourceFile: sourceFile.value,
    splitResult: splitResult.value ? { ...splitResult.value, crops: [...splitResult.value.crops] } : null,
    splitMode: splitMode.value,
    editorTool: editorTool.value,
    assignments: { ...assignments },
    transforms: JSON.parse(JSON.stringify(transforms)) as Record<string, ImageTransform>,
    cropBlobs: { ...cropRawBlobs },
  }
}

async function restoreFromState(state: SheetRestoreState) {
  resetAll()
  sourceFile.value = state.sourceFile
  sourcePreviewUrl.value = URL.createObjectURL(state.sourceFile)
  splitResult.value = state.splitResult
  splitMode.value = state.splitMode
  editorTool.value = state.editorTool

  for (const key of Object.keys(assignments)) delete assignments[key]
  Object.assign(assignments, state.assignments)

  for (const key of Object.keys(transforms)) delete transforms[key]
  Object.assign(transforms, state.transforms)

  for (const key of Object.keys(cropRawBlobs)) delete cropRawBlobs[key]
  for (const [cropId, blob] of Object.entries(state.cropBlobs)) {
    cropRawBlobs[cropId] = blob
  }

  for (const cropId of Object.keys(cropRawBlobs)) {
    await refreshCropPreview(cropId)
  }
  scheduleStagedEmit()
  notifyStateChanged()
}

defineExpose({
  getPersistState,
  restoreFromState,
})

onBeforeUnmount(resetAll)
</script>

<style scoped>
.sheet-split-uploader {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  max-width: 100%;
}

.upload-icon {
  font-size: 42px;
  color: var(--el-color-primary);
}

.upload-text {
  font-size: 14px;
  color: var(--text-primary);
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
}

.sheet-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.manual-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f5f7fa;
  border: 1px dashed var(--border-color, #dcdfe6);
}

.manual-toolbar-hint {
  flex: 1;
  min-width: 180px;
  font-size: 12px;
  color: var(--text-muted);
}

.sheet-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-preview-wrap {
  width: 100%;
  max-width: 100%;
  max-height: min(52vh, 520px);
  overflow: auto;
  border: 1px solid var(--border-color, #e4e7ed);
  border-radius: 8px;
  padding: 8px;
  background: #fafafa;
  box-sizing: border-box;
}

.sheet-preview {
  position: relative;
  width: 100%;
  max-width: 100%;
  line-height: 0;
  user-select: none;
}

.sheet-preview.is-manual.is-drawing {
  cursor: crosshair;
}

.sheet-preview.is-manual:not(.is-drawing) {
  cursor: default;
}

.sheet-source-img {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  pointer-events: none;
}

.bbox {
  position: absolute;
  border: 2px solid rgba(64, 158, 255, 0.85);
  box-sizing: border-box;
  pointer-events: auto;
  cursor: pointer;
}

.bbox.manual {
  border-style: dashed;
  border-color: rgba(230, 162, 60, 0.95);
}

.bbox.active {
  border-color: #67c23a;
  background: rgba(103, 194, 58, 0.12);
  z-index: 2;
}

.bbox.manual.active {
  border-color: #e6a23c;
  background: rgba(230, 162, 60, 0.12);
}

.bbox.draft {
  border-style: dashed;
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.08);
  pointer-events: none;
  z-index: 3;
}

.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 2px solid #67c23a;
  border-radius: 2px;
  box-sizing: border-box;
  z-index: 4;
}

.handle-nw {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.handle-ne {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.handle-sw {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.handle-se {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

.sheet-preview-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
}

.manual-empty-hint {
  padding: 12px 14px;
  border-radius: 8px;
  background: #fdf6ec;
  color: #e6a23c;
  font-size: 13px;
  line-height: 1.6;
}

.panel-title {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

.crop-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  min-width: 0;
}

.crop-card {
  border: 1px solid var(--border-color, #e4e7ed);
  border-radius: 8px;
  padding: 8px;
  background: #fff;
  cursor: pointer;
  min-width: 0;
}

.crop-card.active {
  border-color: #409eff;
  box-shadow: 0 0 0 1px #409eff inset;
}

.crop-thumb {
  width: 100%;
  height: 120px;
  object-fit: contain;
  background: repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 16px 16px;
  border-radius: 4px;
}

.crop-transforms {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
}

.crop-transforms .el-button {
  min-width: 28px;
  padding: 4px 8px;
  font-size: 14px;
  margin: 0;
}

.crop-meta {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.crop-meta :deep(.el-select) {
  width: 100%;
}

.crop-id {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
}

.crop-guess {
  font-size: 11px;
  color: #e6a23c;
}

.apply-bar {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.assign-count {
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
