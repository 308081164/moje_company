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

    <!-- 报价 -->
    <template v-if="data.quotation">
      <a-divider orientation="left">报价</a-divider>
      <div class="info-block">
        <div class="desc-row">
          <span class="desc-label">工费</span>
          <span class="desc-value">¥{{ data.quotation.laborCost ?? 0 }}</span>
        </div>
        <div class="desc-row">
          <span class="desc-label">附加工费</span>
          <span class="desc-value">¥{{ data.quotation.additionalLaborCost ?? 0 }}</span>
        </div>
        <div class="desc-row" style="font-weight: 600">
          <span class="desc-label">合计</span>
          <span class="desc-value">¥{{ data.quotation.totalAmount ?? 0 }}</span>
        </div>
      </div>
    </template>

    <!-- 建模源文件下载 -->
    <template v-if="data.modelFiles && data.modelFiles.length > 0">
      <a-divider orientation="left">建模源文件</a-divider>
      <a-space wrap>
        <a-button
          v-for="(f, i) in data.modelFiles"
          :key="i"
          size="small"
          type="primary"
          ghost
          :href="f.fileUrl"
          target="_blank"
        >
          下载 {{ f.fileName || '文件' }}
        </a-button>
      </a-space>
    </template>

    <!-- 事件卡片流 -->
    <template v-if="events.length > 0">
      <a-divider orientation="left">进度动态</a-divider>
      <a-timeline>
        <a-timeline-item
          v-for="ev in events"
          :key="ev.id"
          :color="eventColor(ev.eventType)"
        >
          <a-collapse ghost>
            <a-collapse-panel :key="ev.id">
              <template #header>
                <div style="display: flex; align-items: center; gap: 8px">
                  <a-typography-text strong>{{ ev.title || eventTypeLabel(ev.eventType) }}</a-typography-text>
                  <a-typography-text type="secondary" style="font-size: 12px">
                    {{ ev.createdAt ? dayjs(ev.createdAt).format('MM-DD HH:mm') : '' }}
                  </a-typography-text>
                </div>
              </template>
              <div v-if="ev.content" style="white-space: pre-wrap; margin-bottom: 4px">{{ ev.content }}</div>
              <div v-if="ev.reason" style="color: #cf1322; white-space: pre-wrap; margin-bottom: 4px">
                驳回原因：{{ ev.reason }}
              </div>
              <div v-if="ev.actorName" style="color: #888; font-size: 12px">操作人：{{ ev.actorName }}</div>
            </a-collapse-panel>
          </a-collapse>
        </a-timeline-item>
      </a-timeline>
    </template>

    <!-- 客户操作：确认 / 驳回 -->
    <template v-if="orderId">
      <a-divider orientation="left">我的操作</a-divider>
      <a-space wrap direction="vertical" style="width: 100%">
        <template v-if="canConfirmDesign">
          <a-space>
            <a-button type="primary" :loading="acting" @click="doConfirm('DESIGN_CONFIRM')">确认设计稿</a-button>
            <a-button danger :loading="acting" @click="promptReject('DESIGN_REJECT')">驳回设计稿</a-button>
          </a-space>
        </template>
        <template v-if="canConfirmModel">
          <a-space>
            <a-button type="primary" :loading="acting" @click="doConfirm('MODEL_CONFIRM')">确认建模稿</a-button>
            <a-button danger :loading="acting" @click="promptReject('MODEL_REJECT')">驳回建模稿</a-button>
          </a-space>
        </template>
        <template v-if="data.currentStatus === 'PRODUCING'">
          <a-button type="primary" block :loading="acting" @click="doConfirmDelivery">
            确认收货 / 付尾款
          </a-button>
        </template>
      </a-space>
    </template>

    <div class="footer-actions" style="margin-top: 24px; text-align: center">
      <router-link to="/"><a-button type="primary">返回门户首页</a-button></router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import dayjs from 'dayjs'
import { Modal, message } from 'ant-design-vue'
import {
  portalOrderEvents,
  portalConfirmOrder,
  portalRejectOrder,
  portalConfirmDelivery,
  type CustomerOrderPublicDto,
  type OrderEventDto
} from '@/api'

