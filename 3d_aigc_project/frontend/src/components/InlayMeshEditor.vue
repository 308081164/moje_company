<template>
  <div class="inlay-mesh-editor">
    <aside class="editor-sidebar">
      <div class="sidebar-header">
        <h3>连通分量</h3>
        <el-button size="small" link @click="selectAll">全选</el-button>
        <el-button size="small" link @click="selectNone">全不选</el-button>
      </div>
      <div v-loading="loadingComponents" class="component-list">
        <el-empty v-if="!components.length && !loadingComponents" description="无分量数据" />
        <div
          v-for="comp in components"
          :key="comp.index"
          class="component-row"
          :class="{ active: selectedIndices.includes(comp.index), dimmed: !selectedIndices.includes(comp.index) }"
          @click="toggleComponent(comp.index)"
        >
          <el-checkbox
            :model-value="selectedIndices.includes(comp.index)"
            @click.stop
            @change="(v: boolean) => setComponent(comp.index, v)"
          />
          <div class="comp-meta">
            <span class="comp-title">#{{ comp.index }}</span>
            <span class="comp-sub">{{ comp.face_count }} 面 · {{ comp.vertex_count }} 顶点</span>
          </div>
        </div>
      </div>

      <div class="clip-panel">
        <h4>剖切平面</h4>
        <el-switch v-model="clipEnabled" size="small" active-text="启用预览" />
        <el-form label-width="36px" size="small">
          <el-form-item label="法向 X">
            <el-slider v-model="clipNormal[0]" :min="-1" :max="1" :step="0.05" @input="updateClipPlane" />
          </el-form-item>
          <el-form-item label="法向 Y">
            <el-slider v-model="clipNormal[1]" :min="-1" :max="1" :step="0.05" @input="updateClipPlane" />
          </el-form-item>
          <el-form-item label="法向 Z">
            <el-slider v-model="clipNormal[2]" :min="-1" :max="1" :step="0.05" @input="updateClipPlane" />
          </el-form-item>
          <el-form-item label="位置">
            <el-slider v-model="clipConstant" :min="-50" :max="50" :step="0.5" @input="updateClipPlane" />
          </el-form-item>
          <el-form-item label="保留">
            <el-radio-group v-model="clipKeepPositive" size="small">
              <el-radio-button :value="true">正侧</el-radio-button>
              <el-radio-button :value="false">负侧</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>
        <el-button size="small" :loading="clipping" @click="applyClipPreview">预览剖切</el-button>
        <el-button size="small" type="primary" :loading="clipping" @click="applyClipSave">应用剖切并保存</el-button>
      </div>
    </aside>

    <main class="editor-main">
      <div class="editor-toolbar">
        <el-button size="small" :loading="sanitizing" @click="runSanitize">预览清洗</el-button>
        <el-button size="small" :disabled="!canUndo" @click="undo">撤销</el-button>
        <el-button size="small" type="primary" :loading="cropping" :disabled="!selectedIndices.length" @click="applyCrop">
          应用裁剪
        </el-button>
        <el-button size="small" type="success" :loading="cropping" :disabled="!selectedIndices.length" @click="applyCropAndBack">
          保存到镶嵌库
        </el-button>
        <el-button size="small" type="warning" plain @click="showBooleanDialog = true">高级：布尔挖除</el-button>
      </div>
      <div ref="canvasHost" class="canvas-host">
        <div v-if="meshLoading" class="canvas-overlay">
          <el-icon class="loading-spin"><Loading /></el-icon>
          <span>加载模型...</span>
        </div>
        <div v-else-if="meshError" class="canvas-overlay error">
          <span>{{ meshError }}</span>
        </div>
      </div>
      <p class="editor-hint">点击左侧分量或 3D 包围盒切换保留；滚轮缩放，左键旋转，右键平移</p>
    </main>

    <el-dialog v-model="showBooleanDialog" title="高级：布尔挖除" width="480px">
      <el-alert type="warning" show-icon :closable="false" title="布尔运算可能失败，建议优先使用分量裁剪" />
      <el-upload
        :auto-upload="false"
        :limit="1"
        accept=".obj,.glb,.stl"
        :on-change="(f: UploadFile) => (booleanSubtractFile = f.raw || null)"
        :on-remove="() => (booleanSubtractFile = null)"
      >
        <el-button plain>选择减除网格 OBJ/GLB/STL</el-button>
      </el-upload>
      <template #footer>
        <el-button @click="showBooleanDialog = false">取消</el-button>
        <el-button type="primary" :loading="booleanRunning" :disabled="!booleanSubtractFile" @click="runBooleanSave">
          执行并保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import {
  sanitizeInlayMesh,
  splitInlayMeshComponents,
  cropInlayMesh,
  clipInlayMesh,
  type MeshComponentInfo,
} from '@/api'

