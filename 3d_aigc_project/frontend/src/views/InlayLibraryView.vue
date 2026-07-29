<template>
  <div class="inlay-library">
    <div class="library-header">
      <h2>镶嵌结构库</h2>
      <div class="header-stats" v-if="stats && libraryMode === 'browse'">
        共 {{ stats.total }} 项 · 可融合 {{ stats.mesh_ready }} · 有预览 {{ stats.has_preview }}
      </div>
      <el-segmented v-model="libraryMode" :options="libraryModeOptions" class="library-mode-switch" />
      <el-button type="primary" :icon="Plus" class="header-add-btn" @click="openCreateDialog">
        新增
      </el-button>
    </div>

    <!-- 浏览列表 -->
    <div v-if="libraryMode === 'browse'" class="library-body">
      <!-- 左侧筛选 -->
      <aside class="library-sidebar">
        <el-input
          v-model="searchQ"
          placeholder="搜索名称/路径..."
          :prefix-icon="Search"
          clearable
          @input="debouncedLoad"
        />
        <el-tree
          v-if="categoryTree.length"
          :data="categoryTree"
          :props="{ label: 'label', children: 'children' }"
          highlight-current
          @node-click="onCategoryClick"
        />
        <div class="tag-filter">
          <p class="filter-label">标签筛选</p>
          <el-select
            v-model="selectedTags"
            multiple
            filterable
            allow-create
            placeholder="选择或输入标签"
            size="small"
            @change="debouncedLoad"
          >
            <el-option v-for="t in allTags" :key="t.id" :label="t.name" :value="t.name" />
          </el-select>
        </div>
        <el-checkbox v-model="filterMeshReady" @change="debouncedLoad">仅可融合</el-checkbox>
        <el-checkbox v-model="filterHasPreview" @change="debouncedLoad">仅有预览</el-checkbox>
      </aside>

      <!-- 主列表 -->
      <main class="library-main">
        <div v-if="selectedIds.length" class="batch-bar">
          <span>已选 {{ selectedIds.length }} 项</span>
          <el-select v-model="batchCategory" placeholder="批量改分类" size="small" clearable>
            <el-option v-for="c in flatCategories" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
          <el-input v-model="batchTag" placeholder="批量打标签" size="small" style="width: 120px" />
          <el-button size="small" type="primary" @click="applyBatch">应用</el-button>
          <el-button size="small" type="danger" @click="confirmBatchDelete">删除</el-button>
          <el-button size="small" @click="selectedIds = []">取消</el-button>
        </div>

        <div v-loading="loading" ref="scrollContainer" class="virtual-list" @scroll="onScroll">
          <div :style="{ height: totalHeight + 'px', position: 'relative' }">
            <div
              v-for="item in visibleItems"
              :key="item._uuid"
              class="library-card"
              :class="{ selected: selectedIds.includes(item._uuid), active: activeItem?._uuid === item._uuid }"
              :style="{ transform: `translateY(${item._offset}px)` }"
              @click="openDetail(item)"
            >
              <el-checkbox
                :model-value="selectedIds.includes(item._uuid)"
                @click.stop
                @change="(v: boolean) => toggleSelect(item._uuid, v)"
              />
              <div class="card-thumb">
                <img
                  v-if="item.thumbnail_url"
                  :src="item.thumbnail_url"
                  loading="lazy"
                  :alt="item.display_name"
                />
                <el-icon v-else :size="28" color="#909399"><Box /></el-icon>
              </div>
              <div class="card-body">
                <p class="card-title">{{ item.display_name }}</p>
                <p class="card-sub">{{ item.legacy_path }}</p>
                <div class="card-badges">
                  <el-tag size="small">{{ item.primary_format }}</el-tag>
                  <el-tag v-if="item.mesh_ready" size="small" type="success">可融合</el-tag>
                  <el-tag v-if="item.preview_method" size="small" type="info">{{ item.preview_method }}</el-tag>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="library-pagination">
          <el-pagination
            v-model:current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="total, prev, pager, next"
            background
            small
            @current-change="loadItems"
          />
        </div>
      </main>
    </div>

    <!-- 网格裁剪（独立模式） -->
    <div v-else class="library-body crop-mode-body">
      <aside class="library-sidebar crop-picker-sidebar">
        <p class="filter-label">选择要裁剪的结构</p>
        <el-input
          v-model="cropSearchQ"
          placeholder="搜索名称..."
          :prefix-icon="Search"
          clearable
        />
        <el-checkbox v-model="cropOnlyMeshReady" disabled>仅可融合网格</el-checkbox>
        <div v-loading="cropPickerLoading" class="crop-picker-list">
          <el-empty v-if="!cropPickerItems.length && !cropPickerLoading" description="暂无可裁剪条目" />
          <div
            v-for="item in cropPickerItems"
            :key="item._uuid"
            class="crop-picker-item"
            :class="{ active: cropTargetId === item._uuid }"
            @click="selectCropTarget(item)"
          >
            <div class="card-thumb crop-item-thumb">
              <img
                v-if="item.thumbnail_url"
                :src="item.thumbnail_url"
                loading="lazy"
                :alt="item.display_name"
              />
              <el-icon v-else :size="22" color="#909399"><Box /></el-icon>
            </div>
            <div class="crop-item-meta">
              <p class="card-title">{{ item.display_name }}</p>
              <p class="card-sub">{{ item.primary_format }}</p>
            </div>
          </div>
        </div>
      </aside>

      <main class="library-main crop-editor-main">
        <div v-if="!cropTargetId" class="crop-empty">
          <el-empty description="请从左侧选择可融合的镶嵌结构，或先在「浏览列表」中导入网格" />
        </div>
        <InlayMeshEditor
          v-else
          :key="cropTargetId"
          :inlay-id="cropTargetId"
          :display-name="cropTargetName"
          embedded
          @back="onCropEditorBack"
          @saved="onCropEditorSaved"
        />
      </main>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerOpen" :title="activeItem?.display_name || '详情'" size="480px" destroy-on-close>
      <div v-if="activeItem" class="drawer-content">
        <img
          v-if="activeItem.thumbnail_url"
          :src="activeItem.thumbnail_url"
          class="drawer-thumb"
          :alt="activeItem.display_name"
        />
        <InlayPreviewPanel :item="activeItem" :item-uuid="activeItem._uuid" />
        <el-form label-width="80px" size="small" class="edit-form">
          <el-form-item label="显示名">
            <el-input v-model="editForm.display_name" />
          </el-form-item>
          <el-form-item label="标签">
            <el-select
              v-model="editForm.tags"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="选择或输入标签"
              style="width: 100%"
            >
              <el-option v-for="t in allTags" :key="t.id" :label="t.name" :value="t.name" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
            <el-button type="danger" plain :loading="deleting" @click="confirmDeleteSingle">删除</el-button>
          </el-form-item>
        </el-form>
      </div>
    </el-drawer>

    <!-- 新增导入 -->
    <el-dialog
      v-model="createDialogOpen"
      title="新增镶嵌结构"
      :width="createPreviewFile ? '560px' : '520px'"
      destroy-on-close
      :close-on-press-escape="!createPreviewFullscreen"
      @closed="resetCreateForm"
    >
      <el-form label-width="96px" size="default">
        <el-form-item label="源文件" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            :accept="sourceAccept"
            :on-change="(f: UploadFile) => onCreateFileChange('source', f)"
            :on-remove="onCreateSourceRemove"
          >
            <el-button type="primary" plain>{{ sourceUploadLabel }}</el-button>
            <template #tip>
              <div class="upload-tip">{{ sourceUploadTip }}</div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="预览图">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".png,.jpg,.jpeg,.webp,.bmp"
            :on-change="(f: UploadFile) => onCreateFileChange('preview', f)"
            :on-remove="onCreatePreviewRemove"
          >
            <el-button plain>选择 PNG / JPG / BMP</el-button>
          </el-upload>
          <div v-if="createPreviewThumbUrl" class="create-preview-thumb-wrap">
            <img :src="createPreviewThumbUrl" alt="预览图" class="create-preview-thumb" />
            <span class="create-preview-thumb-name">{{ createPreview?.name }}</span>
          </div>
        </el-form-item>
        <el-form-item v-if="createSourceIsJcd" label="Mesh 文件">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".obj,.glb,.stl"
            :on-change="(f: UploadFile) => onCreateFileChange('mesh', f)"
            :on-remove="onCreateMeshRemove"
          >
            <el-button plain>选择 OBJ / GLB / STL（可选）</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="createForm.display_name" placeholder="默认同文件名" />
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="createForm.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入标签"
            style="width: 100%"
          >
            <el-option v-for="t in allTags" :key="t.id" :label="t.name" :value="t.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select
            v-model="createForm.category_id"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="选择或输入分类"
            style="width: 100%"
          >
            <el-option v-for="c in flatCategories" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="createPreviewFile" label="网格预览">
          <div class="create-mesh-preview" :class="{ 'is-fullscreen': createPreviewFullscreen }">
            <div class="create-preview-header">
              <span class="create-preview-filename">{{ createPreviewFile.name }}</span>
              <el-button
                size="small"
                :icon="createPreviewFullscreen ? Close : FullScreen"
                :title="createPreviewFullscreen ? '退出全屏 (Esc)' : '全屏预览'"
                @click="toggleCreatePreviewFullscreen"
              />
            </div>
            <div class="create-preview-viewer">
              <ModelViewer
                v-if="createMeshPreviewUrl"
                ref="createMeshViewerRef"
                :key="createMeshPreviewUrl"
                :model-url="createMeshPreviewUrl"
                :model-format="createPreviewFormat"
                preview-mode="white"
              >
                <template #toolbar-extra>
                  <el-button
                    size="small"
                    :icon="Camera"
                    :loading="capturingPreview"
                    title="将当前 3D 视图截图并设为预览图"
                    @click="captureCreatePreviewImage"
                  >
                    截图设为预览图
                  </el-button>
                </template>
              </ModelViewer>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogOpen = false">取消</el-button>
        <el-button type="primary" :loading="creating" :disabled="!createSource" @click="submitCreate">
          导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="jcdConvertDialogOpen" title="JCD 转 Mesh" width="440px" :close-on-click-modal="false">
      <p>已上传 JCD，正在等待 Mesh 转换完成…</p>
      <p class="upload-tip">
        若长时间未完成，请在 JewelCAD 中导出 OBJ 后重新上传。详见文档
        <code>docs/inlay-model-crop-integration-analysis.md</code> 中的 JewelCAD SOP。
      </p>
      <el-progress v-if="jcdConvertPolling" :percentage="100" status="success" :indeterminate="true" />
      <template #footer>
        <el-button @click="jcdConvertDialogOpen = false">关闭</el-button>
        <el-button type="primary" :loading="jcdConvertPolling" @click="pollJcdMeshReady">刷新状态</el-button>
        <el-button type="success" :disabled="!jcdMeshReady" @click="goToMeshEditorAfterJcd">进入裁剪</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import { Search, Box, Plus, FullScreen, Close, Camera } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile } from 'element-plus'
