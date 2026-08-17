<template>
  <div class="model-viewer" ref="containerRef">
    <!-- 加载状态 -->
    <div v-if="loading" class="viewer-loading">
      <el-icon class="loading-icon loading-spin"><Loading /></el-icon>
      <p>正在加载3D模型...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="viewer-error">
      <el-icon :size="48" color="#f56c6c"><WarningFilled /></el-icon>
      <p>{{ error }}</p>
      <el-button type="primary" size="small" @click="$emit('retry')">
        重新加载
      </el-button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!modelUrl" class="viewer-empty">
      <el-icon :size="48" color="#c0c4cc"><View /></el-icon>
      <p>暂无3D模型预览</p>
    </div>

    <!-- Three.js 渲染容器 -->
    <canvas ref="canvasRef" class="viewer-canvas" v-show="!loading && !error && modelUrl" />

    <!-- 视图工具栏 -->
    <div v-if="modelUrl && !loading && !error" class="viewer-toolbar">
      <slot name="toolbar-extra" />
      <el-button size="small" :icon="FullScreen" @click="resetView">
        适应视图
      </el-button>
    </div>

    <!-- 控制提示 -->
    <div v-if="modelUrl && !loading && !error" class="viewer-controls-hint">
      <span>鼠标左键旋转 | 滚轮缩放 | 右键平移</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Loading, WarningFilled, View, FullScreen } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { sniffMeshFormatFromBuffer } from '@/utils/meshFormat'

// ==========================================
// Props & Emits
// ==========================================

interface Props {
  /** 模型文件URL */
  modelUrl?: string
  /** 模型文件格式 */
  modelFormat?: 'GLB' | 'OBJ' | 'STL' | 'glb' | 'obj' | 'stl'
  /** 背景颜色 */
  backgroundColor?: string
  /** 预览模式：colored=分色（镶嵌/生成），white=统一白模 */
  previewMode?: 'white' | 'colored'
  /** 是否启用剖切平面预览 */
  clippingEnabled?: boolean
  /** 剖切平面法向 */
  clipPlaneNormal?: [number, number, number]
  /** 剖切平面 constant（Three.js Plane.constant） */
  clipPlaneConstant?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelUrl: '',
  modelFormat: 'GLB',
  backgroundColor: '#1a1a2e',
  previewMode: 'colored',
  clippingEnabled: false,
  clipPlaneNormal: () => [0, 1, 0],
  clipPlaneConstant: 0,
})

const emit = defineEmits<{
  'loaded': []
  'error': [error: string]
  'retry': []
}>()

// ==========================================
// 状态
// ==========================================

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const loading = ref(false)
const error = ref<string>('')

// Three.js 相关变量
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animationId: number | null = null
let currentModel: THREE.Group | null = null
let resizeObserver: ResizeObserver | null = null
let gridHelper: THREE.GridHelper | null = null
let clipPlane: THREE.Plane | null = null
let pmremGenerator: THREE.PMREMGenerator | null = null
let sceneEnvironment: THREE.Texture | null = null
let environmentReady = false
const EDGE_OVERLAY_NAME = 'preview-edge-overlay'

/** 同源 GLB 二进制缓存，避免白模/分色切换或重挂载时重复下载 */
const glbBufferCache = new Map<string, ArrayBuffer>()
const GLB_FETCH_MAX_RETRIES = 3
const GLB_FETCH_RETRY_BASE_MS = 700
const MESH_FETCH_TIMEOUT_MS = 120_000

const CAMERA_FOV = 50
/** 初始适配时在包围球距离上额外留白，避免巨型模型贴边 */
const FIT_PADDING = 1.55
/** 允许相对 fitDistance 再拉远的最大倍数 */
const MAX_ZOOM_OUT_FACTOR = 40

// ==========================================
// Three.js 初始化
// ==========================================