const props = defineProps<{
  inlayId: string
  displayName?: string
  /** 嵌入镶嵌库裁剪模式时，返回由父组件处理 */
  embedded?: boolean
}>()

const emit = defineEmits<{
  saved: []
  back: []
}>()

const router = useRouter()

const canvasHost = ref<HTMLDivElement | null>(null)
const components = ref<MeshComponentInfo[]>([])
const selectedIndices = ref<number[]>([])
const loadingComponents = ref(false)
const sanitizing = ref(false)
const cropping = ref(false)
const clipping = ref(false)
const meshLoading = ref(true)
const meshError = ref('')
const clipEnabled = ref(false)
const clipNormal = ref([0, 1, 0])
const clipConstant = ref(0)
const clipKeepPositive = ref(true)
const showBooleanDialog = ref(false)
const booleanSubtractFile = ref<File | null>(null)
const booleanRunning = ref(false)

interface UndoState {
  selected: number[]
}
const undoStack = ref<UndoState[]>([])
const canUndo = computed(() => undoStack.value.length > 0)

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animationId: number | null = null
let currentModel: THREE.Object3D | null = null
let bboxHelpers: THREE.Mesh[] = []
let clipPlane: THREE.Plane | null = null
let raycaster: THREE.Raycaster | null = null
let pointer: THREE.Vector2 | null = null

const meshUrl = computed(() => `/api/inlay/v2/items/${props.inlayId}/mesh/glb`)

function pushUndo() {
  undoStack.value.push({ selected: [...selectedIndices.value] })
  if (undoStack.value.length > 20) undoStack.value.shift()
}

function undo() {
  const prev = undoStack.value.pop()
  if (prev) selectedIndices.value = prev.selected
}

function toggleComponent(index: number) {
  pushUndo()
  if (selectedIndices.value.includes(index)) {
    selectedIndices.value = selectedIndices.value.filter((i) => i !== index)
  } else {
    selectedIndices.value = [...selectedIndices.value, index].sort((a, b) => a - b)
  }
}

function setComponent(index: number, keep: boolean) {
  pushUndo()
  if (keep && !selectedIndices.value.includes(index)) {
    selectedIndices.value = [...selectedIndices.value, index].sort((a, b) => a - b)
  } else if (!keep) {
    selectedIndices.value = selectedIndices.value.filter((i) => i !== index)
  }
}

function selectAll() {
  pushUndo()
  selectedIndices.value = components.value.map((c) => c.index)
}

function selectNone() {
  pushUndo()
  selectedIndices.value = []
}

async function loadComponents() {
  loadingComponents.value = true
  try {
    const res = await splitInlayMeshComponents(props.inlayId)
    components.value = res.data?.components || []
    selectedIndices.value = components.value.map((c) => c.index)
    rebuildBboxHelpers()
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '分量拆分失败')
  } finally {
    loadingComponents.value = false
  }
}

async function runSanitize() {
  sanitizing.value = true
  try {
    await sanitizeInlayMesh(props.inlayId, true)
    ElMessage.success('网格清洗完成')
    await loadComponents()
    await reloadModel()
    emit('saved')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '清洗失败')
  } finally {
    sanitizing.value = false
  }
}

