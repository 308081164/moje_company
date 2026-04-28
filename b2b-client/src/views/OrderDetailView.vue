<template>
  <div class="order-detail-container">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content">
      <a-card class="b2b-portal-card" :bordered="false" :loading="loading">
        <template #title>
          <div class="card-header">
            <ShopOutlined class="header-icon" />
            <span>订单详情</span>
          </div>
        </template>

        <a-descriptions :column="1" bordered v-if="orderInfo">
          <a-descriptions-item label="订单编号">
            <a-tag color="gold">{{ orderInfo.orderNumber }}</a-tag>
          </a-descriptions-item>
          
          <a-descriptions-item label="订单状态">
            <a-tag :color="getStatusColor(orderInfo.status)">
              {{ orderInfo.statusDescription }}
            </a-tag>
          </a-descriptions-item>
          
          <a-descriptions-item label="客户">
            {{ orderInfo.customerName || orderInfo.customerPhone }}
          </a-descriptions-item>
          
          <a-descriptions-item label="来源">
            {{ orderInfo.sourceDescription }}
          </a-descriptions-item>
          
          <a-descriptions-item label="定金金额">
            <template v-if="orderInfo.depositAmount">
              ¥{{ Number(orderInfo.depositAmount).toFixed(2) }}
            </template>
            <template v-else>
              -
            </template>
          </a-descriptions-item>

          <a-divider>订单需求</a-divider>

          <a-descriptions-item label="基础需求">
            {{ orderInfo.basicRequirements }}
          </a-descriptions-item>

          <a-descriptions-item label="款式信息">
            {{ orderInfo.styleInfo || '-' }}
          </a-descriptions-item>

          <a-descriptions-item label="材质信息">
            {{ orderInfo.materialInfo || '-' }}
          </a-descriptions-item>

          <a-divider>进度详情</a-divider>

          <a-descriptions-item label="设计方案" v-if="orderInfo.designPlanUrl">
            <a-space>
              <a :href="orderInfo.designPlanUrl" target="_blank">查看设计图</a>
              <template v-if="orderInfo.designPlanDescription">
                {{ orderInfo.designPlanDescription }}
              </template>
            </a-space>
          </a-descriptions-item>

          <a-descriptions-item label="工艺验证" v-if="orderInfo.reviewResult">
            <a-tag :color="orderInfo.reviewResult === 'APPROVED' ? 'green' : 'red'">
              {{ orderInfo.reviewResult === 'APPROVED' ? '已通过' : '需修改' }}
            </a-tag>
            <p v-if="orderInfo.reviewComment" style="margin-top: 8px; color: #666">
              {{ orderInfo.reviewComment }}
            </p>
          </a-descriptions-item>

          <a-descriptions-item label="3D模型" v-if="orderInfo.modelFileUrl">
            <a :href="orderInfo.modelFileUrl" target="_blank">下载模型文件</a>
          </a-descriptions-item>

          <a-descriptions-item label="报价信息" v-if="orderInfo.quotationAmount">
            <div>报价: ¥{{ Number(orderInfo.quotationAmount).toFixed(2) }}</div>
            <p v-if="orderInfo.quotationDetails" style="color: #666; margin-top: 4px">
              {{ orderInfo.quotationDetails }}
            </p>
          </a-descriptions-item>

          <a-descriptions-item label="生产状态" v-if="orderInfo.productionStatus">
            {{ orderInfo.productionStatus }}
            <p v-if="orderInfo.productionNotes" style="color: #666; margin-top: 4px">
              {{ orderInfo.productionNotes }}
            </p>
          </a-descriptions-item>

          <a-descriptions-item label="物流信息" v-if="orderInfo.shippingTracking">
            {{ orderInfo.shippingTracking }}
          </a-descriptions-item>
        </a-descriptions>

        <div class="footer-actions" style="margin-top: 24px; text-align: center">
          <a-button type="primary" @click="router.go(-1)">返回</a-button>
        </div>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ShopOutlined } from '@ant-design/icons-vue'
import { getOrderByToken } from '@/api'
import type { OrderInfoDto } from '@/api'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const orderInfo = ref<OrderInfoDto | null>(null)

const getStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    'PENDING_DESIGN': 'blue',
    'DESIGNING': 'orange',
    'PENDING_MODEL': 'cyan',
    'MODELING': 'geekblue',
    'PENDING_REVIEW': 'purple',
    'PENDING_QUOTATION': 'magenta',
    'QUOTED': 'volcano',
    'PENDING_PRODUCTION': 'gold',
    'IN_PRODUCTION': 'yellow',
    'COMPLETED': 'green',
    'CANCELLED': 'red'
  }
  return colorMap[status] || 'default'
}

const loadOrder = async () => {
  const token = route.params.token as string
  if (!token) {
    return
  }
  
  try {
    loading.value = true
    orderInfo.value = await getOrderByToken(token)
  } catch (error) {
    console.error('加载订单失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadOrder()
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
