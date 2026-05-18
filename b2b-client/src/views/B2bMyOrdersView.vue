<template>
  <div class="order-detail-container">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content">
      <a-card class="b2b-portal-card" :bordered="false">
        <template #title>
          <div class="card-header">
            <ShopOutlined class="header-icon" />
            <span>我的订单</span>
          </div>
        </template>

        <a-space wrap style="margin-bottom: 16px" align="center">
          <span class="filter-label">状态</span>
          <a-select
            v-model:value="filterStatus"
            allow-clear
            placeholder="全部状态"
            style="width: 160px"
            :options="statusFilterOptions"
          />
          <span class="filter-label">下单时间</span>
          <a-range-picker v-model:value="dateRange" value-format="YYYY-MM-DD" />
          <a-button type="primary" :loading="loading" @click="load">查询</a-button>
          <a-button @click="resetFilters">重置</a-button>
        </a-space>

        <a-table
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          row-key="orderId"
          :pagination="{ pageSize: 10, showSizeChanger: true }"
          :scroll="{ x: 900 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'thumbs'">
              <div class="thumb-row">
                <template v-if="record.thumbUrls?.length">
                  <a-image
                    v-for="(url, idx) in record.thumbUrls.slice(0, 4)"
                    :key="idx"
                    :src="url"
                    :width="56"
                    :height="56"
                    style="object-fit: cover; border-radius: 4px"
                  />
                </template>
                <span v-else class="no-thumb">无附图</span>
              </div>
            </template>
            <template v-else-if="column.key === 'action'">
              <router-link v-if="record.shareToken" :to="`/portal/b2b/order/${record.shareToken}`">
                查看详情
              </router-link>
              <span v-else style="color: #999">暂无访问令牌</span>
            </template>
          </template>
        </a-table>
        <div style="margin-top: 16px; text-align: center">
          <router-link to="/portal"><a-button>返回门户</a-button></router-link>
        </div>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ShopOutlined } from '@ant-design/icons-vue'
import { getClientOrders } from '@/api'

const loading = ref(false)
const filterStatus = ref<string | undefined>(undefined)
const dateRange = ref<[string, string] | undefined>(undefined)

const statusFilterOptions = [
  { value: 'MODELING', label: '建模中' },
  { value: 'ACTION', label: '需要操作' },
  { value: 'DONE', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' }
]

interface B2bOrderRow {
  orderId: number
  orderNumber: string
  createdAt: string
  portalStatus: string
  portalBucket?: string
  thumbUrls: string[]
  shareToken?: string
}

const rows = ref<B2bOrderRow[]>([])

const columns = [
  { title: '参考图', key: 'thumbs', width: 260 },
  { title: '订单号', dataIndex: 'orderNumber', key: 'orderNumber', width: 160 },
  { title: '下单时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '状态', dataIndex: 'portalStatus', key: 'portalStatus', width: 120 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' as const }
]

const load = async () => {
  try {
    loading.value = true
    const params: { portalStatus?: string; from?: string; to?: string } = {}
    if (filterStatus.value) params.portalStatus = filterStatus.value
    if (dateRange.value?.[0]) params.from = dateRange.value[0]
    if (dateRange.value?.[1]) params.to = dateRange.value[1]
    const list = (await getClientOrders(params)) as any[]
    rows.value = list.map((r) => ({
      orderId: r.baseInfo?.id,
      orderNumber: r.baseInfo?.orderNumber ?? '-',
      createdAt: formatTime(r.createdAt || r.baseInfo?.orderTime),
      portalStatus: r.b2bPortalStatusLabel || '建模中',
      portalBucket: r.b2bPortalStatusBucket,
      thumbUrls: Array.isArray(r.b2bAttachmentPreviewUrls) ? r.b2bAttachmentPreviewUrls : [],
      shareToken: r.b2bShareAccessToken
    }))
  } finally {
    loading.value = false
  }
}

function formatTime(iso?: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const resetFilters = () => {
  filterStatus.value = undefined
  dateRange.value = undefined
  void load()
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.order-detail-container {
  min-height: 100vh;
  position: relative;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
}
.header-icon {
  color: var(--primary-color);
  font-size: 20px;
}
.filter-label {
  color: #666;
  font-size: 13px;
}
.thumb-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.no-thumb {
  color: #bbb;
  font-size: 12px;
}
</style>
