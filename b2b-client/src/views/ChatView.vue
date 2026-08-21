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
          <span class="conv-title">{{ c.title || c.orderNumber }}</span>
          <span v-if="c.unreadCount" class="conv-badge">{{ c.unreadCount }}</span>
        </div>
        <div class="conv-preview">{{ c.lastMessage || '' }}</div>
      </div>
    </aside>

    <main class="chat-main">
      <div class="chat-members">
        <a-tag v-for="m in members" :key="m.id">{{ m.displayName || m.role }}</a-tag>
      </div>
      <div ref="bodyRef" class="chat-body">
        <div v-if="messages.length === 0" class="chat-empty">暂无消息</div>
        <div
          v-for="m in messages"
          :key="m.id"
          class="msg-row"
          :class="mine(m) ? 'out' : 'in'"
        >
          <div v-if="m.role === 'SYSTEM' || m.msgType === 'event'" class="msg-system">{{ m.content }}</div>
          <template v-else>
            <div class="msg-meta">{{ m.displayName || m.role }}</div>
            <div class="msg-bubble">{{ m.content }}</div>
            <div v-if="m.translatedContent && m.translatedContent !== m.content" class="msg-translation">
              {{ m.translatedContent }}
            </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import {
  listConversations,
  getConversationMessages,
  getConversationMembers,
  sendConversationMessage,
  markConversationRead,
  type Conversation,
  type ConversationMember,
  type ConversationMessage
} from '@/api/index'

const conversations = ref<Conversation[]>([])
const members = ref<ConversationMember[]>([])
const messages = ref<ConversationMessage[]>([])
const currentId = ref<number | null>(null)
const input = ref('')
const sending = ref(false)
const bodyRef = ref<HTMLElement | null>(null)

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
}
.conv-title {
  font-weight: 600;
}
.conv-badge {
  background: #e05d5d;
  color: #fff;
  border-radius: 10px;
  padding: 0 7px;
  font-size: 12px;
}
.conv-preview {
  color: #999;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
}
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
