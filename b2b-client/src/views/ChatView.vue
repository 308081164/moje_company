<template>
  <div class="chat-page">
    <aside class="chat-side">
      <h3 class="chat-side-title">会话</h3>
      <div v-if="conversations.length === 0" class="chat-empty">暂无会话</div>
      <div
        v-for="c in conversations"
        :key="c.id"
        class="conv-item"
        :class="{ active: c.id === currentId }"
        @click="openConversation(c.id)"
      >
        <div class="conv-top">
          <span class="conv-title">{{ c.orderNumber || c.title }}</span>
          <span
            v-if="c.serviceTypeLabel"
            class="conv-type"
            :style="{ background: serviceTypeColorOf(c.serviceType) }"
          >{{ c.serviceTypeLabel }}</span>
          <span v-if="c.unreadCount" class="conv-badge">{{ c.unreadCount }}</span>
        </div>
        <div class="conv-preview">
          <span v-if="c.orderStatusLabel" class="conv-status" :style="{ background: statusColorOf(c.orderStatus) }">
            {{ c.orderStatusLabel }}
          </span>
          <span class="conv-last">{{ c.lastMessage || '' }}</span>
        </div>
      </div>
    </aside>

    <main class="chat-main">
      <div class="chat-members">
        <div v-if="currentConv" class="chat-now">
          <span class="chat-now-avatar" :style="{ background: statusColorOf(currentConv.orderStatus) }">
            {{ (currentConv.orderNumber || currentConv.title || '#').charAt(0) }}
          </span>
          <div class="chat-now-meta">
            <div class="chat-now-order">{{ currentConv.orderNumber || currentConv.title }}</div>
            <span v-if="currentConv.orderStatusLabel" class="chat-now-status" :style="{ background: statusColorOf(currentConv.orderStatus) }">
              {{ currentConv.orderStatusLabel }}
            </span>
          </div>
        </div>
        <div class="chat-member-tags">
          <a-tag v-for="m in members" :key="m.id">{{ m.displayName || m.role }}</a-tag>
        </div>
      </div>
      <div ref="bodyRef" class="chat-body">
        <div v-if="messages.length === 0" class="chat-empty">暂无消息</div>
        <div
          v-for="m in messages"
          :key="m.id"
          class="msg-row"
          :class="mine(m) ? 'out' : 'in'"
        >
          <div v-if="m.role === 'SYSTEM' && m.msgType !== 'event'" class="msg-system">{{ m.content }}</div>
          <div
            v-else-if="m.msgType === 'event' && m.event"
            :class="mineEvent(m) ? 'msg-row-out' : 'msg-row-in'"
          >
            <div
              class="msg-meta"
              :style="{ color: roleColorOf(m.event.actorRole || m.role), textAlign: mineEvent(m) ? 'right' : 'left' }"
            >
              {{ m.event.actorName || m.displayName || m.event.actorRole || m.role }}
            </div>
            <div
              class="msg-card"
              :class="{ 'msg-card--balance': isBalance(m.event) }"
              :style="{ borderTop: '3px solid ' + eventStyleOf(m.event.eventType).color }"
              @click="openDetail(m)"
            >
              <div v-if="m.event.title" class="msg-card-title" :style="{ color: eventStyleOf(m.event.eventType).color }">
                {{ m.event.title }}
              </div>
              <div v-if="(m.event.images || []).length" class="msg-card-imgs">
                <img
                  :src="(m.event.images || [])[0]"
                  class="msg-card-img"
                  alt="design"
                />
                <span v-if="(m.event.images || []).length > 1" class="msg-card-more">+{{ (m.event.images || []).length - 1 }}</span>
              </div>
              <div v-if="m.event.content" class="msg-card-content">{{ m.event.content }}</div>
              <div v-if="m.event.reason" class="msg-card-reason">{{ m.event.reason }}</div>
              <div v-if="m.event.resolution && m.event.resolutionLabel" class="msg-card-lock" :class="'msg-card-lock--' + m.event.resolution.toLowerCase()">
                {{ m.event.resolutionLabel }}{{ m.event.resolution === 'CONFIRM' ? ' ✓' : m.event.resolution === 'REJECT' ? ' ✗' : '' }}
              </div>
              <div v-if="eventActions(m.event)" class="msg-card-actions">
                <a-button size="small" type="primary" @click.stop="confirmEvent(m.event)">确认</a-button>
                <a-button size="small" danger @click.stop="rejectEvent(m.event)">驳回</a-button>
              </div>
            </div>
          </div>
          <template v-else>
            <div class="msg-meta" :style="{ color: roleColorOf(m.role) }">{{ m.displayName || m.role }}</div>
            <div class="msg-bubble">{{ m.content }}</div>
            <div v-if="translationOf(m)" class="msg-translation">{{ translationOf(m) }}</div>
            <button
              v-if="!mine(m) && m.content && m.id"
              class="msg-translate-btn"
              @click="toggleTranslate(m)"
            >
              {{ translationOf(m) ? '显示原文' : '翻译' }}
            </button>
          </template>
        </div>
      </div>
      <div class="chat-composer">
        <a-input
          v-model:value="input"
          placeholder="输入消息…"
          :disabled="currentId == null"
          @press-enter="send"
        />
        <a-button type="primary" :loading="sending" :disabled="currentId == null" @click="send">发送</a-button>
      </div>
    </main>

    <a-modal v-model:open="detailOpen" :footer="null" :width="480" :title="null">
      <div v-if="detail && detail.event">
        <span
          class="event-detail-badge"
          :style="{ background: eventStyleOf(detail.event.eventType).color }"
        >{{ eventStyleOf(detail.event.eventType).label }}</span>
        <div class="event-detail-title" :style="{ color: eventStyleOf(detail.event.eventType).color }">
          {{ detail.event.title || eventStyleOf(detail.event.eventType).label }}
        </div>
        <div class="event-detail-meta">
          {{ detail.event.actorName || detail.displayName || detail.event.actorRole || detail.role }}
          · {{ detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '' }}
        </div>
        <div v-if="(detail.event.images || []).length" class="event-detail-imgs">
          <img
            v-for="(img, i) in detail.event.images"
            :key="i"
            :src="img"
            class="event-detail-img"
            alt=""
          />
        </div>
        <div v-if="detail.event.content" class="event-detail-content">{{ detail.event.content }}</div>
        <div v-if="detail.event.reason" class="event-detail-reason">驳回原因：{{ detail.event.reason }}</div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { message } from 'ant-design-vue'