const props = defineProps<{ data: CustomerOrderPublicDto; orderId?: number }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const events = ref<OrderEventDto[]>([])
const acting = ref(false)

const lastEventOf = (types: string[]) => {
  const filtered = events.value.filter((e) => types.includes(e.eventType))
  return filtered.length ? filtered[filtered.length - 1] : undefined
}

// 最新事件为「设计师提交稿」且客户尚未确认设计 → 可确认/驳回设计
const canConfirmDesign = computed(() => {
  if (props.data.designApproved) return false
  return lastEventOf(['DESIGN_SUBMIT', 'DESIGN_REJECT', 'DESIGN_CONFIRM'])?.eventType === 'DESIGN_SUBMIT'
})

const canConfirmModel = computed(() => {
  if (props.data.modelApproved) return false
  return lastEventOf(['MODEL_SUBMIT', 'MODEL_REJECT', 'MODEL_CONFIRM'])?.eventType === 'MODEL_SUBMIT'
})

const statusColor = (status: string) => {
  const map: Record<string, string> = {
    PENDING_DESIGN: 'blue',
    DESIGNING: 'orange',
    PENDING_MODEL: 'geekblue',
    MODELING: 'purple',
    PENDING_REVIEW: 'purple',
    PENDING_PRODUCTION: 'gold',
    PRODUCING: 'yellow',
    COMPLETED: 'green',
    CANCELLED: 'red'
  }
  return map[status] || 'default'
}

const eventColor = (type: string) => {
  if (type.includes('REJECT')) return 'red'
  if (type.includes('CONFIRM')) return 'green'
  if (type.includes('SUBMIT')) return 'blue'
  return 'gray'
}

const eventTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    DESIGN_SUBMIT: '设计师提交稿',
    DESIGN_REJECT: '客户驳回设计稿',
    DESIGN_CONFIRM: '客户确认设计稿',
    MODEL_SUBMIT: '建模师提交稿',
    MODEL_REJECT: '客户驳回建模稿',
    MODEL_CONFIRM: '客户确认建模稿',
    REVIEW_PASS: '工艺验证通过',
    REVIEW_REJECT: '工艺验证驳回',
    QUOTATION: '报价',
    PRODUCTION_LOG: '生产跟单',
    STATUS_CHANGE: '状态变更',
    DELIVERY_CONFIRM: '客户确认收货'
  }
  return map[type] || type
}

const reload = async () => {
  if (!props.orderId) return
  try {
    events.value = await portalOrderEvents(props.orderId)
  } catch {
    /* 忽略 */
  }
}

const doConfirm = async (eventType: string) => {
  if (!props.orderId) return
  acting.value = true
  try {
    await portalConfirmOrder(props.orderId, eventType)
    message.success('已确认')
    await reload()
    emit('changed')
  } catch (e: unknown) {
    message.error((e as Error)?.message || '操作失败')
  } finally {
    acting.value = false
  }
}

const promptReject = (eventType: string) => {
  let reason = ''
  Modal.confirm({
    title: '驳回原因',
    content: () =>
      h('textarea', {
        rows: 3,
        placeholder: '请输入驳回原因',
        style: 'width: 100%',
        onInput: (e: Event) => {
          reason = (e.target as HTMLTextAreaElement).value
        }
      }),
    onOk: async () => {
      if (!reason.trim()) {
        message.warning('请输入驳回原因')
        return
      }
      if (!props.orderId) return
      acting.value = true
      try {
        await portalRejectOrder(props.orderId, eventType, reason.trim())
        message.success('已驳回')
        await reload()
        emit('changed')
      } catch (e: unknown) {
        message.error((e as Error)?.message || '操作失败')
      } finally {
        acting.value = false
      }
    }
  })
}

const doConfirmDelivery = async () => {
  if (!props.orderId) return
  Modal.confirm({
    title: '确认收货并付尾款？',
    content: '（演示环境，点击即视为已支付尾款）',
    onOk: async () => {
      acting.value = true
      try {
        await portalConfirmDelivery(props.orderId!)
        message.success('已确认收货，订单已完成')
        await reload()
        emit('changed')
      } catch (e: unknown) {
        message.error((e as Error)?.message || '操作失败')
      } finally {
        acting.value = false
      }
    }
  })
}

onMounted(reload)
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
