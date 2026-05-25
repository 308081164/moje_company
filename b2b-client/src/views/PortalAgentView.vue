<template>
  <div class="b2b-portal-container agent-portal-page">
    <div class="b2b-portal-background"></div>
    <div class="b2b-portal-content agent-layout">
      <a-card class="b2b-portal-card agent-card" :bordered="false">
        <div class="portal-header agent-header">
          <router-link to="/" class="back-btn"><HomeOutlined /> 返回首页</router-link>
          <template v-if="b2bToken">
            <router-link to="/portal/form" class="back-btn">传统表单录入</router-link>
            <router-link to="/portal/b2b/my-orders" class="back-btn">我的订单</router-link>
            <a-button type="link" @click="historyOpen = true">历史对话</a-button>
            <a-button type="link" danger @click="b2bLogout">退出</a-button>
          </template>
        </div>

        <!-- 未登录：登录注册页 -->
        <div v-if="!b2bToken" class="agent-auth-panel">
          <div class="auth-panel-intro">
            <h2>恒鎏珠宝AI建模平台 · 需求录入</h2>
            <p>请先登录或注册 B 端账号，登录后将进入智能助理对话，引导您完成定制需求提交。</p>
          </div>
          <a-tabs v-model:activeKey="loginTab" class="auth-tabs">
            <a-tab-pane key="login" tab="登录">
              <a-form layout="vertical" :model="loginForm" @finish="doLogin">
                <a-form-item label="手机号" name="contact" :rules="[{ required: true }]">
                  <a-input v-model:value="loginForm.contact" size="large" />
                </a-form-item>
                <a-form-item label="密码" name="password" :rules="[{ required: true }]">
                  <a-input-password v-model:value="loginForm.password" size="large" />
                </a-form-item>
                <a-button type="primary" html-type="submit" block size="large" :loading="authLoading">登录并进入对话</a-button>
              </a-form>
            </a-tab-pane>
            <a-tab-pane key="register" tab="注册">
              <a-form layout="vertical" :model="registerForm" @finish="doRegister">
                <a-form-item label="手机号" name="contact" :rules="[{ required: true }]">
                  <a-input v-model:value="registerForm.contact" size="large" />
                </a-form-item>
                <a-form-item label="密码" name="password" :rules="[{ required: true }]">
                  <a-input-password v-model:value="registerForm.password" size="large" />
                </a-form-item>
                <a-button type="primary" html-type="submit" block size="large" :loading="authLoading">注册并进入对话</a-button>
              </a-form>
            </a-tab-pane>
          </a-tabs>
        </div>

        <!-- 已登录：Agent 对话 -->
        <template v-else>
          <div class="agent-body">
            <div class="agent-quick-bar">
              <a-button type="primary" ghost block @click="$router.push('/portal/b2b/my-orders')">
                查看我的订单进度
              </a-button>
            </div>

            <div ref="msgBoxRef" class="agent-messages">
              <div
                v-for="(m, index) in messages"
                :key="messageKey(m, index)"
                :class="['msg-row', m.role, { 'msg-pending': isOptimistic(m) }]"
              >
                <div class="msg-bubble">
                  <div v-if="m.content" class="msg-text">{{ m.content }}</div>
                  <div v-if="payloadImages(m).length" class="msg-images">
                    <a-image v-for="(u, i) in payloadImages(m)" :key="i" :src="u" :width="80" :height="80" />
                  </div>
                  <div v-if="m.payload?.orderResult" class="order-result-block">
                    <p><strong>订单编号：</strong>{{ m.payload.orderResult.orderNumber }}</p>
                    <a :href="m.payload.orderResult.accessUrl" target="_blank" rel="noopener">打开进度链接</a>
                    <img
                      v-if="m.payload.orderResult.qrcodeBase64"
                      :src="m.payload.orderResult.qrcodeBase64"
                      alt="二维码"
                      class="qrcode-image"
                    />
                  </div>
                  <img
                    v-if="m.payload?.supportWecomQrUrl"
                    :src="m.payload.supportWecomQrUrl"
                    alt="企微客服"
                    class="qrcode-image"
                  />
                </div>
              </div>

              <div v-if="sending" class="msg-row assistant">
                <div class="msg-bubble typing-bubble">
                  <span class="typing-dots" aria-hidden="true"><i /><i /><i /></span>
                  <span class="typing-label">Agent 正在回复…</span>
                </div>
              </div>

              <div v-if="showConfirmCard && draft" class="confirm-card">
                <h4>请确认订单信息</h4>
                <p><strong>基础需求：</strong>{{ draft.basicRequirements || '—' }}</p>
                <p><strong>款式：</strong>{{ draft.styleInfo || draft.jewelryType || '—' }}</p>
                <p><strong>材质：</strong>{{ draft.materialInfo || '—' }}</p>
                <p v-if="draft.companyName"><strong>公司：</strong>{{ draft.companyName }}</p>
                <p v-if="draft.contactPerson"><strong>联系人：</strong>{{ draft.contactPerson }}</p>
                <div v-if="draft.referenceImageUrls?.length" class="msg-images">
                  <a-image
                    v-for="(u, i) in draft.referenceImageUrls"
                    :key="'d' + i"
                    :src="u"
                    :width="72"
                    :height="72"
                  />
                </div>
                <a-button type="primary" block :loading="commitLoading" @click="confirmOpen = true">
                  创建工单
                </a-button>
              </div>
            </div>

            <div v-if="session?.readOnly" class="agent-readonly-hint">
              当前为历史会话，仅可查看，无法继续发送消息。
            </div>
            <div v-else class="agent-compose">
              <div v-if="pendingPreviews.length" class="pending-images">
                <div v-for="p in pendingPreviews" :key="p.id" class="pending-thumb">
                  <img :src="p.url" alt="待发送" />
                  <button type="button" class="pending-remove" aria-label="移除" @click="removePending(p.id)">×</button>
                </div>
              </div>
              <div class="agent-input-bar">
                <a-upload
                  :before-upload="onPickImage"
                  :show-upload-list="false"
                  accept="image/*"
                  multiple
                >
                  <a-button :disabled="sending" title="添加图片"><PictureOutlined /></a-button>
                </a-upload>
                <a-button
                  :disabled="sending || !voiceSupported"
                  :type="recording ? 'primary' : 'default'"
                  :danger="recording"
                  :title="voiceSupported ? '按住说话，松开发送识别' : '当前浏览器不支持语音'"
                  @mousedown.prevent="startVoice"
                  @mouseup.prevent="stopVoice"
                  @mouseleave="stopVoice"
                  @touchstart.prevent="startVoice"
                  @touchend.prevent="stopVoice"
                >
                  <AudioOutlined />
                </a-button>
                <a-input
                  v-model:value="inputText"
                  placeholder="描述定制需求；图片会先进入暂存区，点击发送后一并提交…"
                  :disabled="sending"
                  @press-enter="sendMessage"
                />
                <a-button
                  type="primary"
                  :loading="sending"
                  :disabled="!canSend"
                  @click="sendMessage"
                >
                  发送
                </a-button>
              </div>
              <p v-if="recording" class="voice-hint">正在录音，松开后识别为文字…</p>
            </div>
          </div>
        </template>
      </a-card>
    </div>

    <a-modal v-model:open="confirmOpen" title="二次确认" @ok="doCommit">
      <p>确认根据当前卡片信息创建正式工单？创建后可在「我的订单」查看进度。</p>
    </a-modal>

    <a-drawer v-model:open="historyOpen" title="历史对话" width="360">
      <a-list :data-source="historySessions" :loading="historyLoading">
        <template #renderItem="{ item }">
          <a-list-item class="history-item" @click="openHistory(item)">
            <a-list-item-meta :title="item.status" :description="formatTime(item.createdAt)" />
          </a-list-item>
        </template>
      </a-list>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import { HomeOutlined, PictureOutlined, AudioOutlined } from '@ant-design/icons-vue'