import InlayPreviewPanel from '@/components/InlayPreviewPanel.vue'
import InlayMeshEditor from '@/components/InlayMeshEditor.vue'
import ModelViewer from '@/components/ModelViewer.vue'
import {
  getInlayListUnified,
  getInlayV2Categories,
  createInlayV2Category,
  getInlayV2Tags,
  createInlayV2Tag,
  getInlayV2Stats,
  getInlayV2Config,
  getInlayV2Item,
  patchInlayV2Item,
  batchUpdateInlayV2,
  deleteInlayV2Item,
  batchDeleteInlayV2,
  createInlayV2Item,
  convertInlayMesh,
  type InlayV2Info,
  type InlayTag,
  type InlayCategoryNode,
} from '@/api'
import { verifyDeletePassword } from '@/utils/deleteAuth'
import { useRouter, useRoute } from 'vue-router'

interface LibraryItem extends InlayV2Info {
  _uuid: string
  _offset?: number
  display_name: string
  primary_format: string
}

const router = useRouter()
const route = useRoute()

type LibraryMode = 'browse' | 'crop'

const libraryMode = ref<LibraryMode>('browse')
const libraryModeOptions = [
  { label: '浏览列表', value: 'browse' },
  { label: '网格裁剪', value: 'crop' },
]

