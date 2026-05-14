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
        <a-table
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          row-key="orderId"
          :pagination="{ pageSize: 10 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
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
const rows = ref<
  { orderId: number; orderNumber: string; status: string; statusLabel: string; shareToken?: string }[]
>([])

const columns = [
  { title: '订单号', dataIndex: 'orderNumber', key: 'orderNumber' },
  { title: '状态', dataIndex: 'statusLabel', key: 'statusLabel' },
  { title: '操作', key: 'action' }
]

const load = async () => {
  try {
    loading.value = true
    const list = (await getClientOrders()) as any[]
    rows.value = list.map((r) => ({
      orderId: r.baseInfo?.id,
      orderNumber: r.baseInfo?.orderNumber,
      status: r.currentStatus,
      statusLabel: r.currentStatus || '-',
      shareToken: r.b2bShareAccessToken
    }))
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
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