import {
  agentCreateSession,
  agentSendMessage,
  agentCommit,
  agentBindSession,
  agentListSessions,
  agentGetSession,
  agentSpeechToText,
  type B2bAgentChatResponse,
  type B2bAgentDraft,
  type B2bAgentMessage,
  type B2bAgentSession
} from '@/api/agent'
import { loginClient, registerClient } from '@/api'
import { clearB2bToken, getB2bTokenRaw, isB2bTokenExpiredOrInvalid, setB2bToken } from '@/utils/b2bAuth'

const SESSION_TOKEN_KEY = 'moje_b2b_agent_session_token'
const SESSION_ID_KEY = 'moje_b2b_agent_session_id'

const OPTIMISTIC_ID_START = -1_000_000_000_000
let optimisticSeq = 0

interface PendingPreview {
  id: string
  file: File
  url: string
}

const b2bToken = ref(!!getB2bTokenRaw())
const session = ref<B2bAgentSession | null>(null)
const messages = ref<B2bAgentMessage[]>([])
const draft = ref<B2bAgentDraft | null>(null)
const showConfirmCard = ref(false)
const inputText = ref('')
const sending = ref(false)
const commitLoading = ref(false)
const loginTab = ref('login')
const authLoading = ref(false)
const confirmOpen = ref(false)
const historyOpen = ref(false)
const historySessions = ref<B2bAgentSession[]>([])
const historyLoading = ref(false)
const msgBoxRef = ref<HTMLElement | null>(null)
const pendingFiles = ref<File[]>([])
const pendingPreviews = ref<PendingPreview[]>([])
const pendingOptimisticIds = ref<Set<number>>(new Set())
const recording = ref(false)
const voiceSupported = ref(
  typeof window !== 'undefined' &&
    !!(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
)

let mediaRecorder: MediaRecorder | null = null
let voiceChunks: Blob[] = []

const loginForm = ref({ contact: '', password: '' })
const registerForm = ref({ contact: '', password: '' })

const publicToken = computed(() => localStorage.getItem(SESSION_TOKEN_KEY) || '')

const canSend = computed(() => {
  if (sending.value || session.value?.readOnly) return false
  return Boolean(inputText.value.trim()) || pendingFiles.value.length > 0
})

function syncToken() {
  const raw = getB2bTokenRaw()
  if (raw && isB2bTokenExpiredOrInvalid(raw)) {
    clearB2bToken()
    b2bToken.value = false
    return
  }
  b2bToken.value = !!raw
}

function sessionHeaders() {
  return { 'X-B2B-Agent-Session-Token': publicToken.value }
}

function isOptimistic(m: B2bAgentMessage): boolean {
  return typeof m.id === 'number' && m.id < 0
}

function messageKey(m: B2bAgentMessage, index: number): string {
  if (m.id != null) return `msg-${m.id}`
  return `msg-${index}-${m.role}-${String(m.createdAt ?? '')}`
}

function nextOptimisticId(): number {
  optimisticSeq += 1
  return OPTIMISTIC_ID_START - optimisticSeq
}

function pushOptimisticUser(text: string, imageCount: number): number {
  const id = nextOptimisticId()
  pendingOptimisticIds.value.add(id)
  const previewUrls = pendingPreviews.value.map((p) => p.url)
  const content =
    text ||
    (imageCount > 0 ? (imageCount > 1 ? `（${imageCount} 张图片）` : '（参考图）') : '')
  messages.value = [
    ...messages.value,
    {
      id,
      role: 'user',
      content,
      payload: previewUrls.length ? { imageUrls: [...previewUrls] } : undefined
    }
  ]
  scrollBottom()
  return id
}

function applySession(s: B2bAgentSession) {
  session.value = s
  messages.value = [...(s.messages ?? [])]
  draft.value = s.draft ?? null
  showConfirmCard.value = Boolean(s.draft?.readyForConfirm) && !s.readOnly
  localStorage.setItem(SESSION_TOKEN_KEY, s.publicToken)
  localStorage.setItem(SESSION_ID_KEY, String(s.sessionId))
  pendingOptimisticIds.value.clear()
  scrollBottom()
}

function applyChatResponse(res: B2bAgentChatResponse) {
  applySession(res.session)
  if (res.showConfirmCard !== undefined) {
    showConfirmCard.value = res.showConfirmCard
  }
}

async function initSession() {
  const s = await agentCreateSession()
  applySession(s)
  try {
    await agentBindSession(s.sessionId, s.publicToken)
  } catch {
    /* ignore */
  }
}

function scrollBottom() {
  nextTick(() => {
    requestAnimationFrame(() => {
      const el = msgBoxRef.value
      if (el) el.scrollTop = el.scrollHeight
    })
  })
}

function payloadImages(m: B2bAgentMessage): string[] {
  const urls = m.payload?.imageUrls
  return Array.isArray(urls) ? urls : []
}

function formatTime(t?: string) {
  return t ? String(t).replace('T', ' ').slice(0, 16) : ''
}

function addPendingFile(file: File) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const url = URL.createObjectURL(file)
  pendingFiles.value = [...pendingFiles.value, file]
  pendingPreviews.value = [...pendingPreviews.value, { id, file, url }]
}