/** 初始化Three.js场景 */
function initScene() {
  if (!containerRef.value || !canvasRef.value) return

  const container = containerRef.value
  const width = container.clientWidth
  const height = container.clientHeight

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(props.backgroundColor)

  setupPreviewLighting(scene)

  // 创建相机（far/maxDistance 在 fitCameraToModel 中按模型尺寸动态设置）
  camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, 0.001, 1e7)
  camera.position.set(0, 1, 3)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true,
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.18
  renderer.localClippingEnabled = true

  // 白模 PBR 环境光延迟初始化（分色 BasicMaterial 不需要，可显著加快首屏）
  clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  applyClippingPlanes()

  // 创建轨道控制器
  controls = new OrbitControls(camera, renderer!.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enableZoom = true
  controls.enablePan = true
  controls.minDistance = 0.001
  controls.maxDistance = 1e7

  // 地面网格：尺寸随模型适应，提高对比度便于观察比例
  gridHelper = new THREE.GridHelper(1, 10, 0x666666, 0x4a4a4a)
  gridHelper.visible = false
  scene!.add(gridHelper)

  // 启动动画循环
  animate()
}

/** 动画循环 */
function animate() {
  animationId = requestAnimationFrame(animate)
  controls?.update()
  renderer?.render(scene!, camera!)
}

/** 调整尺寸并在全屏/布局变化后重新适配模型 */
function onResize() {
  if (!containerRef.value || !camera || !renderer) return
  const width = Math.max(containerRef.value.clientWidth, 1)
  const height = Math.max(containerRef.value.clientHeight, 1)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
  if (currentModel) {
    fitCameraToModel(currentModel)
  }
}

interface ModelBounds {
  center: THREE.Vector3
  size: THREE.Vector3
  radius: number
  maxDim: number
}

/** 计算模型世界空间包围盒与包围球（比 maxDim/2 更准确） */
function computeModelBounds(model: THREE.Object3D): ModelBounds | null {
  const box = new THREE.Box3().setFromObject(model)
  if (box.isEmpty()) return null

  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  const maxDim = Math.max(size.x, size.y, size.z, 1e-6)
  const radius = Math.max(sphere.radius, maxDim * 0.5, 1e-6)

  return { center, size, radius, maxDim }
}

/** 根据 FOV、视口宽高比与包围球半径计算完整可见所需的相机距离 */
function computeFitDistance(radius: number, fovDeg: number, aspect: number): number {
  const vFov = THREE.MathUtils.degToRad(fovDeg)
  const hFov = 2 * Math.atan(Math.tan(vFov * 0.5) * aspect)
  const distanceV = radius / Math.sin(vFov * 0.5)
  const distanceH = radius / Math.sin(hFov * 0.5)
  return Math.max(distanceV, distanceH) * FIT_PADDING
}

function fitCameraToModel(model: THREE.Object3D) {
  if (!camera || !controls) return

  const bounds = computeModelBounds(model)
  if (!bounds) return

  const { center, radius, maxDim } = bounds

  const container = containerRef.value
  const aspect = container && container.clientHeight > 0
    ? container.clientWidth / container.clientHeight
    : camera.aspect

  const fitDistance = computeFitDistance(radius, camera.fov, aspect)

  // 动态裁剪面：兼顾巨型 bbox 与深度精度
  const far = Math.max(fitDistance * 120, radius * 250, maxDim * 120, 5000)
  const near = Math.max(
    Math.min(fitDistance / 3000, radius / 800, maxDim / 8000),
    0.0001
  )
  camera.near = near
  camera.far = far
  camera.updateProjectionMatrix()

  const direction = new THREE.Vector3(1, 0.75, 1).normalize()
  camera.position.copy(center).add(direction.multiplyScalar(fitDistance))
  camera.lookAt(center)
  controls.target.copy(center)
  controls.minDistance = Math.max(radius * 0.02, fitDistance * 0.02, 0.0001)
  controls.maxDistance = Math.max(
    fitDistance * MAX_ZOOM_OUT_FACTOR,
    radius * 100,
    maxDim * 80,
    10000
  )
  controls.update()

  // 将辅助网格铺在模型下方，尺寸匹配模型（不再出现旁侧小灰格）
  if (gridHelper && scene) {
    scene.remove(gridHelper)
    gridHelper.geometry.dispose()
    const mats = gridHelper.material
    if (Array.isArray(mats)) mats.forEach((m) => m.dispose())
    else mats.dispose()
    const gridSize = Math.max(maxDim * 2.2, radius * 2.5, 1)
    gridHelper = new THREE.GridHelper(gridSize, 20, 0x666666, 0x4a4a4a)
    gridHelper.position.set(
      center.x,
      center.y - bounds.size.y * 0.5,
      center.z,
    )
    gridHelper.visible = true
    scene.add(gridHelper)
  }
}