const cropTargetId = ref('')
const cropTargetName = ref('')
const cropSearchQ = ref('')
const cropOnlyMeshReady = ref(true)
const cropPickerLoading = ref(false)
const cropPickerItems = ref<LibraryItem[]>([])

const ROW_HEIGHT = 88
const BUFFER = 5

const loading = ref(false)
const items = ref<LibraryItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 50
const stats = ref<{ total: number; mesh_ready: number; has_preview: number } | null>(null)

const searchQ = ref('')
const categoryFilter = ref('')
const selectedTags = ref<string[]>([])
const filterMeshReady = ref(false)
const filterHasPreview = ref(false)

const categoryTree = ref<InlayCategoryNode[]>([])
const allTags = ref<InlayTag[]>([])
const selectedIds = ref<string[]>([])
const batchCategory = ref('')
const batchTag = ref('')

const drawerOpen = ref(false)
const activeItem = ref<LibraryItem | null>(null)
const editForm = ref({ display_name: '', tags: [] as string[] })
const saving = ref(false)
const deleting = ref(false)

const createDialogOpen = ref(false)
const creating = ref(false)
const createSource = ref<File | null>(null)
const createPreview = ref<File | null>(null)
const createMesh = ref<File | null>(null)
const createForm = ref({
  display_name: '',
  tags: [] as string[],
  category_id: '',
})

