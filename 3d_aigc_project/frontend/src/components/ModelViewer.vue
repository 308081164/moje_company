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

    <!-- 控制提示 -->
    <div v-if="modelUrl && !loading && !error" class="viewer-controls-hint">
      <span>鼠标左键旋转 | 滚轮缩放 | 右键平移</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Loading, WarningFilled, View } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'

// ==========================================
// Props & Emits
// ==========================================

interface Props {
  /** 模型文件URL */
  modelUrl?: string
  /** 模型文件格式 */
  modelFormat?: 'GLB' | 'OBJ' | 'glb' | 'obj'
  /** 背景颜色 */
  backgroundColor?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelUrl: '',
  modelFormat: 'GLB',
  backgroundColor: '#1a1a2e',
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

  // 添加环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene!.add(ambientLight)

  // 添加方向光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 7)
  scene!.add(directionalLight)

  // 添加补光
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
  fillLight.position.set(-5, 5, -5)
  scene!.add(fillLight)

  // 创建相机
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(0, 1, 3)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true,
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  // 创建轨道控制器
  controls = new OrbitControls(camera, renderer!.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enableZoom = true
  controls.enablePan = true
  controls.minDistance = 0.5
  controls.maxDistance = 20

  // 添加网格辅助线
  const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x333333)
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

/** 调整尺寸 */
function onResize() {
  if (!containerRef.value || !camera || !renderer) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

/** 清理场景中的模型 */
function clearModel() {
  if (currentModel && scene) {
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

    if (format.toUpperCase() === 'GLB') {
      // 加载GLB格式
      model = await loadGLB(url)
    } else if (format.toUpperCase() === 'OBJ') {
      // 加载OBJ格式
      model = await loadOBJ(url)
    } else {
      throw new Error(`不支持的模型格式: ${format}`)
    }

    // 计算模型边界并居中
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    // 将模型居中
    model.position.sub(center)

    // 根据模型大小调整相机位置
    const maxDim = Math.max(size.x, size.y, size.z)
    const fitDistance = maxDim * 2
    camera!.position.set(fitDistance, fitDistance * 0.8, fitDistance)
    camera!.lookAt(0, 0, 0)
    controls!.target.set(0, 0, 0)
    controls!.update()

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

/** 加载GLB模型 */
function loadGLB(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader()
    loader.load(
      url,
      (gltf) => {
        resolve(gltf.scene)
      },
      undefined,
      (err) => {
        reject(new Error('GLB模型加载失败: ' + (err.message || '未知错误')))
      }
    )
  })
}

/** 加载OBJ模型 */
function loadOBJ(url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader()
    loader.load(
      url,
      (obj) => {
        // 为OBJ模型添加默认材质
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && !child.material) {
            child.material = new THREE.MeshStandardMaterial({
              color: 0xcccccc,
              metalness: 0.3,
              roughness: 0.6,
            })
          }
        })
        resolve(obj)
      },
      undefined,
      (err) => {
        reject(new Error('OBJ模型加载失败: ' + (err.message || '未知错误')))
      }
    )
  })
}

/** 销毁Three.js资源 */
function dispose() {
  if (animationId !== null) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  clearModel()
  controls?.dispose()
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
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  dispose()
})

// 监听模型URL变化
watch(
  () => props.modelUrl,
  (newUrl) => {
    if (newUrl && scene) {
      loadModel(newUrl, props.modelFormat)
    } else {
      clearModel()
    }
  }
)
</script>

<style scoped>
.model-viewer {
  width: 100%;
  height: 100%;
  min-height: 400px;
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