import {
  listConversations,
  getConversationMessages,
  getConversationMembers,
  sendConversationMessage,
  markConversationRead,
  translateMessage,
  portalConfirmOrder,
  portalRejectOrder,
  type Conversation,
  type ConversationMember,
  type ConversationMessage,
  type OrderEventCard
} from '@/api/index'

const conversations = ref<Conversation[]>([])
const members = ref<ConversationMember[]>([])
const messages = ref<ConversationMessage[]>([])
const currentId = ref<number | null>(null)
const currentOrderId = ref<number | null>(null)
const currentConv = ref<Conversation | null>(null)
const input = ref('')
const sending = ref(false)
const bodyRef = ref<HTMLElement | null>(null)
// 手动翻译结果缓存：messageId -> translatedContent
const translations = ref<Record<number, string>>({})
const detail = ref<ConversationMessage | null>(null)
const detailOpen = ref(false)

function openDetail(m: ConversationMessage) {
  detail.value = m
  detailOpen.value = true
}

const STATUS_COLOR: Record<string, string> = {
  PENDING_DESIGN: '#f59e0b',
  DESIGNING: '#f59e0b',
  PENDING_MODEL: '#4a6fff',
  MODELING: '#4a6fff',
  PENDING_REVIEW: '#8b5cf6',
  PENDING_PRODUCTION: '#8b5cf6',
  PRODUCING: '#22a5f7',
  COMPLETED: '#2ea043',
  CANCELLED: '#999999'
}

