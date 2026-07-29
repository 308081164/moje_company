<template>
  <div class="multi-view-uploader">
    <div class="mv-layout">
      <!-- 交互立方体 -->
      <div class="cube-panel">
        <p class="cube-hint">按住空格拖动旋转立方体，点击面片上传对应视角图片</p>
        <div
          ref="cubeContainerRef"
          class="cube-container"
          :class="{ 'is-space-held': spaceHeld, 'is-dragging': dragging }"
          @mousedown="onDragStart"
          @touchstart.passive="onTouchStart"
        >
          <div
            class="cube"
            :style="cubeStyle"
          >
            <div
              v-for="face in VIEW_FACES"
              :key="face"
              class="cube-face"
              :class="[
                `face-${face}`,
                { 'has-image': !!displayUrl(face), 'has-processed': !!processedPreviewUrls[face], active: activeFace === face },
              ]"
              @click.stop="selectFace(face)"
            >
              <img
                v-if="displayUrl(face)"
                :src="displayUrl(face)"
                :alt="VIEW_LABELS[face]"
                class="face-thumb"
              />
              <div v-else class="face-placeholder">
                <span class="face-label">{{ VIEW_LABELS[face] }}</span>
                <el-icon><Plus /></el-icon>
              </div>
            </div>
          </div>
        </div>
        <p class="view-count">
          已上传 <strong>{{ filledCount }}</strong> / 6 个视角
          <span v-if="processedCount > 0" class="view-processed">（已抠图 {{ processedCount }}）</span>
          <span v-if="filledCount < 2" class="view-warn">（至少需要 2 个）</span>
        </p>
      </div>

      <!-- 侧栏列表 -->
      <div class="sidebar-panel">
        <div
          v-for="face in VIEW_FACES"
          :key="face"
          class="sidebar-item"
          :class="{ filled: !!modelValue[face], active: activeFace === face }"
        >
          <div class="sidebar-info" @click="selectFace(face)">
            <span class="sidebar-label">{{ VIEW_LABELS[face] }}</span>
            <span v-if="!HY3D_SUPPORTED_FACES.includes(face)" class="sidebar-tag">暂不支持生成</span>
          </div>
          <div class="sidebar-preview" @click="selectFace(face)">
            <img v-if="displayUrl(face)" :src="displayUrl(face)" :alt="VIEW_LABELS[face]" />
            <el-icon v-else><Picture /></el-icon>
          </div>
          <div class="sidebar-actions">
            <el-button size="small" type="primary" plain @click="selectFace(face)">
              {{ modelValue[face] ? '更换' : '上传' }}
            </el-button>
            <el-button
              v-if="modelValue[face]"
              size="small"
              type="primary"
              plain
              @click="openCopyTarget(face)"
            >
              复制
            </el-button>
            <el-button
              v-if="modelValue[face]"
              size="small"
              type="danger"
              plain
              :icon="Delete"
              @click="removeFace(face)"
            />
          </div>
        </div>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept=".jpg,.jpeg,.png,.bmp"
      style="display: none"
      @change="onFileChange"
    />

    <el-dialog
      v-model="copyDialogVisible"
      title="复制到其他视角"
      width="360px"
      append-to-body
    >
      <p class="copy-dialog-hint">
        将「{{ copySourceFace ? VIEW_LABELS[copySourceFace] : '' }}」复制到：
      </p>
      <el-select v-model="copyTargetFace" placeholder="选择目标视角" style="width: 100%">
        <el-option
          v-for="face in copyTargetOptions"
          :key="face"
          :label="VIEW_LABELS[face]"
          :value="face"
        />
      </el-select>
      <template #footer>
        <el-button @click="copyDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!copyTargetFace" @click="confirmCopyFace">
          确认复制
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount, onMounted } from 'vue'
import { Plus, Picture, Delete } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  VIEW_FACES,
  VIEW_LABELS,
  HY3D_SUPPORTED_FACES,
  countViewImages,
  type ViewFace,
  type ViewImages,
} from '@/types/multiView'

const props = defineProps<{
  modelValue: ViewImages
  maxSizeMB?: number
  /** 各视角抠图后的预览 URL（由父组件传入，用于立方体/侧栏展示） */
  processedPreviewUrls?: Partial<Record<ViewFace, string>>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ViewImages]
}>()

const maxSizeMB = computed(() => props.maxSizeMB ?? 20)

const fileInputRef = ref<HTMLInputElement | null>(null)
const cubeContainerRef = ref<HTMLElement | null>(null)
const activeFace = ref<ViewFace | null>(null)
const previewUrls = ref<Partial<Record<ViewFace, string>>>({})
const copyDialogVisible = ref(false)
const copySourceFace = ref<ViewFace | null>(null)
const copyTargetFace = ref<ViewFace | ''>('')

const copyTargetOptions = computed(() => {
  if (!copySourceFace.value) return []
  return VIEW_FACES.filter((f) => f !== copySourceFace.value && !props.modelValue[f])
})

const rotateX = ref(-18)
const rotateY = ref(-28)
const dragging = ref(false)
const spaceHeld = ref(false)
const suppressFaceClick = ref(false)
const lastPointer = ref({ x: 0, y: 0 })

