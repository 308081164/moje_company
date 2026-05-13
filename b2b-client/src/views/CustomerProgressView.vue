<template>
  <div class="order-detail-container">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content">
      <a-card class="b2b-portal-card" :bordered="false" :loading="loading">
        <template #title>
          <div class="card-header">
            <GiftOutlined class="header-icon" />
            <span>定制订单进度</span>
          </div>
        </template>

        <div v-if="err" style="text-align: center; padding: 24px 0">
          <a-empty :description="err" />
        </div>

        <template v-else-if="data">
          <div style="text-align: center; margin-bottom: 20px">
            <a-typography-text type="secondary" style="font-size: 13px">C 端客户公开页</a-typography-text>
            <a-typography-title :level="4" style="margin: 8px 0 0">
              {{ data.displayTitle }}
            </a-typography-title>
            <a-tag :color="statusColor(data.currentStatus)" style="margin-top: 10px">
              {{ data.currentStatusLabel || data.currentStatus }}
            </a-tag>
          </div>

          <div v-if="data.firstDesignImageUrl" style="text-align: center; margin-bottom: 20px">
            <img
              :src="data.firstDesignImageUrl"
              alt="设计预览"
              class="design-preview"
            />
          </div>

          <div class="info-block">
            <div class="desc-row">
              <span class="desc-label">订单编号</span>
              <span class="desc-value">{{ data.orderNumber }}</span>
            </div>
            <div v-if="data.customerNameMasked" class="desc-row">
              <span class="desc-label">客户称呼</span>
              <span class="desc-value">{{ data.customerNameMasked }}</span>
            </div>
            <div v-if="data.createdAt" class="desc-row">
              <span class="desc-label">创建时间</span>
              <span class="desc-value">{{ dayjs(data.createdAt).format('YYYY-MM-DD HH:mm') }}</span>
            </div>
          </div>

          <template v-if="data.milestones && data.milestones.length > 0">
            <a-divider orientation="left">关键节点</a-divider>
            <a-timeline>
              <a-timeline-item v-for="(m, idx) in data.milestones" :key="idx" color="blue">
                <div>
                  <a-typography-text strong>{{ m.label }}</a-typography-text>
                  <div>
                    <a-typography-text type="secondary" style="font-size: 12px">
                      {{ dayjs(m.at).format('YYYY-MM-DD HH:mm') }}
                    </a-typography-text>
                  </div>
                </div>
              </a-timeline-item>
            </a-timeline>
          </template>

          <div class="footer-actions" style="margin-top: 24px; text-align: center">
            <router-link to="/">
              <a-button type="primary">返回门户首页</a-button>
            </router-link>
          </div>
        </template>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { GiftOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import { getCustomerOrderPublic, type CustomerOrderPublicDto } from '@/api'

const route = useRoute()
const loading = ref(false)
const data = ref<CustomerOrderPublicDto | null>(null)
const err = ref<string | null>(null)

const statusColor = (status: string) => {
  const map: Record<string, string> = {
    PENDING_DESIGN: 'blue',
    DESIGNING: 'orange',
    PENDING_MODEL: 'cyan',
    MODELING: 'geekblue',
    PENDING_REVIEW: 'purple',
    PENDING_QUOTATION: 'magenta',
    QUOTED: 'volcano',
    PENDING_PRODUCTION: 'gold',
    IN_PRODUCTION: 'yellow',
    COMPLETED: 'green',
    CANCELLED: 'red'
  }
  return map[status] || 'default'
}

const load = async () => {
  const token = route.params.token as string
  if (!token) {
    err.value = '链接无效'
    return
  }
  try {
    loading.value = true
    data.value = await getCustomerOrderPublic(token)
    err.value = null
  } catch (e: unknown) {
    console.error(e)
    err.value = '加载失败，请检查链接是否过期或已失效'
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

.design-preview {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: 12px;
  background: #f0f0f0;
}

.info-block {
  background: #fafafa;
  border-radius: 12px;
  padding: 14px 16px;
  font-size: 14px;
}

.desc-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}

.desc-label {
  color: rgba(0, 0, 0, 0.45);
}

.desc-value {
  text-align: right;
  word-break: break-all;
}
</style>