function statusColorOf(status?: string) {
  return STATUS_COLOR[status || ''] || '#6b7280'
}

const SERVICE_TYPE_COLOR: Record<string, string> = {
  CUSTOM_IMAGE: '#f59e0b',
  DESIGNER_DESIGN: '#c9a96e',
  B2B_MODEL: '#8b5cf6'
}

function serviceTypeColorOf(type?: string) {
  return SERVICE_TYPE_COLOR[type || ''] || '#6b7280'
}

async function loadConversations() {
  try {
    const list = await listConversations()
    conversations.value = list
    if (list.length && currentId.value == null) {
      await openConversation(list[0].id)
    }
  } catch (e) {
    console.error('获取会话列表失败', e)
  }
}

async function openConversation(id: number) {
  currentId.value = id
  const conv = conversations.value.find((c) => c.id === id)
  currentOrderId.value = conv?.orderId ?? null
  currentConv.value = conv ?? null
  try {
    const [msgs, mems] = await Promise.all([
      getConversationMessages(id),
      getConversationMembers(id)
    ])
    messages.value = msgs
    members.value = mems
    markConversationRead(id).then(loadConversations).catch(() => {})
  } catch (e) {
    console.error('获取会话详情失败', e)
  } finally {
    await nextTick()
    scrollBottom()
  }
}

function mine(m: ConversationMessage) {
  return m.senderType !== 'STAFF' && m.role !== 'SYSTEM'
}

function mineEvent(m: ConversationMessage) {
  return m.event?.actorType !== 'STAFF'
}

const ROLE_HEX: Record<string, string> = {
  CUSTOMER: '#2ea043',
  DESIGNER: '#c9a96e',
  MODELER: '#4a6fff',
  SALES_MID: '#8b5cf6',
  SALES_PRE: '#f59e0b',
  FOLLOW_UP: '#22a5f7',
  SUPER_SERVICE: '#c026d3',
  ADMIN: '#c026d3',
  SYSTEM: '#999999'
}

function roleColorOf(role?: string) {
  return ROLE_HEX[role || ''] || '#999'
}

const EVENT_STYLE: Record<string, { color: string; label: string }> = {
  DESIGN_SUBMIT: { color: '#c9a96e', label: '设计稿' },
  DESIGN_REJECT: { color: '#e05d5d', label: '驳回设计' },
  DESIGN_CONFIRM: { color: '#2ea043', label: '确认设计' },
  MODEL_SUBMIT: { color: '#4a6fff', label: '建模稿' },
  MODEL_REJECT: { color: '#e05d5d', label: '驳回建模' },
  MODEL_CONFIRM: { color: '#2ea043', label: '确认建模' },
  REVIEW_PASS: { color: '#8b5cf6', label: '工艺验证' },
  REVIEW_REJECT: { color: '#e05d5d', label: '工艺驳回' },
  QUOTATION: { color: '#f59e0b', label: '报价' },
  PRODUCTION_LOG: { color: '#22a5f7', label: '生产跟单' },
  SHIPPED: { color: '#2ea043', label: '已发货' },
  DELIVERED: { color: '#2ea043', label: '已签收' },
  STATUS_CHANGE: { color: '#6b7280', label: '状态' },
  DELIVERY_CONFIRM: { color: '#2ea043', label: '交付' },
  BALANCE_PAYMENT: { color: '#d97706', label: '支付尾款' },
  BALANCE_PAID: { color: '#2ea043', label: '已支付' }
}

function eventStyleOf(eventType?: string) {
  return EVENT_STYLE[eventType || ''] || { color: '#6b7280', label: '事件' }
}

function isBalance(ev: OrderEventCard) {
  return ev?.eventType === 'BALANCE_PAYMENT' || ev?.eventType === 'BALANCE_PAID'
}

function translationOf(m: ConversationMessage) {
  return translations.value[m.id] || (m.translatedContent && m.translatedContent !== m.content ? m.translatedContent : '')
}

