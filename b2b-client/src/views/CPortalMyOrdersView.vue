<template>
  <div class="order-detail-container">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content">
      <a-card class="b2b-portal-card" :bordered="false">
        <template #title>
          <div class="card-header">
            <GiftOutlined class="header-icon" />
            <span>我的定制订单</span>
          </div>
        </template>
        <a-table
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          row-key="orderId"
          :pagination="{ pageSize: 10 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <router-link :to="`/portal/c/orders/${record.orderId}/track`">查看进度</router-link>
            </template>
          </template>
        </a-table>
        <div style="margin-top: 16px; text-align: center">
          <router-link to="/"><a-button>返回首页</a-button></router-link>
        </div>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { GiftOutlined } from '@ant-design/icons-vue'
import { portalListOrders } from '@/api'
import type { PortalCustomerOrderListItemDto } from '@/api'

const loading = ref(false)
const rows = ref<PortalCustomerOrderListItemDto[]>([])

const columns = [
  { title: '订单号', dataIndex: 'orderNumber', key: 'orderNumber' },
  { title: '标题', dataIndex: 'displayTitle', key: 'displayTitle' },
  { title: '状态', dataIndex: 'currentStatusLabel', key: 'currentStatusLabel' },
  { title: '操作', key: 'action' }
]

onMounted(async () => {
  loading.value = true
  try {
    rows.value = await portalListOrders()
  } finally {
    loading.value = false
  }
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
</style>