const jcdUploadEnabled = ref(true)
const sourceAccept = computed(() =>
  jcdUploadEnabled.value ? '.jcd,.obj,.glb,.stl' : '.obj,.glb,.stl'
)
const sourceUploadLabel = computed(() =>
  jcdUploadEnabled.value ? '选择 JCD / OBJ / GLB / STL' : '选择 OBJ / GLB / STL'
)
const sourceUploadTip = computed(() =>
  jcdUploadEnabled.value
    ? '必填。上传 JCD 时可额外提供 mesh；直接上传 OBJ/GLB/STL 则作为可融合网格。'
    : 'MVP 模式：仅网格格式。上传后自动清洗，可进入裁剪编辑器。'
)

const jcdConvertDialogOpen = ref(false)
const jcdConvertItemId = ref('')
const jcdConvertPolling = ref(false)
const jcdMeshReady = ref(false)

const createSourceIsJcd = computed(() => {
  const name = createSource.value?.name?.toLowerCase() || ''
  return name.endsWith('.jcd')
})

type MeshFormat = 'OBJ' | 'GLB' | 'STL'

function detectMeshFormat(filename: string): MeshFormat | '' {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'obj') return 'OBJ'
  if (ext === 'glb') return 'GLB'
  if (ext === 'stl') return 'STL'
  return ''
}

const createPreviewFile = computed(() => {
  if (createSourceIsJcd.value && createMesh.value) {
    return createMesh.value
  }
  if (createSource.value && detectMeshFormat(createSource.value.name)) {
    return createSource.value
  }
  return null
})

const createPreviewFormat = computed<MeshFormat>(() => {
  const file = createPreviewFile.value
  return (file ? detectMeshFormat(file.name) : '') || 'GLB'
})

const createMeshPreviewUrl = ref('')
const createPreviewFullscreen = ref(false)
const createMeshViewerRef = ref<InstanceType<typeof ModelViewer> | null>(null)
const capturingPreview = ref(false)
const createPreviewThumbUrl = ref('')

function revokeCreatePreviewThumb() {
  if (createPreviewThumbUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(createPreviewThumbUrl.value)
  }
  createPreviewThumbUrl.value = ''
}

function revokeCreateMeshPreview() {
  if (createMeshPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(createMeshPreviewUrl.value)
  }
  createMeshPreviewUrl.value = ''
}

function notifyViewerResize() {
  nextTick(() => {
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
  })
}

function setCreatePreviewFullscreen(on: boolean) {
  createPreviewFullscreen.value = on
  document.body.style.overflow = on ? 'hidden' : ''
  notifyViewerResize()
}

function toggleCreatePreviewFullscreen() {
  setCreatePreviewFullscreen(!createPreviewFullscreen.value)
}

function handleCreateDialogKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && createPreviewFullscreen.value) {
    event.preventDefault()
    setCreatePreviewFullscreen(false)
  }
}

watch(createPreviewFile, (file) => {
  revokeCreateMeshPreview()
  if (file) {
    createMeshPreviewUrl.value = URL.createObjectURL(file)
  } else if (createPreviewFullscreen.value) {
    setCreatePreviewFullscreen(false)
  }
})

watch(createPreview, (file) => {
  revokeCreatePreviewThumb()
  if (file) {
    createPreviewThumbUrl.value = URL.createObjectURL(file)
  }
})