function clearPending() {
  for (const p of pendingPreviews.value) {
    URL.revokeObjectURL(p.url)
  }
  pendingFiles.value = []
  pendingPreviews.value = []
}

function removePending(id: string) {
  const item = pendingPreviews.value.find((p) => p.id === id)
  if (item) URL.revokeObjectURL(item.url)
  pendingPreviews.value = pendingPreviews.value.filter((p) => p.id !== id)
  pendingFiles.value = pendingPreviews.value.map((p) => p.file)
}

function onPickImage(file: File) {
  if (!file.type.startsWith('image/')) {
    message.warning('仅支持图片格式')
    return false
  }
  addPendingFile(file)
  return false
}

async function sendMessage() {
  if (!session.value || session.value.readOnly || sending.value) return
  const text = inputText.value.trim()
  const images = [...pendingFiles.value]
  if (!text && images.length === 0) return

  const savedText = text
  const savedImages = images
  inputText.value = ''
  clearPending()

  const optimisticId = pushOptimisticUser(savedText, savedImages.length)
  sending.value = true
  try {
    const res = await agentSendMessage(
      session.value.sessionId,
      { text: savedText || undefined, images: savedImages.length ? savedImages : undefined },
      sessionHeaders()
    )
    applyChatResponse(res)
  } catch (e: unknown) {
    pendingOptimisticIds.value.delete(optimisticId)
    messages.value = messages.value.filter((m) => m.id !== optimisticId)
    inputText.value = savedText
    for (const f of savedImages) addPendingFile(f)
    message.error(String((e as Error)?.message || e))
  } finally {
    sending.value = false
  }
}