/** 重置相机到完整包围盒视图（全屏切换后也可手动触发） */
function resetView() {
  if (currentModel) {
    fitCameraToModel(currentModel)
    renderer?.render(scene!, camera!)
  }
}

const DEFAULT_PREVIEW_WIDTH = 1920

function parseAspectRatio(ratio?: string): number {
  if (!ratio) return 16 / 9
  const parts = ratio.split(':').map((part) => Number(part.trim()))
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    return parts[0] / parts[1]
  }
  return 16 / 9
}

/** 截取当前渲染帧为 PNG（原始画布比例） */
function captureScreenshot(): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!renderer || !scene || !camera || loading.value || error.value) {
      resolve(null)
      return
    }
    controls?.update()
    renderer.render(scene, camera)
    renderer.domElement.toBlob((blob) => resolve(blob), 'image/png')
  })
}

/**
 * 截取当前 3D 视图并导出为指定宽高比的 PNG（默认 16:9 @ 1920×1080）。
 * 保持当前相机角度，对画布做居中裁剪后缩放。
 */
function capturePreviewPng(
  aspectRatio = '16:9',
  outputWidth = DEFAULT_PREVIEW_WIDTH,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!renderer || !scene || !camera || loading.value || error.value) {
      resolve(null)
      return
    }
    controls?.update()
    renderer.render(scene, camera)

    const sourceCanvas = renderer.domElement
    const srcW = sourceCanvas.width
    const srcH = sourceCanvas.height
    if (srcW === 0 || srcH === 0) {
      resolve(null)
      return
    }

    const targetAspect = parseAspectRatio(aspectRatio)
    const outputHeight = Math.round(outputWidth / targetAspect)
    const srcAspect = srcW / srcH

    let cropW = srcW
    let cropH = srcH
    if (srcAspect > targetAspect) {
      cropW = Math.round(srcH * targetAspect)
    } else if (srcAspect < targetAspect) {
      cropH = Math.round(srcW / targetAspect)
    }

    const sx = Math.round((srcW - cropW) / 2)
    const sy = Math.round((srcH - cropH) / 2)

    const offscreen = document.createElement('canvas')
    offscreen.width = outputWidth
    offscreen.height = outputHeight
    const ctx = offscreen.getContext('2d')
    if (!ctx) {
      resolve(null)
      return
    }

    ctx.drawImage(sourceCanvas, sx, sy, cropW, cropH, 0, 0, outputWidth, outputHeight)
    offscreen.toBlob((blob) => resolve(blob), 'image/png')
  })
}

defineExpose({ resetView, captureScreenshot, capturePreviewPng })

/** 与 ai-service INLAY_REGION_COLOR / GENERATED_REGION_COLOR 对齐 */
const INLAY_PREVIEW_COLOR = 0xe6a23c
const GENERATED_PREVIEW_COLOR = 0x409eff
const WHITE_PREVIEW_COLOR = 0xd8d8dc
const EDGE_LINE_COLOR = 0x505058
const EDGE_THRESHOLD_ANGLE = 12