watch(createDialogOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', handleCreateDialogKeydown)
  } else {
    window.removeEventListener('keydown', handleCreateDialogKeydown)
    if (createPreviewFullscreen.value) {
      setCreatePreviewFullscreen(false)
    }
  }
})

const scrollContainer = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const totalHeight = computed(() => items.value.length * ROW_HEIGHT)

const visibleItems = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / ROW_HEIGHT) - BUFFER)
  const visibleCount = Math.ceil((scrollContainer.value?.clientHeight || 400) / ROW_HEIGHT) + BUFFER * 2
  const end = Math.min(items.value.length, start + visibleCount)
  return items.value.slice(start, end).map((item, i) => ({
    ...item,
    _offset: (start + i) * ROW_HEIGHT,
  }))
})

const flatCategories = computed(() => {
  const out: { label: string; value: string }[] = []
  function walk(nodes: InlayCategoryNode[]) {
    for (const n of nodes) {
      out.push({ label: n.label, value: n.value })
      if (n.children) walk(n.children)
    }
  }
  walk(categoryTree.value)
  return out
})

function mapItem(raw: InlayV2Info): LibraryItem {
  const uuid = raw.id
  return {
    ...raw,
    id: uuid,
    _uuid: uuid,
    filename: raw.filename,
    display_name: raw.filename,
    file_format: raw.file_format,
    primary_format: raw.file_format,
    created_at: raw.created_at,
  }
}

async function loadItems() {
  loading.value = true
  try {
    const res = await getInlayListUnified({
      keyword: searchQ.value || undefined,
      category: categoryFilter.value || undefined,
      tags: selectedTags.value.length ? selectedTags.value.join(',') : undefined,
      mesh_ready: filterMeshReady.value || undefined,
      has_preview: filterHasPreview.value || undefined,
      page: page.value,
      page_size: pageSize,
    })
    items.value = (res.data?.items || []).map((item) => mapItem(item as InlayV2Info))
    total.value = res.data?.total || 0
  } catch {
    ElMessage.warning('加载镶嵌库失败')
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const [catRes, tagRes, statsRes] = await Promise.all([
      getInlayV2Categories(),
      getInlayV2Tags(),
      getInlayV2Stats(),
    ])
    categoryTree.value = catRes.data || []
    allTags.value = tagRes.data || []
    stats.value = statsRes.data || null
  } catch {
    /* optional */
  }
}

function debouncedLoad() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    page.value = 1
    loadItems()
  }, 300)
}

function onCategoryClick(node: InlayCategoryNode) {
  categoryFilter.value = node.value
  debouncedLoad()
}

function onScroll() {
  if (scrollContainer.value) {
    scrollTop.value = scrollContainer.value.scrollTop
  }
}

function toggleSelect(uuid: string, checked: boolean) {
  if (checked) {
    if (!selectedIds.value.includes(uuid)) selectedIds.value.push(uuid)
  } else {
    selectedIds.value = selectedIds.value.filter((id) => id !== uuid)
  }
}

function openDetail(item: LibraryItem) {
  activeItem.value = item
  editForm.value = {
    display_name: item.display_name,
    tags: item.tags ? [...item.tags] : [],
  }
  drawerOpen.value = true
}

async function resolveCreateTags(rawTags: string[]): Promise<string[]> {
  const resolved: string[] = []
  const seen = new Set<string>()
  for (const raw of rawTags) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const existing = allTags.value.find((t) => t.name.toLowerCase() === key)
    if (existing) {
      resolved.push(existing.name)
      continue
    }
    const res = await createInlayV2Tag({ name: trimmed })
    if (!res.data?.name) {
      throw new Error('创建标签失败')
    }
    resolved.push(res.data.name)
  }
  return resolved
}

async function saveEdit() {
  if (!activeItem.value) return
  saving.value = true
  try {
    const tags = await resolveCreateTags(editForm.value.tags)
    await patchInlayV2Item(activeItem.value._uuid, {
      display_name: editForm.value.display_name,
      tags,
    })
    ElMessage.success('已保存')
    await loadMeta()
    await loadItems()
  } catch {
    ElMessage.warning('保存失败')
  } finally {
    saving.value = false
  }
}

