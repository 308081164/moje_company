<template>
  <div class="inlay-selector">
    <!-- 搜索栏 -->
    <div class="selector-header">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索镶嵌结构..."
        :prefix-icon="Search"
        clearable
        size="default"
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

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-wrapper">
      <el-skeleton :rows="3" animated />
    </div>

    <!-- 空状态 -->
    <div v-else-if="filteredInlays.length === 0" class="empty-wrapper">
      <el-empty
        :description="searchKeyword ? '未找到匹配的镶嵌结构' : '暂无镶嵌结构数据'"
        :image-size="80"
      />
    </div>

    <!-- 镶嵌结构卡片列表 -->
    <div v-else class="inlay-grid">
      <div
        v-for="item in filteredInlays"
        :key="item.id"
        class="inlay-card"
        :class="{ 'is-selected': selectedInlay?.id === item.id }"
        @click="selectInlay(item)"
      >
        <!-- 格式图标 -->
        <div class="card-icon">
          <el-icon :size="28" color="#409eff">
            <Box />
          </el-icon>
        </div>

        <!-- 文件信息 -->
        <div class="card-info">
          <p class="card-name" :title="item.filename">{{ item.filename }}</p>
          <p class="card-meta">
            <span class="card-format">{{ item.file_format }}</span>
            <span class="card-size">{{ formatFileSize(item.file_size) }}</span>
          </p>
        </div>

        <!-- 选中标记 -->
        <div v-if="selectedInlay?.id === item.id" class="card-check">
          <el-icon color="#409eff"><CircleCheckFilled /></el-icon>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Search, Box, CircleCheckFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getInlayList, type InlayInfo } from '@/api'

// ==========================================
// Props & Emits
// ==========================================

interface Props {
  /** 外部传入的已选中镶嵌结构 */
  modelValue?: InlayInfo | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: InlayInfo | null]
  'select': [inlay: InlayInfo | null]
}>()

// ==========================================
// 状态
// ==========================================

const inlayList = ref<InlayInfo[]>([])
const loading = ref(false)
const searchKeyword = ref('')
const selectedInlay = ref<InlayInfo | null>(props.modelValue || null)

// 过滤后的列表
const filteredInlays = computed(() => {
  if (!searchKeyword.value) return inlayList.value
  const keyword = searchKeyword.value.toLowerCase()
  return inlayList.value.filter(
    (item) =>
      item.filename.toLowerCase().includes(keyword) ||
      item.file_format.toLowerCase().includes(keyword)
  )
})

// 监听外部modelValue变化
watch(
  () => props.modelValue,
  (val) => {
    selectedInlay.value = val || null
  }
)

// ==========================================
// 方法
// ==========================================

/** 加载镶嵌结构列表 */
async function loadInlayList() {
  loading.value = true
  try {
    const res = await getInlayList()
    inlayList.value = res.data || []
  } catch (err) {
    console.error('加载镶嵌结构列表失败:', err)
    ElMessage.warning('加载镶嵌结构列表失败')
  } finally {
    loading.value = false
  }
}

/** 选择镶嵌结构 */
function selectInlay(item: InlayInfo) {
  // 如果点击已选中的项，则取消选择
  if (selectedInlay.value?.id === item.id) {
    clearSelection()
    return
  }
  selectedInlay.value = item
  emit('update:modelValue', item)
  emit('select', item)
}

/** 清除选择 */
function clearSelection() {
  selectedInlay.value = null
  emit('update:modelValue', null)
  emit('select', null)
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 组件挂载时加载数据
onMounted(() => {
  loadInlayList()
})

// 暴露刷新方法
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
  gap: 8px;
  align-items: center;
}

.selector-header .el-input {
  flex: 1;
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

.card-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ecf5ff;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
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
</style>