function collectObjectNameHints(obj: THREE.Object3D): string {
  const parts: string[] = []
  let cur: THREE.Object3D | null = obj
  while (cur) {
    if (cur.name) parts.push(cur.name)
    cur = cur.parent
  }
  const mat = (obj as THREE.Mesh).material
  if (mat) {
    const mats = Array.isArray(mat) ? mat : [mat]
    for (const m of mats) {
      if (m?.name) parts.push(m.name)
    }
  }
  return parts.join(' ').toLowerCase()
}

/** 精确匹配 GLB 节点名（export_colored_dual_mesh 导出） */
function resolveMeshRegionColor(mesh: THREE.Mesh): number | null {
  const preset = mesh.userData.previewRegionColor as number | undefined
  if (preset != null) return preset
  let node: THREE.Object3D | null = mesh
  while (node) {
    const name = node.name
    if (name === 'inlay_structure') return INLAY_PREVIEW_COLOR
    if (name === 'ai_generated') return GENERATED_PREVIEW_COLOR
    node = node.parent
  }
  const hint = collectObjectNameHints(mesh)
  if (hint.includes('inlay_structure') || hint.includes('镶嵌')) {
    return INLAY_PREVIEW_COLOR
  }
  if (hint.includes('ai_generated') || hint.includes('ai主体')) {
    return GENERATED_PREVIEW_COLOR
  }
  return null
}

function resolveRegionColor(obj: THREE.Object3D): number | null {
  if (obj instanceof THREE.Mesh) {
    return resolveMeshRegionColor(obj)
  }
  return null
}

/** 收集场景中未识别分区的 mesh（用于双网格兜底上色） */
function collectUnassignedMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = []
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && resolveRegionColor(child) == null) {
      meshes.push(child)
    }
  })
  return meshes
}

function assignDualMeshFallbackColors(root: THREE.Object3D) {
  const unassigned = collectUnassignedMeshes(root)
  if (unassigned.length === 2) {
    unassigned[0].userData.previewRegionColor = INLAY_PREVIEW_COLOR
    unassigned[1].userData.previewRegionColor = GENERATED_PREVIEW_COLOR
    return
  }
  // Scene dual-root: meshes whose parent is root
  const topMeshes: THREE.Mesh[] = []
  root.traverse((child) => {
    if (child instanceof THREE.Mesh && child.parent === root) {
      topMeshes.push(child)
    }
  })
  if (topMeshes.length === 2) {
    topMeshes[0].userData.previewRegionColor = INLAY_PREVIEW_COLOR
    topMeshes[1].userData.previewRegionColor = GENERATED_PREVIEW_COLOR
    return
  }
  // GLTF often wraps meshes one level deeper
  const nestedMeshes: THREE.Mesh[] = []
  for (const child of root.children) {
    for (const grand of child.children) {
      if (grand instanceof THREE.Mesh) nestedMeshes.push(grand)
    }
  }
  if (nestedMeshes.length === 2) {
    nestedMeshes[0].userData.previewRegionColor = INLAY_PREVIEW_COLOR
    nestedMeshes[1].userData.previewRegionColor = GENERATED_PREVIEW_COLOR
    return
  }
  // Collect all meshes if exactly 2 in scene
  const allMeshes: THREE.Mesh[] = []
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) allMeshes.push(child)
  })
  if (allMeshes.length === 2) {
    allMeshes[0].userData.previewRegionColor = INLAY_PREVIEW_COLOR
    allMeshes[1].userData.previewRegionColor = GENERATED_PREVIEW_COLOR
  }
}