async function applyCrop() {
  if (!selectedIndices.value.length) return
  cropping.value = true
  try {
    await cropInlayMesh(props.inlayId, selectedIndices.value, 'glb')
    ElMessage.success('裁剪已应用')
    await loadComponents()
    await reloadModel()
    emit('saved')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '裁剪失败')
  } finally {
    cropping.value = false
  }
}

async function applyCropAndBack() {
  await applyCrop()
  if (props.embedded) {
    emit('back')
  } else {
    router.push({ name: 'inlay-library', query: { mode: 'browse' } })
  }
}

async function applyClipPreview() {
  clipping.value = true
  try {
    await clipInlayMesh(
      props.inlayId,
      [0, clipConstant.value, 0],
      clipNormal.value,
      clipKeepPositive.value,
      false,
      'glb'
    )
    ElMessage.success('剖切预览完成（未保存）')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '剖切失败')
  } finally {
    clipping.value = false
  }
}

async function applyClipSave() {
  clipping.value = true
  try {
    await clipInlayMesh(
      props.inlayId,
      [0, clipConstant.value, 0],
      clipNormal.value,
      clipKeepPositive.value,
      true,
      'glb'
    )
    ElMessage.success('剖切已保存')
    await loadComponents()
    await reloadModel()
    emit('saved')
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : '剖切保存失败')
  } finally {
    clipping.value = false
  }
}

async function runBooleanSave() {
  if (!booleanSubtractFile.value) return
  booleanRunning.value = true
  try {
    ElMessage.warning('布尔挖除需后端减除网格路径，请优先使用分量裁剪')
    showBooleanDialog.value = false
  } finally {
    booleanRunning.value = false
  }
}

function rebuildBboxHelpers() {
  if (!scene) return
  bboxHelpers.forEach((h) => scene!.remove(h))
  bboxHelpers = []
  for (const comp of components.value) {
    const min = new THREE.Vector3(...comp.bbox_min)
    const max = new THREE.Vector3(...comp.bbox_max)
    const size = new THREE.Vector3().subVectors(max, min)
    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5)
    const geo = new THREE.BoxGeometry(size.x || 0.01, size.y || 0.01, size.z || 0.01)
    const mat = new THREE.MeshBasicMaterial({
      color: selectedIndices.value.includes(comp.index) ? 0x67c23a : 0xf56c6c,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(center)
    mesh.userData.componentIndex = comp.index
    scene.add(mesh)
    bboxHelpers.push(mesh)
  }
}

watch(selectedIndices, () => {
  bboxHelpers.forEach((h) => {
    const idx = h.userData.componentIndex as number
    const mat = h.material as THREE.MeshBasicMaterial
    mat.color.setHex(selectedIndices.value.includes(idx) ? 0x67c23a : 0xf56c6c)
  })
})

function updateClipPlane() {
  if (!renderer || !clipPlane) return
  const n = new THREE.Vector3(...clipNormal.value).normalize()
  clipPlane.normal.copy(n)
  clipPlane.constant = -clipConstant.value
  renderer.clippingPlanes = clipEnabled.value ? [clipPlane] : []
}

watch([clipEnabled, clipNormal, clipConstant], updateClipPlane)

function initThree() {
  if (!canvasHost.value) return
  const w = canvasHost.value.clientWidth || 640
  const h = canvasHost.value.clientHeight || 480

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#2a2a3e')

  camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 5000)
  camera.position.set(2, 2, 2)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.localClippingEnabled = true
  canvasHost.value.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  scene.add(new THREE.AmbientLight(0xffffff, 0.16))
  scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x282830, 0.38))
  const key = new THREE.DirectionalLight(0xffffff, 1.15)
  key.position.set(4, 6, 5)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xe8eeff, 0.44)
  fill.position.set(-5, 2, -4)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xffffff, 0.5)
  rim.position.set(-2, 5, -8)
  scene.add(rim)

  clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  renderer.domElement.addEventListener('pointerdown', onCanvasClick)
  window.addEventListener('resize', onResize)

  const animate = () => {
    animationId = requestAnimationFrame(animate)
    controls?.update()
    renderer?.render(scene!, camera!)
  }
  animate()
}

