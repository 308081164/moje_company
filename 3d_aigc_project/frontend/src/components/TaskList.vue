<template>
  <div class="task-list">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-button :icon="Refresh" @click="fetchTasks" :loading="loading">
        刷新
      </el-button>
      <span class="task-count">共 {{ total }} 个任务</span>
    </div>

    <!-- 任务表格 -->
    <el-table
      :data="tasks"
      v-loading="loading"
      stripe
      style="width: 100%"
      empty-text="暂无任务记录"
      @sort-change="handleSortChange"
    >
      <!-- 任务ID -->
      <el-table-column
        prop="task_id"
        label="任务ID"
        width="220"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span class="task-id">{{ row.task_id.substring(0, 8) }}...</span>
        </template>
      </el-table-column>

      <!-- 输入文件 -->
      <el-table-column
        prop="input_file"
        label="输入文件"
        min-width="180"
        show-overflow-tooltip
      />

      <!-- 状态 -->
      <el-table-column
        prop="status"
        label="状态"
        width="120"
        align="center"
      >
        <template #default="{ row }">
          <el-tag :type="getStatusType(row.status)" :class="getStatusClass(row.status)" round>
            {{ getStatusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>

      <!-- 输出格式 -->
      <el-table-column
        prop="output_format"
        label="输出格式"
        width="100"
        align="center"
      />

      <!-- 创建时间 -->
      <el-table-column
        prop="created_at"
        label="创建时间"
        width="180"
        sortable="custom"
      >
        <template #default="{ row }">
          {{ formatTime(row.created_at) }}
        </template>
      </el-table-column>

      <!-- 操作 -->
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <div class="action-buttons">
            <!-- 查看详情 -->
            <el-button
              type="primary"
              link
              size="small"
              :icon="View"
              @click="$emit('view-detail', row.task_id)"
            >
              详情
            </el-button>

            <!-- 下载结果 -->
            <el-button
              v-if="row.status === 'completed'"
              type="success"
              link
              size="small"
              :icon="Download"
              @click="$emit('download', row.task_id)"
            >
              下载
            </el-button>

            <!-- 删除任务 -->
            <el-popconfirm
              title="确定要删除该任务吗？"
              confirm-button-text="确定"
              cancel-button-text="取消"
              @confirm="$emit('delete', row.task_id)"
            >
              <template #reference>
                <el-button
                  type="danger"
                  link
                  size="small"
                  :icon="Delete"
                >
                  删除
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @size-change="fetchTasks"
        @current-change="fetchTasks"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Refresh, View, Download, Delete } from '@element-plus/icons-vue'
import { getTaskList, type TaskInfo } from '@/api'

// ==========================================
// Props & Emits
// ==========================================

defineEmits<{
  'view-detail': [taskId: string]
  'download': [taskId: string]
  'delete': [taskId: string]
}>()

// ==========================================
// 状态
// ==========================================

const tasks = ref<TaskInfo[]>([])
const loading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const sortField = ref('created_at')
const sortOrder = ref('descending')

// ==========================================
// 方法
// ==========================================

/** 获取任务列表 */
async function fetchTasks() {
  loading.value = true
  try {
    const res = await getTaskList(currentPage.value, pageSize.value)
    tasks.value = res.data?.tasks || []
    total.value = res.data?.total || 0
  } catch (err) {
    console.error('获取任务列表失败:', err)
  } finally {
    loading.value = false
  }
}

/** 排序变更 */
function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  sortField.value = prop || 'created_at'
  sortOrder.value = order || 'descending'
  fetchTasks()
}

/** 获取状态标签类型 */
function getStatusType(status: string): 'info' | 'warning' | 'success' | 'danger' {
  const map: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
    waiting: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
  }
  return map[status] || 'info'
}

/** 获取状态CSS类名 */
function getStatusClass(status: string): string {
  return `status-${status}`
}

/** 获取状态中文标签 */
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    waiting: '等待中',
    processing: '生成中',
    completed: '已完成',
    failed: '失败',
  }
  return map[status] || status
}

/** 格式化时间 */
function formatTime(timeStr: string): string {
  if (!timeStr) return '-'
  const date = new Date(timeStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

// 组件挂载时加载数据
onMounted(() => {
  fetchTasks()
})

// 暴露刷新方法
defineExpose({
  refresh: fetchTasks,
})
</script>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.task-count {
  font-size: 13px;
  color: var(--text-muted);
}

.task-id {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: var(--text-secondary);
}

.action-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
}
</style>