/** 预览三点布光：主光 45° 仰角 / 30° 方位，辅光 + 轮廓光，低环境光 + 半球光 */
function setupPreviewLighting(target: THREE.Scene) {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.16)
  target.add(ambientLight)

  const hemiLight = new THREE.HemisphereLight(0xe8f0ff, 0x282830, 0.38)
  target.add(hemiLight)

  const lightDist = 12
  const keyElev = THREE.MathUtils.degToRad(45)
  const keyAzim = THREE.MathUtils.degToRad(30)
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.15)
  keyLight.position.set(
    lightDist * Math.cos(keyElev) * Math.sin(keyAzim),
    lightDist * Math.sin(keyElev),
    lightDist * Math.cos(keyElev) * Math.cos(keyAzim),
  )
  target.add(keyLight)

  const fillElev = THREE.MathUtils.degToRad(22)
  const fillAzim = THREE.MathUtils.degToRad(210)
  const fillLight = new THREE.DirectionalLight(0xe8eeff, 0.44)
  fillLight.position.set(
    lightDist * 0.85 * Math.cos(fillElev) * Math.sin(fillAzim),
    lightDist * 0.85 * Math.sin(fillElev),
    lightDist * 0.85 * Math.cos(fillElev) * Math.cos(fillAzim),
  )
  target.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xffffff, 0.5)
  rimLight.position.set(-2.5, 5, -10)
  target.add(rimLight)
}

function tagColoredRegionMeshes(root: THREE.Object3D) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    let node: THREE.Object3D | null = child
    while (node) {
      const name = node.name.toLowerCase()
      if (name.includes('inlay_structure') || name === 'inlay_structure') {
        child.userData.previewRegionColor = INLAY_PREVIEW_COLOR
        return
      }
      if (name.includes('ai_generated') || name === 'ai_generated') {
        child.userData.previewRegionColor = GENERATED_PREVIEW_COLOR
        return
      }
      node = node.parent
    }
  })
}

function ensureSceneEnvironment() {
  if (!renderer || !scene || environmentReady) return
  pmremGenerator = new THREE.PMREMGenerator(renderer)
  pmremGenerator.compileEquirectangularShader()
  sceneEnvironment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = sceneEnvironment
  environmentReady = true
}

function releaseSceneEnvironment() {
  if (sceneEnvironment) {
    sceneEnvironment.dispose()
    sceneEnvironment = null
  }
  pmremGenerator?.dispose()
  pmremGenerator = null
  environmentReady = false
  if (scene) scene.environment = null
}

function applyRendererToneForMode(mode: 'white' | 'colored') {
  if (!renderer) return
  if (mode === 'colored') {
    // 分色预览：无 tone mapping，避免琥珀/蓝被压成黑影
    renderer.toneMapping = THREE.NoToneMapping
    renderer.toneMappingExposure = 1.0
  } else {
    ensureSceneEnvironment()
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
  }
}

function makePreviewMaterial(opts: {
  color?: number
  vertexColors?: boolean
  colored?: boolean
}): THREE.Material {
  const baseColor = opts.color ?? 0xffffff
  if (opts.colored) {
    // 分色预览用 BasicMaterial：不依赖灯光，COLOR_0 / 区域色 100% 可见
    return new THREE.MeshBasicMaterial({
      color: baseColor,
      vertexColors: Boolean(opts.vertexColors),
      side: THREE.DoubleSide,
      toneMapped: false,
    })
  }
  return new THREE.MeshStandardMaterial({
    color: baseColor,
    vertexColors: Boolean(opts.vertexColors),
    metalness: opts.vertexColors ? 0.28 : 0.42,
    roughness: opts.vertexColors ? 0.45 : 0.38,
    envMapIntensity: 0.55,
    side: THREE.DoubleSide,
  })
}

function removeEdgeOverlays(root: THREE.Object3D) {
  const toRemove: THREE.Object3D[] = []
  root.traverse((child) => {
    const overlay = child.getObjectByName(EDGE_OVERLAY_NAME)
    if (overlay) toRemove.push(overlay)
  })
  for (const overlay of toRemove) {
    overlay.parent?.remove(overlay)
    if (overlay instanceof THREE.LineSegments) {
      overlay.geometry.dispose()
      const mat = overlay.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  }
}

/** 白模模式：叠加细边线，强化镶嵌结构细节 */
function applyEdgeOverlays(root: THREE.Object3D) {
  removeEdgeOverlays(root)
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.geometry) return
    const edges = new THREE.EdgesGeometry(child.geometry, EDGE_THRESHOLD_ANGLE)
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: EDGE_LINE_COLOR,
        transparent: true,
        opacity: 0.38,
        depthTest: true,
        depthWrite: false,
      }),
    )
    line.name = EDGE_OVERLAY_NAME
    line.renderOrder = 2
    child.add(line)
  })
}

