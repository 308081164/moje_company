<template>
  <div class="inlay-selector">
    <div class="selector-header">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索名称/路径..."
        :prefix-icon="Search"
        clearable
        size="default"
        @input="onFilterChange"
      />
      <el-cascader
        v-model="categoryFilter"
        :options="categoryOptions"
        :props="cascaderProps"
        clearable
        filterable
        placeholder="目录分类"
        size="default"
        class="category-select"
        @change="onFilterChange"
        @visible-change="onCategoryVisibleChange"
      />
      <el-select
        v-model="selectedTags"
        multiple
        filterable
        collapse-tags
        collapse-tags-tooltip
        placeholder="标签筛选"
        size="default"
        class="tag-select"
        @change="onFilterChange"
        @visible-change="onTagsVisibleChange"
      >
        <el-option v-for="tag in allTags" :key="tag.id" :label="tag.name" :value="tag.name" />
      </el-select>
      <el-checkbox v-model="onlyMeshReady" @change="onFilterChange">
        仅可融合
      </el-checkbox>
      <el-checkbox v-model="onlyWithPreview" @change="onFilterChange">
        仅有预览
      </el-checkbox>
      <el-button
        type="primary"
        plain
        :icon="Upload"
        size="default"
        @click="openUploadDialog"
      >
        临时上传
      </el-button>
      <el-button
        :icon="Refresh"
        size="default"
        title="刷新镶嵌库列表"
        :loading="refreshing"
        @click="refreshList"
      />
      <el-button
        v-if="selectedInlay"
        type="info"
        plain
        size="default"
        @click="clearSelection"
      >
        清除选择
      </el-button>
    </div>

    <div v-if="!loading" class="selector-stats">
      共 {{ stats?.total ?? total }} 项
      <span v-if="stats">· 可融合 {{ stats.mesh_ready }} · 有预览 {{ stats.has_preview }}</span>
      <span v-if="categoryFilter">· {{ categoryLabel }}</span>
      <span v-if="selectedTags.length">· 标签 {{ selectedTags.length }}</span>
      <span v-if="onlyMeshReady">· 可融合</span>
      <span v-if="onlyWithPreview">· 有预览</span>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else-if="inlayList.length === 0" class="empty-wrapper">
      <el-empty
        :description="emptyDescription"
        :image-size="80"
      >
        <el-button v-if="!hasActiveFilter" type="primary" :icon="Upload" @click="openUploadDialog">
          临时上传
        </el-button>
      </el-empty>
    </div>

    <div v-else class="inlay-grid">
      <div
        v-for="item in inlayList"
        :key="item.id"
        class="inlay-card"
        :class="{ 'is-selected': selectedInlay?.id === item.id }"
        @click="selectInlay(item)"
      >
        <div class="card-thumb">
          <img
            v-if="item.has_preview && item.thumbnail_url && !failedThumbnails.has(item.id)"
            :src="item.thumbnail_url"
            :alt="item.filename"
            class="thumb-img"
            loading="lazy"
            decoding="async"
            @error="onThumbnailError(item.id)"
          />
          <div v-else class="thumb-placeholder" title="暂无预览图">
            <el-icon :size="22" color="#909399">
              <Box />
            </el-icon>
          </div>
        </div>

        <div class="card-info">
          <p class="card-name" :title="item.filename">{{ item.filename }}</p>
          <p class="card-path" :title="item.legacy_path || item.id">
            {{ item.legacy_path || item.id }}
          </p>
          <p class="card-meta">
            <span class="card-format" :class="{ 'is-mesh': isMeshFormat(item.file_format) }">
              {{ item.file_format }}
            </span>
            <span v-if="item.mesh_ready" class="card-mesh-ready">可融合</span>
            <span class="card-size">{{ formatFileSize(item.file_size) }}</span>
          </p>
        </div>

        <div v-if="selectedInlay?.id === item.id" class="card-check">
          <el-icon color="#409eff"><CircleCheckFilled /></el-icon>
        </div>
      </div>
    </div>

    <div v-if="total > pageSize" class="selector-pagination">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next, jumper"
        small
        background
        @current-change="loadInlayList"
      />
    </div>

    <el-dialog
      v-model="uploadDialogOpen"
      title="临时上传镶嵌结构"
      width="520px"
      destroy-on-close
      append-to-body
      @closed="resetUploadForm"
    >
      <p class="upload-intro">
        快速上传并保存到镶嵌库，上传后可直接用于本次生成。支持 JCD / OBJ / GLB / STL。
      </p>
      <el-form label-width="96px" size="default">
        <el-form-item label="源文件" required>
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".jcd,.obj,.glb,.stl"
            :on-change="(f: UploadFile) => onUploadFileChange('source', f)"
            :on-remove="() => (uploadSource = null)"
          >
            <el-button type="primary" plain>选择 JCD / OBJ / GLB / STL</el-button>
            <template #tip>
              <div class="upload-tip">
                必填。OBJ / GLB / STL 可直接用于融合；JCD 建议同时提供 Mesh 文件。
              </div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="预览图">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".png,.jpg,.jpeg,.webp,.bmp"
            :on-change="(f: UploadFile) => onUploadFileChange('preview', f)"
            :on-remove="onUploadPreviewRemove"
          >
            <el-button plain>选择 PNG / JPG / BMP</el-button>
          </el-upload>
          <div v-if="uploadPreviewUrl" class="upload-preview">
            <img :src="uploadPreviewUrl" alt="预览图" />
          </div>
        </el-form-item>
        <el-form-item v-if="uploadSourceIsJcd" label="Mesh 文件">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".obj,.glb,.stl"
            :on-change="(f: UploadFile) => onUploadFileChange('mesh', f)"
            :on-remove="() => (uploadMesh = null)"
          >
            <el-button plain>选择 OBJ / GLB / STL（可选）</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="uploadForm.display_name" placeholder="默认同文件名（不含扩展名）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogOpen = false">取消</el-button>
        <el-button
          type="primary"
          :loading="uploading"
          :disabled="!uploadSource"
          @click="submitTempUpload"
        >
          上传并使用
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Search, Box, CircleCheckFilled, Refresh, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import {
  getInlayListUnified,
  getInlayV2Categories,
  getInlayV2Stats,
  getInlayV2Tags,
  createInlayV2Item,
  mapV2ItemToInlayInfo,
  type InlayInfo,
  type InlayCategoryNode,
  type InlayTag,
  type InlayV2Stats,
} from '@/api'