async function startVoice() {
  if (!voiceSupported.value || recording.value || sending.value) return
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    voiceChunks = []
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'
    mediaRecorder = new MediaRecorder(stream, { mimeType: mime })
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) voiceChunks.push(e.data)
    }
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      void handleVoiceStop()
    }
    mediaRecorder.start()
    recording.value = true
  } catch {
    message.error('无法访问麦克风，请检查浏览器权限')
  }
}

function stopVoice() {
  if (!recording.value || !mediaRecorder) return
  if (mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  recording.value = false
}

async function handleVoiceStop() {
  if (!voiceChunks.length) return
  const blob = new Blob(voiceChunks, { type: voiceChunks[0]?.type || 'audio/webm' })
  voiceChunks = []
  if (blob.size < 800) {
    message.warning('录音太短，请重试')
    return
  }
  sending.value = true
  try {
    const { text } = await agentSpeechToText(blob)
    if (text) {
      inputText.value = inputText.value ? `${inputText.value} ${text}` : text
      message.success('语音识别完成，可编辑后点击发送')
    }
  } catch (e: unknown) {
    message.error(String((e as Error)?.message || e))
  } finally {
    sending.value = false
  }
}

async function doCommit() {
  if (!session.value) return
  commitLoading.value = true
  sending.value = true
  try {
    const res = await agentCommit(session.value.sessionId, sessionHeaders())
    applyChatResponse(res)
    showConfirmCard.value = false
    confirmOpen.value = false
    message.success('工单已创建')
  } catch (e: unknown) {
    message.error(String((e as Error)?.message || e))
  } finally {
    commitLoading.value = false
    sending.value = false
  }
}

async function doLogin() {
  authLoading.value = true
  try {
    const r = await loginClient(loginForm.value)
    setB2bToken(r.accessToken)
    b2bToken.value = true
    await initSession()
    message.success('登录成功')
  } catch (e: unknown) {
    message.error(String((e as Error)?.message || e))
  } finally {
    authLoading.value = false
  }
}

async function doRegister() {
  authLoading.value = true
  try {
    const r = await registerClient(registerForm.value)
    setB2bToken(r.accessToken)
    b2bToken.value = true
    await initSession()
    message.success('注册成功')
  } catch (e: unknown) {
    message.error(String((e as Error)?.message || e))
  } finally {
    authLoading.value = false
  }
}

function b2bLogout() {
  clearB2bToken()
  b2bToken.value = false
  session.value = null
  messages.value = []
  draft.value = null
  showConfirmCard.value = false
  clearPending()
  localStorage.removeItem(SESSION_TOKEN_KEY)
  localStorage.removeItem(SESSION_ID_KEY)
  message.success('已退出')
}

async function loadHistory() {
  if (!b2bToken.value) return
  historyLoading.value = true
  try {
    historySessions.value = await agentListSessions()
  } catch {
    historySessions.value = []
  } finally {
    historyLoading.value = false
  }
}

async function openHistory(item: B2bAgentSession) {
  const s = await agentGetSession(item.sessionId, item.publicToken)
  applySession(s)
  historyOpen.value = false
}

onMounted(async () => {
  syncToken()
  if (b2bToken.value) {
    await initSession()
  }
})

onUnmounted(() => {
  clearPending()
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
})

watch(historyOpen, (v) => {
  if (v) void loadHistory()
})

watch(messages, () => scrollBottom(), { deep: true })
watch(sending, (v) => {
  if (v) scrollBottom()
})
</script>

<style scoped>
.agent-portal-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.agent-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
  min-height: calc(100vh - 80px);
  padding-bottom: 16px;
}