/** 根据预览模式设置材质（白模 / 分色） */
function applyPreviewMaterials(root: THREE.Object3D, mode: 'white' | 'colored') {
  if (mode === 'colored') {
    tagColoredRegionMeshes(root)
    assignDualMeshFallbackColors(root)
  }

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const geometry = child.geometry
    if (!geometry) return

    if (mode === 'white') {
      child.renderOrder = 0
      child.material = makePreviewMaterial({ color: WHITE_PREVIEW_COLOR })
      return
    }

    const regionColor = resolveMeshRegionColor(child)
    const colorAttr = geometry.getAttribute('color')
    const isInlay = regionColor === INLAY_PREVIEW_COLOR

    if (colorAttr && colorAttr.count > 0) {
      colorAttr.needsUpdate = true
      child.material = makePreviewMaterial({ vertexColors: true, colored: true })
    } else if (regionColor != null) {
      child.material = makePreviewMaterial({ color: regionColor, colored: true })
    } else {
      // 无分区标签的单 mesh：用 Standard 响应布光，避免 Basic 白片
      child.material = makePreviewMaterial({ color: WHITE_PREVIEW_COLOR })
    }

    child.renderOrder = isInlay ? 0 : 1
    const mat = child.material
    if (mat instanceof THREE.MeshBasicMaterial) {
      mat.polygonOffset = true
      mat.polygonOffsetFactor = isInlay ? 1 : -1
      mat.polygonOffsetUnits = 2
      // 预览：AI 主体不要被镶嵌实心网格的深度遮挡（整圈镶嵌时常见）
      if (!isInlay && regionColor === GENERATED_PREVIEW_COLOR) {
        mat.depthTest = false
        child.renderOrder = 2
      }
    }
  })

  if (mode === 'white') {
    applyEdgeOverlays(root)
  } else {
    removeEdgeOverlays(root)
  }
}

/** 清理场景中的模型 */
function clearModel() {
  if (currentModel && scene) {
    removeEdgeOverlays(currentModel)
    scene.remove(currentModel)
    // 释放几何体和材质
    currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
    currentModel = null
  }
}

/** 加载3D模型 */
async function loadModel(url: string, format: string) {
  if (!scene) return

  loading.value = true
  error.value = ''
  clearModel()

  try {
    let model: THREE.Group

    const normalizedFormat = format.toUpperCase()
    let effectiveFormat = normalizedFormat

    if (normalizedFormat === 'GLB') {
      model = await loadGLB(url)
    } else {
      const buffer = await fetchMeshBuffer(url)
      const sniffed = sniffMeshFormatFromBuffer(buffer)
      if (sniffed && sniffed !== normalizedFormat) {
        console.warn(
          `模型格式声明为 ${normalizedFormat}，实际内容为 ${sniffed}，已自动纠正`,
        )
        effectiveFormat = sniffed
      }
      if (effectiveFormat === 'OBJ') {
        model = await parseOBJBuffer(buffer)
      } else if (effectiveFormat === 'STL') {
        model = await parseSTLBuffer(buffer)
      } else if (normalizedFormat === 'OBJ') {
        model = await parseOBJBuffer(buffer)
      } else if (normalizedFormat === 'STL') {
        model = await parseSTLBuffer(buffer)
      } else {
        throw new Error(`不支持的模型格式: ${format}`)
      }
    }

    // 计算模型边界并居中
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    // 将模型居中
    model.position.sub(center)

    if (props.previewMode === 'colored') {
      tagColoredRegionMeshes(model)
    }
    applyRendererToneForMode(props.previewMode)
    applyPreviewMaterials(model, props.previewMode)
    // Force material/COLOR_0 update after GLB load
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const colorAttr = child.geometry?.getAttribute?.('color')
      if (colorAttr) colorAttr.needsUpdate = true
      const mats = child.material
        ? Array.isArray(child.material)
          ? child.material
          : [child.material]
        : []
      for (const m of mats) {
        if (m) m.needsUpdate = true
      }
    })
    fitCameraToModel(model)

    scene.add(model)
    currentModel = model

    emit('loaded')
  } catch (err: any) {
    error.value = err.message || '模型加载失败'
    emit('error', error.value)
  } finally {
    loading.value = false
  }
}