const MESH_FORMATS = ['OBJ', 'GLB', 'STL'] as const

interface Props {
  modelValue?: InlayInfo | null
  /** 初始勾选「仅可融合」 */
  defaultMeshReadyOnly?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: InlayInfo | null]
  select: [inlay: InlayInfo | null]
}>()

const inlayList = ref<InlayInfo[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const categoryFilter = ref('')
const selectedTags = ref<string[]>([])
const onlyWithPreview = ref(false)
const onlyMeshReady = ref(props.defaultMeshReadyOnly ?? false)
const categoryOptions = ref<InlayCategoryNode[]>([])
const allTags = ref<InlayTag[]>([])
const stats = ref<InlayV2Stats | null>(null)
const total = ref(0)
const currentPage = ref(1)
const pageSize = 50
const selectedInlay = ref<InlayInfo | null>(props.modelValue || null)
const failedThumbnails = ref(new Set<string>())
const refreshing = ref(false)
const categoriesLoaded = ref(false)
const categoriesLoading = ref(false)
const tagsLoaded = ref(false)
const tagsLoading = ref(false)

const uploadDialogOpen = ref(false)
const uploading = ref(false)
const uploadSource = ref<File | null>(null)
const uploadPreview = ref<File | null>(null)
const uploadMesh = ref<File | null>(null)
const uploadPreviewUrl = ref('')
const uploadForm = ref({ display_name: '' })

const cascaderProps = {
  checkStrictly: true,
  emitPath: false,
  value: 'value',
  label: 'label',
  children: 'children',
}

let filterTimer: ReturnType<typeof setTimeout> | null = null

const hasActiveFilter = computed(
  () =>
    !!searchKeyword.value ||
    !!categoryFilter.value ||
    selectedTags.value.length > 0 ||
    onlyMeshReady.value ||
    onlyWithPreview.value
)

const categoryLabel = computed(() => {
  if (!categoryFilter.value) return ''
  const parts = categoryFilter.value.split('/')
  return parts[parts.length - 1] || categoryFilter.value
})

const emptyDescription = computed(() =>
  hasActiveFilter.value
    ? '未找到匹配的镶嵌结构'
    : '镶嵌库暂无数据，可「临时上传」快速导入，或到「镶嵌结构库」批量管理'
)

const uploadSourceIsJcd = computed(() => {
  const name = uploadSource.value?.name?.toLowerCase() || ''
  return name.endsWith('.jcd')
})

watch(
  () => props.modelValue,
  (val) => {
    selectedInlay.value = val || null
  }
)

async function loadCategoryOptions() {
  if (categoriesLoading.value) return
  categoriesLoading.value = true
  try {
    const res = await getInlayV2Categories()
    categoryOptions.value = res.data || []
    categoriesLoaded.value = true
  } catch {
    categoryOptions.value = []
  } finally {
    categoriesLoading.value = false
  }
}

async function loadTagOptions() {
  if (tagsLoading.value) return
  tagsLoading.value = true
  try {
    const res = await getInlayV2Tags()
    allTags.value = res.data || []
    tagsLoaded.value = true
  } catch {
    allTags.value = []
  } finally {
    tagsLoading.value = false
  }
}

function onCategoryVisibleChange(visible: boolean) {
  if (visible && !categoriesLoaded.value) {
    loadCategoryOptions()
  }
}

function onTagsVisibleChange(visible: boolean) {
  if (visible && !tagsLoaded.value) {
    loadTagOptions()
  }
}

async function loadInlayList() {
  loading.value = true
  try {
    const [listRes, statsRes] = await Promise.all([
      getInlayListUnified({
        keyword: searchKeyword.value || undefined,
        category: categoryFilter.value || undefined,
        tags: selectedTags.value.length ? selectedTags.value.join(',') : undefined,
        has_preview: onlyWithPreview.value || undefined,
        mesh_ready: onlyMeshReady.value || undefined,
        page: currentPage.value,
        page_size: pageSize,
      }),
      getInlayV2Stats().catch(() => null),
    ])
    inlayList.value = listRes.data?.items || []
    total.value = listRes.data?.total || 0
    stats.value = statsRes?.data || null
  } catch (err) {
    console.error('加载镶嵌结构列表失败:', err)
    ElMessage.warning('加载镶嵌结构列表失败')
  } finally {
    loading.value = false
  }
}

async function refreshList() {
  refreshing.value = true
  try {
    categoriesLoaded.value = false
    tagsLoaded.value = false
    await Promise.all([loadCategoryOptions(), loadTagOptions(), loadInlayList()])
    ElMessage.success(`已刷新，共 ${total.value} 项`)
  } catch (err) {
    console.error('刷新镶嵌库失败:', err)
    ElMessage.warning('刷新镶嵌库失败')
  } finally {
    refreshing.value = false
  }
}

function isMeshFormat(format: string): boolean {
  return MESH_FORMATS.includes(format?.toUpperCase() as (typeof MESH_FORMATS)[number])
}

function onFilterChange() {
  if (filterTimer) clearTimeout(filterTimer)
  filterTimer = setTimeout(() => {
    currentPage.value = 1
    loadInlayList()
  }, 300)
}

function selectInlay(item: InlayInfo) {
  if (selectedInlay.value?.id === item.id) {
    clearSelection()
    return
  }
  selectedInlay.value = item
  emit('update:modelValue', item)
  emit('select', item)
}

function clearSelection() {
  selectedInlay.value = null
  emit('update:modelValue', null)
  emit('select', null)
}

function onThumbnailError(id: string) {
  if (failedThumbnails.value.has(id)) return
  failedThumbnails.value = new Set([...failedThumbnails.value, id])
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function revokeUploadPreviewUrl() {
  if (uploadPreviewUrl.value) {
    URL.revokeObjectURL(uploadPreviewUrl.value)
    uploadPreviewUrl.value = ''
  }
}

function openUploadDialog() {
  resetUploadForm()
  uploadDialogOpen.value = true
}

function resetUploadForm() {
  uploadSource.value = null
  uploadPreview.value = null
  uploadMesh.value = null
  uploadForm.value = { display_name: '' }
  revokeUploadPreviewUrl()
}

function onUploadFileChange(kind: 'source' | 'preview' | 'mesh', uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  if (kind === 'source') {
    uploadSource.value = raw
    if (!uploadForm.value.display_name) {
      uploadForm.value.display_name = raw.name.replace(/\.[^.]+$/, '')
    }
    if (!raw.name.toLowerCase().endsWith('.jcd')) {
      uploadMesh.value = null
    }
  } else if (kind === 'preview') {
    uploadPreview.value = raw
    revokeUploadPreviewUrl()
    uploadPreviewUrl.value = URL.createObjectURL(raw)
  } else {
    uploadMesh.value = raw
  }
}

function onUploadPreviewRemove() {
  uploadPreview.value = null
  revokeUploadPreviewUrl()
}

async function submitTempUpload() {
  if (!uploadSource.value) {
    ElMessage.warning('请选择源文件')
    return
  }
  uploading.value = true
  try {
    const res = await createInlayV2Item({
      source: uploadSource.value,
      preview: uploadPreview.value || undefined,
      mesh: uploadMesh.value || undefined,
      display_name: uploadForm.value.display_name || undefined,
    })
    const item = mapV2ItemToInlayInfo(res.data as unknown as Record<string, unknown>)
    uploadDialogOpen.value = false

    searchKeyword.value = ''
    categoryFilter.value = ''
    selectedTags.value = []
    onlyMeshReady.value = false
    onlyWithPreview.value = false
    currentPage.value = 1

    await loadInlayList()
    selectInlay(item)

    if (item.mesh_ready) {
      ElMessage.success(res.message || '临时上传成功，已自动选中')
    } else {
      ElMessage.success('临时上传成功，已自动选中')
      ElMessage.info('当前文件尚未就绪融合，OBJ/GLB/STL 可直接融合；JCD 需补充 Mesh 或在镶嵌结构库转换')
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '临时上传失败'
    ElMessage.error(msg)
  } finally {
    uploading.value = false
  }
}

onMounted(() => {
  loadInlayList()
})

onBeforeUnmount(() => {
  revokeUploadPreviewUrl()
})

defineExpose({
  refresh: loadInlayList,
})
</script>

<style scoped>
.inlay-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.selector-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.selector-header .el-input {
  flex: 1;
  min-width: 140px;
}

.category-select {
  width: 180px;
}

.tag-select {
  width: 180px;
}

.selector-stats {
  font-size: 12px;
  color: var(--text-muted);
}

.loading-wrapper {
  padding: 16px 0;
}

.empty-wrapper {
  padding: 24px 0;
}

.inlay-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 4px;
}

.inlay-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fff;
  position: relative;
}

.inlay-card:hover {
  border-color: #b3d8ff;
  background-color: #f0f7ff;
  box-shadow: var(--shadow-sm);
}

.inlay-card.is-selected {
  border-color: #409eff;
  background-color: #ecf5ff;
  box-shadow: 0 0 0 1px #409eff;
}

.card-thumb {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  overflow: hidden;
}

.thumb-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-path {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0 0 4px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  gap: 12px;
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.card-format {
  background: #f0f2f5;
  padding: 1px 6px;
  border-radius: 3px;
  text-transform: uppercase;
  font-weight: 500;
}

.card-format.is-mesh {
  background: #e1f3d8;
  color: #529b2e;
}

.card-mesh-ready {
  background: #f0f9eb;
  color: #67c23a;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 500;
}

.card-check {
  flex-shrink: 0;
}

.selector-pagination {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}

.upload-intro {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.upload-tip {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.upload-preview {
  margin-top: 8px;
  width: 120px;
  height: 120px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: #f5f7fa;
}

.upload-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
</style>
