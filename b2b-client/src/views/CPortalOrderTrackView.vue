<template>
  <div class="order-detail-container">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content">
      <a-card class="b2b-portal-card" :bordered="false" :loading="loading">
        <template #title>
          <div class="card-header">
            <GiftOutlined class="header-icon" />
            <span>订单进度</span>
          </div>
        </template>
        <div v-if="err" style="text-align: center; padding: 24px 0">
          <a-empty :description="err" />
        </div>
        <template v-else-if="data">
          <CustomerProgressBody :data="data" />
        </template>
      </a-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { GiftOutlined } from '@ant-design/icons-vue'
import { portalOrderSummary } from '@/api'
import type { CustomerOrderPublicDto } from '@/api'
import CustomerProgressBody from './CustomerProgressBody.vue'

const route = useRoute()
const loading = ref(false)
const data = ref<CustomerOrderPublicDto | null>(null)
const err = ref<string | null>(null)

const load = async () => {
  const id = Number(route.params.orderId)
  if (!id) {
    err.value = '链接无效'
    return
  }
  try {
    loading.value = true
    data.value = await portalOrderSummary(id)
    err.value = null
  } catch {
    err.value = '加载失败，请确认已登录且订单已绑定到本账号'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.orderId, load)
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