async function toggleTranslate(m: ConversationMessage) {
  if (translations.value[m.id]) {
    delete translations.value[m.id]
    translations.value = { ...translations.value }
    return
  }
  if (m.translatedContent && m.translatedContent !== m.content) {
    translations.value = { ...translations.value, [m.id]: '' }
    return
  }
  try {
    const dto = await translateMessage(m.id, 'zh-CN')
    translations.value = {
      ...translations.value,
      [m.id]: dto.translatedContent || dto.content || m.content || ''
    }
  } catch (e) {
    message.error((e as Error)?.message || '翻译失败')
  }
}

function eventActions(ev: OrderEventCard) {
  if (!ev?.actionable) return null
  if (ev.eventType === 'DESIGN_SUBMIT') return { confirm: 'DESIGN_CONFIRM', reject: 'DESIGN_REJECT' }
  if (ev.eventType === 'MODEL_SUBMIT') return { confirm: 'MODEL_CONFIRM', reject: 'MODEL_REJECT' }
  return null
}

async function confirmEvent(ev: OrderEventCard) {
  const actions = eventActions(ev)
  if (!actions || !currentOrderId.value) return
  try {
    await portalConfirmOrder(currentOrderId.value, actions.confirm)
    message.success('已确认')
    await openConversation(currentId.value!)
  } catch (e) {
    message.error((e as Error)?.message || '操作失败')
  }
}

async function rejectEvent(ev: OrderEventCard) {
  const actions = eventActions(ev)
  if (!actions || !currentOrderId.value) return
  const reason = window.prompt('请输入驳回原因')
  if (!reason || !reason.trim()) return
  try {
    await portalRejectOrder(currentOrderId.value, actions.reject, reason.trim())
    message.success('已驳回')
    await openConversation(currentId.value!)
  } catch (e) {
    message.error((e as Error)?.message || '操作失败')
  }
}

function scrollBottom() {
  if (bodyRef.value) {
    bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  }
}

async function send() {
  const text = input.value.trim()
  if (!text || currentId.value == null) return
  sending.value = true
  try {
    const msg = await sendConversationMessage(currentId.value, text)
    messages.value.push(msg)
    input.value = ''
    void loadConversations()
  } catch (e) {
    console.error('发送失败', e)
  } finally {
    sending.value = false
    await nextTick()
    scrollBottom()
  }
}

onMounted(() => {
  void loadConversations()
})
</script>