async function applyBatch() {
  if (!selectedIds.value.length) return
  try {
    await batchUpdateInlayV2({
      ids: selectedIds.value,
      category_id: batchCategory.value || undefined,
      add_tags: batchTag.value ? [batchTag.value] : undefined,
    })
    ElMessage.success('批量更新完成')
    selectedIds.value = []
    batchCategory.value = ''
    batchTag.value = ''
    await loadItems()
  } catch {
    ElMessage.warning('批量更新失败')
  }
}

async function performDelete(ids: string[]) {
  if (!ids.length) return
  if (ids.length === 1) {
    await deleteInlayV2Item(ids[0])
  } else {
    await batchDeleteInlayV2(ids)
  }
  ElMessage.success(`已删除 ${ids.length} 项`)
  selectedIds.value = selectedIds.value.filter((id) => !ids.includes(id))
  if (activeItem.value && ids.includes(activeItem.value._uuid)) {
    drawerOpen.value = false
    activeItem.value = null
  }
  await loadMeta()
  await loadItems()
}

async function confirmBatchDelete() {
  if (!selectedIds.value.length) return
  const count = selectedIds.value.length
  const verified = await verifyDeletePassword()
  if (!verified) return
  try {
    await ElMessageBox.confirm(`确定删除 ${count} 项？此操作不可恢复`, '确认删除', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  deleting.value = true
  try {
    await performDelete([...selectedIds.value])
  } catch {
    ElMessage.error('删除失败')
  } finally {
    deleting.value = false
  }
}

async function confirmDeleteSingle() {
  if (!activeItem.value) return
  const verified = await verifyDeletePassword()
  if (!verified) return
  try {
    await ElMessageBox.confirm('确定删除 1 项？此操作不可恢复', '确认删除', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  deleting.value = true
  try {
    await performDelete([activeItem.value._uuid])
  } catch {
    ElMessage.error('删除失败')
  } finally {
    deleting.value = false
  }
}

function openCreateDialog() {
  resetCreateForm()
  createDialogOpen.value = true
}

function resetCreateForm() {
  createSource.value = null
  createPreview.value = null
  createMesh.value = null
  createForm.value = { display_name: '', tags: [], category_id: '' }
  revokeCreateMeshPreview()
  revokeCreatePreviewThumb()
  if (createPreviewFullscreen.value) {
    setCreatePreviewFullscreen(false)
  }
}

function onCreatePreviewRemove() {
  createPreview.value = null
}

async function captureCreatePreviewImage() {
  const viewer = createMeshViewerRef.value
  if (!viewer?.captureScreenshot) {
    ElMessage.warning('预览尚未就绪')
    return
  }
  capturingPreview.value = true
  try {
    const blob = await viewer.captureScreenshot()
    if (!blob) {
      ElMessage.error('截图失败，请确保模型已加载')
      return
    }
    const baseName = createPreviewFile.value?.name.replace(/\.[^.]+$/, '') || 'preview'
    createPreview.value = new File([blob], `${baseName}-preview.png`, { type: 'image/png' })
    ElMessage.success('已设为预览图')
  } catch {
    ElMessage.error('截图失败')
  } finally {
    capturingPreview.value = false
  }
}

function onCreateSourceRemove() {
  createSource.value = null
}

function onCreateMeshRemove() {
  createMesh.value = null
}

function onCreateFileChange(kind: 'source' | 'preview' | 'mesh', uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  if (kind === 'source') {
    createSource.value = raw
    if (!createForm.value.display_name) {
      createForm.value.display_name = raw.name.replace(/\.[^.]+$/, '')
    }
  } else if (kind === 'preview') {
    createPreview.value = raw
  } else {
    createMesh.value = raw
  }
}

async function resolveCreateCategoryId(raw: string): Promise<string | undefined> {
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  const existing = flatCategories.value.find((c) => c.value === trimmed || c.label === trimmed)
  if (existing) return existing.value
  const res = await createInlayV2Category({ name: trimmed })
  if (!res.data?.id) {
    throw new Error('创建分类失败')
  }
  return res.data.id
}

async function submitCreate() {
  if (!createSource.value) {
    ElMessage.warning('请选择源文件')
    return
  }
  creating.value = true
  try {
    const categoryId = createForm.value.category_id
      ? await resolveCreateCategoryId(createForm.value.category_id)
      : undefined
    const tags = createForm.value.tags.length
      ? await resolveCreateTags(createForm.value.tags)
      : undefined
    const res = await createInlayV2Item({
      source: createSource.value,
      preview: createPreview.value || undefined,
      mesh: createMesh.value || undefined,
      display_name: createForm.value.display_name || undefined,
      category_id: categoryId,
      tags,
    })
    ElMessage.success(res.message || '导入成功')
    createDialogOpen.value = false
    await loadMeta()
    page.value = 1
    await loadItems()
    if (res.data) {
      const mapped = mapItem(res.data)
      openDetail(mapped)
      if (mapped.mesh_ready && !mapped.mesh_is_proxy) {
        ElMessage.info('网格已就绪，可切换到顶部「网格裁剪」模式')
      } else if (createSourceIsJcd.value && jcdUploadEnabled.value) {
        jcdConvertItemId.value = mapped._uuid
        jcdMeshReady.value = false
        jcdConvertDialogOpen.value = true
        await convertInlayMesh(mapped._uuid)
        startJcdPoll()
      }
    }
  } catch {
    ElMessage.error('导入失败')
  } finally {
    creating.value = false
  }
}

function enterCropMode(id: string, name?: string) {
  libraryMode.value = 'crop'
  cropTargetId.value = id
  cropTargetName.value = name || ''
  syncLibraryRouteQuery()
  void loadCropPickerItems()
}

function selectCropTarget(item: LibraryItem) {
  cropTargetId.value = item._uuid
  cropTargetName.value = item.display_name
  syncLibraryRouteQuery()
}

async function loadCropPickerItems() {
  cropPickerLoading.value = true
  try {
    const res = await getInlayListUnified({
      keyword: cropSearchQ.value || undefined,
      mesh_ready: true,
      page: 1,
      page_size: 200,
    })
    cropPickerItems.value = (res.data?.items || [])
      .map((item) => mapItem(item as InlayV2Info))
      .filter((item) => item.mesh_ready && !item.mesh_is_proxy)
  } catch {
    ElMessage.warning('加载可裁剪列表失败')
  } finally {
    cropPickerLoading.value = false
  }
}

function syncLibraryRouteQuery() {
  const query: Record<string, string> = {}
  if (libraryMode.value === 'crop') {
    query.mode = 'crop'
    if (cropTargetId.value) {
      query.id = cropTargetId.value
      if (cropTargetName.value) query.name = cropTargetName.value
    }
  }
  router.replace({ name: 'inlay-library', query })
}

function applyRouteQuery() {
  const mode = route.query.mode
  if (mode === 'crop') {
    libraryMode.value = 'crop'
    const id = route.query.id as string | undefined
    const name = route.query.name as string | undefined
    if (id) {
      cropTargetId.value = id
      cropTargetName.value = name || ''
    }
    void loadCropPickerItems()
    return
  }
  libraryMode.value = 'browse'
}

function onCropEditorBack() {
  libraryMode.value = 'browse'
  cropTargetId.value = ''
  cropTargetName.value = ''
  syncLibraryRouteQuery()
  void loadItems()
}

function onCropEditorSaved() {
  void loadCropPickerItems()
  void loadMeta()
}

let cropSearchTimer: ReturnType<typeof setTimeout> | null = null

watch(libraryMode, (mode) => {
  if (mode === 'crop') {
    void loadCropPickerItems()
    syncLibraryRouteQuery()
  } else {
    cropTargetId.value = ''
    cropTargetName.value = ''
    router.replace({ name: 'inlay-library' })
  }
})

watch(cropSearchQ, () => {
  if (libraryMode.value !== 'crop') return
  if (cropSearchTimer) clearTimeout(cropSearchTimer)
  cropSearchTimer = setTimeout(() => {
    void loadCropPickerItems()
  }, 300)
})

watch(
  () => route.query,
  () => {
    if (route.name !== 'inlay-library') return
    applyRouteQuery()
  }
)

let jcdPollTimer: ReturnType<typeof setInterval> | null = null

function startJcdPoll() {
  jcdConvertPolling.value = true
  if (jcdPollTimer) clearInterval(jcdPollTimer)
  jcdPollTimer = setInterval(pollJcdMeshReady, 4000)
  pollJcdMeshReady()
}

async function pollJcdMeshReady() {
  if (!jcdConvertItemId.value) return
  try {
    const res = await getInlayV2Item(jcdConvertItemId.value)
    const item = res.data
    jcdMeshReady.value = !!(item?.mesh_ready && !item?.mesh_is_proxy)
    if (jcdMeshReady.value) {
      jcdConvertPolling.value = false
      if (jcdPollTimer) {
        clearInterval(jcdPollTimer)
        jcdPollTimer = null
      }
      ElMessage.success('Mesh 转换完成，可进入裁剪')
      await loadItems()
    }
  } catch {
    /* ignore poll errors */
  }
}

function goToMeshEditorAfterJcd() {
  if (!jcdConvertItemId.value) return
  jcdConvertDialogOpen.value = false
  const item = cropPickerItems.value.find((i) => i._uuid === jcdConvertItemId.value)
    || items.value.find((i) => i._uuid === jcdConvertItemId.value)
  enterCropMode(
    jcdConvertItemId.value,
    item?.display_name || ''
  )
}

async function loadInlayConfig() {
  try {
    const res = await getInlayV2Config()
    jcdUploadEnabled.value = res.data?.mesh_crop_jcd_enabled !== false
  } catch {
    jcdUploadEnabled.value = true
  }
}

onMounted(() => {
  loadInlayConfig()
  loadMeta()
  loadItems()
  applyRouteQuery()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleCreateDialogKeydown)
  revokeCreateMeshPreview()
  revokeCreatePreviewThumb()
  if (createPreviewFullscreen.value) {
    document.body.style.overflow = ''
  }
})
</script>

<style scoped>
.inlay-library {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: calc(100vh - 120px);
}

.library-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.library-mode-switch {
  margin-left: auto;
}

.header-add-btn {
  margin-left: 0;
  flex-shrink: 0;
}

.upload-tip {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.library-header h2 {
  margin: 0;
  font-size: 20px;
}

.header-stats {
  color: var(--text-muted);
  font-size: 13px;
}

.library-body {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.library-sidebar {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-label {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.library-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #ecf5ff;
  border-radius: 6px;
  margin-bottom: 8px;
  font-size: 13px;
}

.virtual-list {
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 280px);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #fff;
}

.library-card {
  position: absolute;
  left: 0;
  right: 0;
  height: 80px;
  margin: 4px 8px;
  width: calc(100% - 16px);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.library-card:hover,
.library-card.active {
  border-color: #409eff;
  background: #f0f7ff;
}

.library-card.selected {
  background: #ecf5ff;
}

.card-thumb {
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
}

.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-title {
  margin: 0 0 2px;
  font-weight: 500;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-sub {
  margin: 0 0 4px;
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-badges {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.library-pagination {
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

.drawer-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-thumb {
  width: 100%;
  max-height: 160px;
  object-fit: contain;
  border-radius: 6px;
  background: #f5f7fa;
}

.crop-mode-body {
  min-height: calc(100vh - 180px);
}

.crop-picker-sidebar {
  width: 260px;
}

.crop-picker-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 200px;
  max-height: calc(100vh - 280px);
}

.crop-picker-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.15s, background 0.15s;
}

.crop-picker-item:hover,
.crop-picker-item.active {
  border-color: #409eff;
  background: #f0f7ff;
}

.crop-item-thumb {
  width: 48px;
  height: 48px;
}

.crop-item-meta {
  flex: 1;
  min-width: 0;
}

.crop-editor-main {
  min-height: calc(100vh - 180px);
}

.crop-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-color);
  border-radius: 8px;
  background: #fafafa;
  min-height: 520px;
}

.edit-form {
  margin-top: 8px;
}

.create-preview-thumb-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.create-preview-thumb {
  width: 72px;
  height: 72px;
  object-fit: contain;
  border-radius: 6px;
  background: #1a1a2e;
  border: 1px solid var(--el-border-color-lighter);
}

.create-preview-thumb-name {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-mesh-preview {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.create-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.create-preview-filename {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-preview-viewer {
  height: 240px;
  border-radius: 8px;
  overflow: hidden;
  background: #1a1a2e;
}

.create-mesh-preview.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  padding: 16px;
  background: #1a1a2e;
  box-sizing: border-box;
}

.create-mesh-preview.is-fullscreen .create-preview-header {
  flex-shrink: 0;
}

.create-mesh-preview.is-fullscreen .create-preview-viewer {
  flex: 1;
  height: auto;
  min-height: 0;
}
</style>