/** 加载GLB模型（先校验二进制头，避免把 JSON/文本当 GLB 解析；支持短重试） */
async function fetchGlbBuffer(url: string): Promise<ArrayBuffer> {
  const cached = glbBufferCache.get(url)
  if (cached) return cached

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= GLB_FETCH_MAX_RETRIES; attempt++) {
    try {
      const resp = await fetch(url, { credentials: 'include' })
      const contentType = resp.headers.get('content-type') || ''
      if (!resp.ok) {
        const retryable = resp.status === 404 || resp.status === 503 || resp.status >= 500
        throw new Error(
          retryable
            ? `分色预览尚未就绪 (HTTP ${resp.status})`
            : `预览请求失败 HTTP ${resp.status}`,
        )
      }
      const buffer = await resp.arrayBuffer()
      if (contentType.includes('application/json') || buffer.byteLength < 12) {
        const peek = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(120, buffer.byteLength)))
        if (peek.trimStart().startsWith('{') && peek.includes('"code"')) {
          throw new Error('分色预览 GLB 不存在，请重新生成或切换白模预览')
        }
        throw new Error('分色预览尚未就绪，请稍后重试')
      }
      validateGlbBuffer(buffer)
      glbBufferCache.set(url, buffer)
      return buffer
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt < GLB_FETCH_MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, GLB_FETCH_RETRY_BASE_MS * (attempt + 1)),
        )
      }
    }
  }
  throw lastError ?? new Error('GLB 下载失败')
}

/** 下载 OBJ/STL（带超时；避免 URL 直载挂死） */
async function fetchMeshBuffer(url: string): Promise<ArrayBuffer> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), MESH_FETCH_TIMEOUT_MS)
  try {
    const resp = await fetch(url, { credentials: 'include', signal: controller.signal })
    if (!resp.ok) {
      throw new Error(`模型下载失败 HTTP ${resp.status}`)
    }
    const buffer = await resp.arrayBuffer()
    if (buffer.byteLength < 12) {
      throw new Error('模型文件过小或为空')
    }
    const peek = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(120, buffer.byteLength)))
    if (peek.trimStart().startsWith('{') && peek.includes('"code"')) {
      throw new Error('下载接口返回了错误 JSON，模型可能不存在')
    }
    return buffer
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('模型下载超时，请稍后重试或先下载到本地查看')
    }
    throw err instanceof Error ? err : new Error(String(err))
  } finally {
    window.clearTimeout(timer)
  }
}

function validateGlbBuffer(buffer: ArrayBuffer) {
  if (buffer.byteLength < 12) {
    throw new Error('预览文件过小，不是有效 GLB')
  }
  const header = new Uint8Array(buffer, 0, 4)
  const magic = String.fromCharCode(header[0], header[1], header[2], header[3])
  if (magic !== 'glTF') {
    const peek = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength)))
    if (peek.trimStart().startsWith('{') || peek.trimStart().startsWith('[')) {
      throw new Error('预览接口返回了 JSON 而非 GLB，请重新生成或切换白模预览')
    }
    if (peek.trimStart().startsWith('<')) {
      throw new Error('预览接口返回了 HTML 错误页，请稍后重试')
    }
    throw new Error('文件不是有效 GLB（magic 不匹配）')
  }
}