const filledCount = computed(() => countViewImages(props.modelValue))

const processedPreviewUrls = computed(() => props.processedPreviewUrls ?? {})

function displayUrl(face: ViewFace): string | undefined {
  return processedPreviewUrls.value[face] ?? previewUrls.value[face]
}

const processedCount = computed(() =>
  VIEW_FACES.filter((f) => processedPreviewUrls.value[f]).length
)

const cubeStyle = computed(() => ({
  transform: `rotateX(${rotateX.value}deg) rotateY(${rotateY.value}deg)`,
}))

function revokeUrl(face: ViewFace) {
  const url = previewUrls.value[face]
  if (url) {
    URL.revokeObjectURL(url)
    delete previewUrls.value[face]
  }
}

function syncPreviewUrls(views: ViewImages) {
  for (const face of VIEW_FACES) {
    const file = views[face]
    if (file && !previewUrls.value[face]) {
      previewUrls.value[face] = URL.createObjectURL(file)
    } else if (!file && previewUrls.value[face]) {
      revokeUrl(face)
    }
  }
}

watch(
  () => props.modelValue,
  (views) => syncPreviewUrls(views),
  { deep: true, immediate: true }
)

function selectFace(face: ViewFace) {
  if (suppressFaceClick.value || spaceHeld.value) {
    suppressFaceClick.value = false
    return
  }
  activeFace.value = face
  fileInputRef.value?.click()
}

function validateFile(file: File): boolean {
  const maxSize = maxSizeMB.value * 1024 * 1024
  if (file.size > maxSize) {
    ElMessage.error(`文件大小不能超过 ${maxSizeMB.value}MB`)
    return false
  }
  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  const allowed = ['.jpg', '.jpeg', '.png', '.bmp']
  if (!allowed.includes(ext)) {
    ElMessage.error('仅支持 JPG、PNG、BMP 格式')
    return false
  }
  return true
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !activeFace.value) return
  if (!validateFile(file)) return

  const face = activeFace.value
  revokeUrl(face)
  previewUrls.value[face] = URL.createObjectURL(file)

  emit('update:modelValue', {
    ...props.modelValue,
    [face]: file,
  })
  ElMessage.success(`${VIEW_LABELS[face]}已上传`)
}

function removeFace(face: ViewFace) {
  revokeUrl(face)
  const next = { ...props.modelValue }
  delete next[face]
  emit('update:modelValue', next)
  ElMessage.success(`已删除${VIEW_LABELS[face]}`)
}

function openCopyTarget(from: ViewFace) {
  if (!props.modelValue[from]) return
  const targets = VIEW_FACES.filter((f) => f !== from && !props.modelValue[f])
  if (!targets.length) {
    ElMessage.warning('没有空闲视角槽位')
    return
  }
  copySourceFace.value = from
  copyTargetFace.value = targets.find((f) => HY3D_SUPPORTED_FACES.includes(f)) ?? targets[0]
  copyDialogVisible.value = true
}

function confirmCopyFace() {
  const from = copySourceFace.value
  const to = copyTargetFace.value
  if (!from || !to) return
  const file = props.modelValue[from]
  if (!file) return

  const copy = new File([file], `${to}_${file.name}`, { type: file.type || 'image/png' })
  previewUrls.value[to] = URL.createObjectURL(copy)
  emit('update:modelValue', {
    ...props.modelValue,
    [to]: copy,
  })
  copyDialogVisible.value = false
  ElMessage.success(`已复制到${VIEW_LABELS[to]}`)
}

function onDragStart(e: MouseEvent) {
  if (!spaceHeld.value || e.button !== 0) return
  dragging.value = true
  suppressFaceClick.value = false
  lastPointer.value = { x: e.clientX, y: e.clientY }
  e.preventDefault()
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onTouchStart(e: TouchEvent) {
  if (!spaceHeld.value || e.touches.length !== 1) return
  dragging.value = true
  lastPointer.value = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!dragging.value) return
  const dx = e.clientX - lastPointer.value.x
  const dy = e.clientY - lastPointer.value.y
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    suppressFaceClick.value = true
  }
  rotateY.value += dx * 0.4
  rotateX.value -= dy * 0.4
  lastPointer.value = { x: e.clientX, y: e.clientY }
}

function onTouchMove(e: TouchEvent) {
  if (!dragging.value || e.touches.length !== 1) return
  e.preventDefault()
  const dx = e.touches[0].clientX - lastPointer.value.x
  const dy = e.touches[0].clientY - lastPointer.value.y
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    suppressFaceClick.value = true
  }
  rotateY.value += dx * 0.4
  rotateX.value -= dy * 0.4
  lastPointer.value = { x: e.touches[0].clientX, y: e.touches[0].clientY }
}

function onDragEnd() {
  dragging.value = false
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onDragEnd)
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code !== 'Space' && e.key !== ' ') return
  if (isTextInputTarget(e.target)) return
  // 按住空格时浏览器会重复触发 keydown；每次都需 preventDefault，否则页面仍会滚动
  e.preventDefault()
  if (!spaceHeld.value) {
    spaceHeld.value = true
  }
}

