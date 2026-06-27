<template>
  <div class="inlay-selector">
    <div class="selector-header">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索镶嵌结构..."
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
        v-model="formatFilter"
        placeholder="文件类型"
        clearable
        size="default"
        class="format-select"
        @change="onFormatChange"
      >
        <el-option label="全部类型" value="" />
        <el-option
          v-if="meshFormatCount > 0"
          :label="`可用网格 OBJ/GLB/STL (${meshFormatCount})`"
          value="MESH"
        />
        <el-option
          v-for="fmt in meshFormatList"
          :key="fmt"
          :label="`${fmt} (${formatOptions[fmt] || 0})`"
          :value="fmt"
        />
        <el-option
          v-for="fmt in otherFormatList"
          :key="fmt"
          :label="`${fmt} (${formatOptions[fmt] || 0})`"
          :value="fmt"
        />
      </el-select>
      <el-checkbox v-model="onlyMeshReady" @change="onFilterChange">
        仅可融合
      </el-checkbox>
      <el-checkbox v-model="onlyWithPreview" @change="onFilterChange">
        仅有预览
      </el-checkbox>
      <el-button
        :icon="Refresh"
        size="default"
        title="刷新镶嵌库索引（批量转换 mesh 后使用）"
        :loading="refreshing"
        @click="refreshIndex"
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
      共 {{ total }} 项
      <span v-if="categoryFilter">· {{ categoryLabel }}</span>
      <span v-if="formatFilter">· {{ formatFilterLabel }}</span>
      <span v-if="onlyMeshReady">· 可融合</span>
      <span v-if="onlyWithPreview">· 有预览</span>
      <span v-if="meshReadyCount > 0" class="mesh-ready-hint">· 库内可融合 {{ meshReadyCount }} 项</span>
    </div>

    <div v-if="loading" class="loading-wrapper">
      <el-skeleton :rows="3" animated />
    </div>

    <div v-else-if="inlayList.length === 0" class="empty-wrapper">
      <el-empty
        :description="hasActiveFilter ? '未找到匹配的镶嵌结构' : '暂无镶嵌结构数据'"
        :image-size="80"
      />
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
          <p class="card-name" :title="item.id">{{ item.filename }}</p>
          <p class="card-path" :title="item.id">{{ item.id }}</p>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Search, Box, CircleCheckFilled, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  getInlayList,
  getInlayCategories,
  refreshInlayIndex,
  type InlayInfo,
  type InlayCategoryNode,
} from '@/api'

const MESH_FORMATS = ['OBJ', 'GLB', 'STL'] as const
const SYNTHETIC_FORMAT_KEYS = new Set(['MESH', 'MESH_READY'])

interface Props {
  modelValue?: InlayInfo | null
  /** 初始文件类型筛选：MESH / OBJ / JCD 等 */
  defaultFormatFilter?: string
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
const formatFilter = ref(props.defaultFormatFilter || '')
const onlyWithPreview = ref(false)
const onlyMeshReady = ref(props.defaultMeshReadyOnly ?? false)
const formatOptions = ref<Record<string, number>>({})
const categoryOptions = ref<InlayCategoryNode[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = 50
const selectedInlay = ref<InlayInfo | null>(props.modelValue || null)
const failedThumbnails = ref(new Set<string>())
const refreshing = ref(false)
const categoriesLoaded = ref(false)
const categoriesLoading = ref(false)

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
    !!formatFilter.value ||
    onlyMeshReady.value ||
    onlyWithPreview.value
)

const meshFormatCount = computed(() =>
  MESH_FORMATS.reduce((sum, fmt) => sum + (formatOptions.value[fmt] || 0), 0)
)

const meshReadyCount = computed(() => formatOptions.value.MESH_READY || 0)

const meshFormatList = computed(() =>
  MESH_FORMATS.filter((fmt) => (formatOptions.value[fmt] || 0) > 0)
)

const otherFormatList = computed(() =>
  Object.keys(formatOptions.value)
    .filter((fmt) => !SYNTHETIC_FORMAT_KEYS.has(fmt) && !MESH_FORMATS.includes(fmt as (typeof MESH_FORMATS)[number]))
    .sort()
)

const formatFilterLabel = computed(() => {
  if (!formatFilter.value) return ''
  if (formatFilter.value === 'MESH') return '可用网格'
  return formatFilter.value
})

const categoryLabel = computed(() => {
  if (!categoryFilter.value) return ''
  const parts = categoryFilter.value.split('/')
  return parts[parts.length - 1] || categoryFilter.value
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
    const res = await getInlayCategories()
    categoryOptions.value = res.data || []
    categoriesLoaded.value = true
  } catch {
    categoryOptions.value = []
  } finally {
    categoriesLoading.value = false
  }
}

function onCategoryVisibleChange(visible: boolean) {
  if (visible && !categoriesLoaded.value) {
    loadCategoryOptions()
  }
}

async function loadInlayList() {
  loading.value = true
  try {
    const res = await getInlayList({
      keyword: searchKeyword.value || undefined,
      category: categoryFilter.value || undefined,
      format: formatFilter.value || undefined,
      has_preview: onlyWithPreview.value || undefined,
      mesh_ready: onlyMeshReady.value || undefined,
      page: currentPage.value,
      page_size: pageSize,
    })
    inlayList.value = res.data?.items || []
    total.value = res.data?.total || 0
    if (res.data?.format_counts) {
      formatOptions.value = res.data.format_counts
    }
  } catch (err) {
    console.error('加载镶嵌结构列表失败:', err)
    ElMessage.warning('加载镶嵌结构列表失败')
  } finally {
    loading.value = false
  }
}

async function refreshIndex() {
  refreshing.value = true
  try {
    const res = await refreshInlayIndex()
    categoriesLoaded.value = false
    await loadInlayList()
    ElMessage.success(`索引已刷新，共 ${res.data?.total ?? 0} 项`)
  } catch (err) {
    console.error('刷新镶嵌库索引失败:', err)
    ElMessage.warning('刷新镶嵌库索引失败')
  } finally {
    refreshing.value = false
  }
}

function onFormatChange() {
  if (formatFilter.value === 'MESH' || MESH_FORMATS.includes(formatFilter.value as (typeof MESH_FORMATS)[number])) {
    onlyMeshReady.value = false
  }
  onFilterChange()
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

onMounted(() => {
  loadInlayList()
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

.format-select {
  width: 200px;
}

.mesh-ready-hint {
  color: #67c23a;
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

.card-check {
  flex-shrink: 0;
}

.selector-pagination {
  display: flex;
  justify-content: center;
  padding-top: 4px;
}
</style>