<style scoped>
.chat-page {
  display: flex;
  height: 100vh;
  background: #fff;
}
.chat-side {
  width: 280px;
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.chat-side-title {
  padding: 16px;
  margin: 0;
  border-bottom: 1px solid #eee;
}
.conv-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
}
.conv-item.active {
  background: #f5f5f5;
}
.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}
.conv-title {
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-type {
  flex-shrink: 0;
  font-size: 10px;
  color: #fff;
  padding: 0 6px;
  border-radius: 99px;
  line-height: 1.7;
}
.conv-badge {
  background: #e05d5d;
  color: #fff;
  border-radius: 10px;
  padding: 0 7px;
  font-size: 12px;
  flex-shrink: 0;
}
.conv-preview {
  color: #999;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
}
.conv-status {
  flex-shrink: 0;
  font-size: 11px;
  color: #fff;
  padding: 1px 8px;
  border-radius: 99px;
  line-height: 1.6;
}
.conv-last {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chat-members {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: linear-gradient(180deg, #fff 0%, #fafafa 100%);
}
.chat-now {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.chat-now-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  flex-shrink: 0;
}
.chat-now-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.chat-now-order {
  font-weight: 600;
  font-size: 15px;
  color: #2C2C2C;
  line-height: 1.3;
}
.chat-now-status {
  align-self: flex-start;
  font-size: 11px;
  color: #fff;
  padding: 1px 10px;
  border-radius: 99px;
  line-height: 1.6;
}
.chat-member-tags { display: flex; flex-wrap: wrap; gap: 4px; flex-shrink: 0; }
.chat-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
}
.msg-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 12px;
}
.msg-row.out {
  align-items: flex-end;
}
.msg-row.in {
  align-items: flex-start;
}
.msg-meta {
  color: #999;
  font-size: 12px;
  margin-bottom: 2px;
}
.msg-bubble {
  background: #f0f0f0;
  color: #333;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 70%;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-row.out .msg-bubble {
  background: #1677ff;
  color: #fff;
}
.msg-translation {
  color: #999;
  font-size: 12px;
  margin-top: 2px;
  padding-left: 6px;
  border-left: 2px solid rgba(22, 119, 255, 0.4);
  white-space: pre-wrap;
  word-break: break-word;
  max-width: 70%;
}
.msg-system {
  align-self: center;
  color: #999;
  font-size: 12px;
}
.msg-translate-btn {
  align-self: flex-start;
  background: none;
  border: none;
  color: #1677ff;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  margin-top: 2px;
  opacity: 0.75;
}
.msg-translate-btn:hover { opacity: 1; text-decoration: underline; }
.msg-row-in {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 12px;
}
.msg-row-out {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-bottom: 12px;
}
.msg-card {
  position: relative;
  background:
    radial-gradient(circle at 15% 0%, rgba(22, 119, 255, 0.08) 0, transparent 42%),
    radial-gradient(circle at 90% 100%, rgba(22, 119, 255, 0.05) 0, transparent 50%),
    linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(248,248,250,0.88) 100%);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(0,0,0,0.06);
  border-radius: 16px;
  padding: 12px 14px;
  width: 340px;
  max-width: 100%;
  overflow: hidden;
  box-sizing: border-box;
  box-shadow: 0 10px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.msg-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 38px rgba(0,0,0,0.14), 0 3px 10px rgba(0,0,0,0.06);
}
.msg-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(135deg, rgba(0,0,0,0.008) 0 2px, transparent 2px 12px);
}
.msg-card-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
}
.msg-card-imgs { position: relative; display: flex; flex-wrap: wrap; gap: 0; margin-bottom: 8px; }
.msg-card-img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #eee;
}
.msg-card-more {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 99px;
}
.msg-card-content {
  font-size: 13px;
  line-height: 1.5;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 8px;
}
.msg-card-reason {
  font-size: 12px;
  color: #e05d5d;
  padding-left: 6px;
  border-left: 2px solid rgba(224, 93, 93, 0.5);
}
.msg-card-actions { display: flex; gap: 8px; margin-top: 10px; }
.msg-card--balance {
  border-radius: 999px;
  padding: 14px 18px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 14px;
}
.msg-card--balance .msg-card-title { margin-bottom: 0; flex: 1; }
.msg-card--balance .msg-card-content { margin-bottom: 0; flex: 1; }
.msg-card--balance .msg-card-actions { margin-top: 0; flex-shrink: 0; }
.msg-card-lock {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 99px;
  display: inline-block;
  margin-top: 6px;
}
.msg-card-lock--confirm { color: #1c7c3c; background: rgba(46, 160, 67, 0.15); }
.msg-card-lock--reject { color: #c0392b; background: rgba(224, 93, 93, 0.15); }
.msg-card-lock--paid { color: #1c7c3c; background: rgba(46, 160, 67, 0.15); }
.event-detail-badge {
  display: inline-block;
  font-size: 12px;
  color: #fff;
  padding: 2px 10px;
  border-radius: 99px;
  margin-bottom: 10px;
}
.event-detail-title {
  font-weight: 600;
  font-size: 16px;
  margin-bottom: 6px;
}
.event-detail-meta {
  font-size: 12px;
  color: #999;
  margin-bottom: 14px;
}
.event-detail-imgs { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.event-detail-img { width: 100%; border-radius: 10px; border: 1px solid #eee; }
.event-detail-content {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}
.event-detail-reason {
  font-size: 13px;
  color: #d9534f;
  margin-top: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(224, 93, 93, 0.08);
  border-left: 3px solid #e05d5d;
}
.chat-empty {
  color: #bbb;
  text-align: center;
  padding: 40px 0;
}
.chat-composer {
  padding: 12px 16px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 8px;
}
</style>