function onKeyUp(e: KeyboardEvent) {
  if (e.code !== 'Space' && e.key !== ' ') return
  if (isTextInputTarget(e.target)) return
  e.preventDefault()
  spaceHeld.value = false
  onDragEnd()
}

function onWindowBlur() {
  spaceHeld.value = false
  onDragEnd()
}

onMounted(() => {
  syncPreviewUrls(props.modelValue)
  window.addEventListener('keydown', onKeyDown, { capture: true })
  window.addEventListener('keyup', onKeyUp, { capture: true })
  window.addEventListener('blur', onWindowBlur)
})

onBeforeUnmount(() => {
  onDragEnd()
  window.removeEventListener('keydown', onKeyDown, { capture: true })
  window.removeEventListener('keyup', onKeyUp, { capture: true })
  window.removeEventListener('blur', onWindowBlur)
  for (const face of VIEW_FACES) {
    revokeUrl(face)
  }
})

defineExpose({
  filledCount,
  hasMinimum: () => filledCount.value >= 2,
})
</script>

<style scoped>
.multi-view-uploader {
  width: 100%;
  min-width: 0;
  container-type: inline-size;
  container-name: mv-uploader;

  --cube-size: 200px;
  --cube-face: 128px;
  --cube-depth: 64px;
}

.mv-layout {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  min-width: 0;
}

.cube-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.cube-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}

.cube-container {
  width: var(--cube-size);
  height: var(--cube-size);
  perspective: 600px;
  user-select: none;
  touch-action: none;
  flex-shrink: 0;
}

.cube-container.is-space-held {
  cursor: grab;
}

.cube-container.is-space-held.is-dragging {
  cursor: grabbing;
}

.cube {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.05s linear;
}

.cube-face {
  position: absolute;
  width: var(--cube-face);
  height: var(--cube-face);
  left: 50%;
  top: 50%;
  margin-left: calc(var(--cube-face) / -2);
  margin-top: calc(var(--cube-face) / -2);
  border: 2px solid #409eff;
  border-radius: 6px;
  background: rgba(240, 247, 255, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  backface-visibility: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.cube-face:hover,
.cube-face.active {
  border-color: #337ecc;
  box-shadow: 0 0 12px rgba(64, 158, 255, 0.45);
}

.cube-face.has-image {
  border-color: #67c23a;
}

.face-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.face-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: #409eff;
  font-size: 12px;
  padding: 8px;
  text-align: center;
}

.face-label {
  font-weight: 600;
  color: var(--text-primary);
}

.cube-face.has-processed {
  border-color: #67c23a;
  box-shadow: 0 0 8px rgba(103, 194, 58, 0.35);
}

.view-processed {
  color: #67c23a;
  margin-left: 4px;
}

.face-front  { transform: rotateY(0deg) translateZ(var(--cube-depth)); }
.face-back   { transform: rotateY(180deg) translateZ(var(--cube-depth)); }
.face-left   { transform: rotateY(-90deg) translateZ(var(--cube-depth)); }
.face-right  { transform: rotateY(90deg) translateZ(var(--cube-depth)); }
.face-top    { transform: rotateX(90deg) translateZ(var(--cube-depth)); }
.face-bottom { transform: rotateX(-90deg) translateZ(var(--cube-depth)); }

.view-count {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.view-warn {
  color: #e6a23c;
  margin-left: 4px;
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.sidebar-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  grid-template-areas:
    'info preview'
    'actions actions';
  gap: 6px 8px;
  align-items: center;
  padding: 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: #fafbfc;
  transition: border-color 0.2s, background 0.2s;
  min-width: 0;
}

.sidebar-item.filled {
  border-color: #c6e2ff;
  background: #f0f7ff;
}

.sidebar-item.active {
  border-color: #409eff;
}

.sidebar-info {
  grid-area: info;
  cursor: pointer;
  min-width: 0;
}

.sidebar-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.sidebar-tag {
  display: inline-block;
  margin-top: 2px;
  font-size: 10px;
  color: #909399;
  background: #f4f4f5;
  padding: 1px 4px;
  border-radius: 3px;
}

.sidebar-preview {
  grid-area: preview;
  width: 40px;
  height: 40px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  cursor: pointer;
  flex-shrink: 0;
  justify-self: end;
}

.sidebar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sidebar-actions {
  grid-area: actions;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
}

.sidebar-actions :deep(.el-button) {
  padding-left: 8px;
  padding-right: 8px;
}

.copy-dialog-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
}

/* 侧栏约 420px 时容器宽度不足，改为上下堆叠 */
@container mv-uploader (max-width: 540px) {
  .mv-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .multi-view-uploader {
    --cube-size: 180px;
    --cube-face: 115px;
    --cube-depth: 57.5px;
  }

  .sidebar-item {
    grid-template-columns: minmax(0, 1fr) 40px auto;
    grid-template-areas: 'info preview actions';
    gap: 8px;
  }

  .sidebar-preview {
    justify-self: center;
  }
}
</style>