.agent-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 80px);
}

.agent-card :deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 20px 24px 24px;
}

.agent-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.agent-auth-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 24px 8px 48px;
  max-width: 420px;
  margin: 0 auto;
  width: 100%;
}

.auth-panel-intro {
  text-align: center;
  margin-bottom: 24px;
}

.auth-panel-intro h2 {
  font-size: 1.35rem;
  margin-bottom: 8px;
  color: #1a1a1a;
}

.auth-panel-intro p {
  color: #666;
  line-height: 1.6;
}

.agent-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.agent-quick-bar {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.agent-messages {
  flex: 1;
  min-height: 200px;
  overflow-y: auto;
  padding: 8px 4px;
  margin-bottom: 12px;
}

.agent-compose {
  flex-shrink: 0;
  border-top: 1px solid rgba(212, 175, 55, 0.2);
  padding-top: 12px;
}

.pending-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.pending-thumb {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(212, 175, 55, 0.4);
}

.pending-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pending-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.msg-row {
  display: flex;
  margin-bottom: 10px;
}

.msg-row.user {
  justify-content: flex-end;
}

.msg-row.assistant {
  justify-content: flex-start;
}

.msg-row.msg-pending .msg-bubble {
  opacity: 0.85;
}

.msg-bubble {
  max-width: 88%;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(212, 175, 55, 0.25);
}

.msg-row.user .msg-bubble {
  background: rgba(212, 175, 55, 0.15);
}

.msg-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.typing-bubble {
  display: flex;
  align-items: center;
  gap: 10px;
}

.typing-label {
  color: #bbb;
  font-size: 13px;
}

.typing-dots {
  display: inline-flex;
  gap: 4px;
}

.typing-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d4af37;
  animation: typing-bounce 1.2s infinite ease-in-out;
}

.typing-dots i:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dots i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.confirm-card {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid #d4af37;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.2);
}

.agent-input-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.agent-input-bar .ant-input {
  flex: 1;
}

.agent-readonly-hint {
  text-align: center;
  color: #999;
  padding: 12px;
  flex-shrink: 0;
}

.voice-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #d4af37;
  text-align: center;
}

.history-item {
  cursor: pointer;
}

.order-result-block {
  margin-top: 8px;
}
</style>
