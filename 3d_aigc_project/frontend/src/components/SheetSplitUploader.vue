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
        <el-button
          type="primary"
          size="small"
          :loading="splitting"
          @click="runSplit"
        >
          {{ splitResult ? '重新切分' : '自动切分' }}
        </el-button>
      </div>

      <div v-if="sourcePreviewUrl" class="sheet-preview-wrap">
        <div class="sheet-preview">
          <img
            ref="sourceImgRef"
            :src="sourcePreviewUrl"
            alt="CAD 原图"
            class="sheet-source-img"
          />
          <div
            v-for="crop in splitResult?.crops ?? []"
            :key="crop.id"
            class="bbox"
            :class="{ active: activeCropId === crop.id }"
            :style="bboxStyle(crop)"
            @click="activeCropId = crop.id"
          />
        </div>
        <p class="sheet-preview-hint">点击框线可选中对应切分块</p>
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
            </div>
            <div class="crop-meta">
              <span class="crop-id">{{ crop.id }}</span>
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount, watch } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
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

const emit = defineEmits<{
  applied: [views: ViewImages]
  staged: [views: ViewImages]
}>()

const sourceFile = ref<File | null>(null)
const sourcePreviewUrl = ref('')
const splitting = ref(false)
const applying = ref(false)
const splitResult = ref<SplitMultiViewResult | null>(null)
const cropPreviewUrls = reactive<Record<string, string>>({})
const cropRawBlobs = reactive<Record<string, Blob>>({})
const transforms = reactive<Record<string, ImageTransform>>({})
const assignments = reactive<Record<string, ViewFace | ''>>({})
const activeCropId = ref<string | null>(null)
let stagedEmitTimer: ReturnType<typeof setTimeout> | null = null

const assignedCount = computed(() =>
  Object.values(assignments).filter((v) => !!v).length
)

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

function scheduleStagedEmit() {
  if (stagedEmitTimer) clearTimeout(stagedEmitTimer)
  stagedEmitTimer = setTimeout(async () => {
    try {
      if (assignedCount.value < 2) {
        emit('staged', {})
        return
      }
      const views = await buildAssignedViews()
      emit('staged', views)
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

function onFilePick(uploadFile: { raw?: File }) {
  const file = uploadFile.raw
  if (!file) return
  resetSplitState()
  sourceFile.value = file
  if (sourcePreviewUrl.value) URL.revokeObjectURL(sourcePreviewUrl.value)
  sourcePreviewUrl.value = URL.createObjectURL(file)
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
      const blob = await fetchPreprocessPreview(crop.previewUrl)
      cropRawBlobs[crop.id] = blob
      transforms[crop.id] = { ...DEFAULT_IMAGE_TRANSFORM }
      await refreshCropPreview(crop.id)
    }

    scheduleStagedEmit()

    ElMessage.success(`已切分出 ${res.data.crops.length} 个视图区域`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '切分失败'
    ElMessage.error(msg)
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
  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
    sourcePreviewUrl.value = ''
  }
}

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
}

.sheet-source-img {
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
}

.bbox {
  position: absolute;
  border: 2px solid rgba(64, 158, 255, 0.75);
  box-sizing: border-box;
  pointer-events: auto;
  cursor: pointer;
}

.bbox.active {
  border-color: #67c23a;
  background: rgba(103, 194, 58, 0.12);
}

.sheet-preview-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
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