function onResize() {
  if (!canvasHost.value || !camera || !renderer) return
  const w = canvasHost.value.clientWidth
  const h = canvasHost.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

function onCanvasClick(event: PointerEvent) {
  if (!raycaster || !pointer || !camera || !renderer) return
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(bboxHelpers, false)
  if (hits.length > 0) {
    const idx = hits[0].object.userData.componentIndex as number
    toggleComponent(idx)
  }
}

function applyEditorPreviewMaterials(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.material = new THREE.MeshStandardMaterial({
      color: 0xd8d8dc,
      metalness: 0.42,
      roughness: 0.38,
      side: THREE.DoubleSide,
    })
  })
}

async function loadModel(url: string) {
  if (!scene) return
  if (currentModel) {
    scene.remove(currentModel)
    currentModel = null
  }
  meshLoading.value = true
  meshError.value = ''
  try {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
    if (ext === 'obj') {
      const loader = new OBJLoader()
      currentModel = await loader.loadAsync(url)
    } else if (ext === 'stl') {
      const loader = new STLLoader()
      const geo = await loader.loadAsync(url)
      const mat = new THREE.MeshStandardMaterial({
        color: 0xd8d8dc,
        metalness: 0.42,
        roughness: 0.38,
        side: THREE.DoubleSide,
      })
      currentModel = new THREE.Mesh(geo, mat)
    } else {
      const loader = new GLTFLoader()
      const gltf = await loader.loadAsync(url)
      currentModel = gltf.scene
    }
    if (currentModel) {
      applyEditorPreviewMaterials(currentModel)
      scene.add(currentModel)
      fitCameraToObject(currentModel)
    }
  } catch {
    meshError.value = '模型加载失败，可尝试刷新'
  } finally {
    meshLoading.value = false
  }
}

function fitCameraToObject(obj: THREE.Object3D) {
  if (!camera || !controls) return
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 0.01)
  const dist = maxDim * 2.2
  camera.position.set(center.x + dist, center.y + dist * 0.6, center.z + dist)
  controls.target.copy(center)
  controls.update()
}

async function reloadModel() {
  const cacheBust = `?t=${Date.now()}`
  await loadModel(meshUrl.value + cacheBust)
  rebuildBboxHelpers()
}

onMounted(async () => {
  initThree()
  await loadModel(meshUrl.value)
  await loadComponents()
})

onBeforeUnmount(() => {
  if (animationId) cancelAnimationFrame(animationId)
  renderer?.domElement.removeEventListener('pointerdown', onCanvasClick)
  window.removeEventListener('resize', onResize)
  renderer?.dispose()
})
</script>

<style scoped>
.inlay-mesh-editor {
  display: flex;
  height: calc(100vh - 120px);
  min-height: 520px;
  gap: 12px;
}

.editor-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.sidebar-header h3 {
  margin: 0;
  flex: 1;
  font-size: 14px;
}

.component-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.component-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.component-row:hover,
.component-row.active {
  background: var(--el-fill-color-light);
}

.component-row.dimmed {
  opacity: 0.65;
}

.comp-meta {
  display: flex;
  flex-direction: column;
}

.comp-title {
  font-weight: 600;
  font-size: 13px;
}

.comp-sub {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.clip-panel {
  border-top: 1px solid var(--el-border-color-lighter);
  padding: 10px 12px;
}

.clip-panel h4 {
  margin: 0 0 8px;
  font-size: 13px;
}

.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 8px;
}

.canvas-host {
  flex: 1;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  background: #2a2a3e;
  min-height: 360px;
}

.canvas-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  z-index: 2;
}

.canvas-overlay.error {
  color: #f56c6c;
}

.editor-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
