<template>
  <div>
    <div style="text-align: center; margin-bottom: 20px">
      <a-typography-text type="secondary" style="font-size: 13px">定制订单进度</a-typography-text>
      <a-typography-title :level="4" style="margin: 8px 0 0">
        {{ data.displayTitle }}
      </a-typography-title>
      <a-tag :color="statusColor(data.currentStatus)" style="margin-top: 10px">
        {{ data.currentStatusLabel || data.currentStatus }}
      </a-tag>
    </div>

    <div v-if="data.firstDesignImageUrl" style="text-align: center; margin-bottom: 20px">
      <img :src="data.firstDesignImageUrl" alt="设计预览" class="design-preview" />
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
      <router-link to="/"><a-button type="primary">返回门户首页</a-button></router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import type { CustomerOrderPublicDto } from '@/api'

defineProps<{ data: CustomerOrderPublicDto }>()

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
</script>

<style scoped>
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