async function loadGLB(url: string): Promise<THREE.Group> {
  const buffer = await fetchGlbBuffer(url)
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.parse(
      buffer,
      '',
      (gltf) => resolve(gltf.scene),
      (err) => reject(new Error('GLB模型加载失败: ' + (err?.message || '解析错误'))),
    )
  })
}

async function parseSTLBuffer(buffer: ArrayBuffer): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new STLLoader()
    try {
      const geometry = loader.parse(buffer)
      geometry.computeVertexNormals()
      const material = makePreviewMaterial({ color: WHITE_PREVIEW_COLOR })
      const mesh = new THREE.Mesh(geometry, material)
      const group = new THREE.Group()
      group.add(mesh)
      resolve(group)
    } catch (err: any) {
      reject(new Error('STL模型加载失败: ' + (err?.message || '解析错误')))
    }
  })
}

async function parseOBJBuffer(buffer: ArrayBuffer): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader()
    try {
      const text = new TextDecoder().decode(buffer)
      const obj = loader.parse(text)
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && !child.material) {
          child.material = makePreviewMaterial({ color: WHITE_PREVIEW_COLOR })
        }
      })
      resolve(obj)
    } catch (err: any) {
      reject(new Error('OBJ模型加载失败: ' + (err?.message || '解析错误')))
    }
  })
}

/** 销毁Three.js资源 */
function dispose() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  clearModel()
  controls?.dispose()
  releaseSceneEnvironment()
  renderer?.dispose()
  scene = null
  camera = null
  renderer = null
  controls = null
}

// ==========================================
// 生命周期
// ==========================================

onMounted(() => {
  nextTick(() => {
    initScene()
    window.addEventListener('resize', onResize)
    if (containerRef.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => onResize())
      resizeObserver.observe(containerRef.value)
    }
    reloadModel()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  resizeObserver?.disconnect()
  resizeObserver = null
  dispose()
})

function detectFormatFromUrl(url: string): string {
  const match = url.split('?')[0].match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toUpperCase() : props.modelFormat.toUpperCase()
}

function reloadModel() {
  if (!props.modelUrl || !scene) {
    clearModel()
    return
  }
  const format = props.modelFormat || detectFormatFromUrl(props.modelUrl)
  loadModel(props.modelUrl, format)
}

watch(
  () => props.previewMode,
  (mode) => {
    if (currentModel) {
      applyRendererToneForMode(mode)
      applyPreviewMaterials(currentModel, mode)
      fitCameraToModel(currentModel)
      renderer?.render(scene!, camera!)
    }
  }
)

watch(() => props.modelUrl, () => reloadModel())

watch(
  () => props.modelFormat,
  () => {
    if (props.modelUrl && scene) {
      reloadModel()
    }
  }
)

function applyClippingPlanes() {
  if (!renderer || !clipPlane) return
  const n = props.clipPlaneNormal || [0, 1, 0]
  clipPlane.normal.set(n[0], n[1], n[2]).normalize()
  clipPlane.constant = props.clipPlaneConstant ?? 0
  renderer.clippingPlanes = props.clippingEnabled ? [clipPlane] : []
}

watch(
  () => [props.clippingEnabled, props.clipPlaneNormal, props.clipPlaneConstant] as const,
  applyClippingPlanes,
  { deep: true }
)
</script>

<style scoped>
.model-viewer {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background-color: #1a1a2e;
}

.viewer-canvas {
  width: 100% !important;
  height: 100% !important;
  display: block;
}

.viewer-loading,
.viewer-error,
.viewer-empty {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: rgba(255, 255, 255, 0.7);
  background-color: #1a1a2e;
}

.viewer-loading p,
.viewer-error p,
.viewer-empty p {
  margin: 0;
  font-size: 14px;
}

.loading-icon {
  font-size: 36px;
  color: #409eff;
}

.loading-spin {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.viewer-toolbar {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  gap: 8px;
}

.viewer-controls-hint {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.8);
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  pointer-events: none;
  white-space: nowrap;
}
</style>
