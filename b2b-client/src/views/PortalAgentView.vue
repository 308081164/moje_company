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
              <div class="agent-compose-box">
                <div v-if="pendingPreviews.length" class="pending-images compose-pending">
                  <div v-for="p in pendingPreviews" :key="p.id" class="pending-thumb">
                    <img :src="p.url" alt="待发送" />
                    <button type="button" class="pending-remove" aria-label="移除" @click="removePending(p.id)">×</button>
                  </div>
                </div>
                <textarea
                  ref="inputAreaRef"
                  v-model="inputText"
                  class="agent-textarea"
                  rows="3"
                  placeholder="描述定制需求；可添加参考图，点击发送后一并提交…"
                  :disabled="sending"
                  @input="resizeInputArea"
                  @keydown.enter.exact.prevent="sendMessage"
                />
                <div class="agent-compose-toolbar">
                  <div class="toolbar-left">
                    <a-upload
                      :before-upload="onPickImage"
                      :show-upload-list="false"
                      accept="image/*"
                      multiple
                    >
                      <button type="button" class="compose-icon-btn" :disabled="sending" title="添加图片">
                        <PictureOutlined />
                      </button>
                    </a-upload>
                    <button
                      type="button"
                      class="compose-icon-btn"
                      :class="{ 'compose-icon-btn--active': recording }"
                      :disabled="sending || !voiceAvailable"
                      :title="voiceButtonTitle"
                      @click="onVoiceButtonClick"
                    >
                      <AudioOutlined />
                    </button>
                  </div>
                  <button
                    type="button"
                    class="compose-send-btn"
                    :disabled="!canSend"
                    :aria-busy="sending"
                    title="发送"
                    @click="sendMessage"
                  >
                    <span v-if="sending" class="send-spinner" />
                    <span v-else class="send-arrow">↑</span>
                  </button>
                </div>
              </div>
              <p v-if="recording" class="voice-hint">{{ voiceHintText }}</p>
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
import {
  createSpeechRecognition,
  detectVoiceInputCapability,
  extensionForMime,
  type VoiceInputMode
} from '@/utils/voiceInput'
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
const inputAreaRef = ref<HTMLTextAreaElement | null>(null)
const pendingFiles = ref<File[]>([])
const pendingPreviews = ref<PendingPreview[]>([])
const pendingOptimisticIds = ref<Set<number>>(new Set())
const recording = ref(false)
const voiceCapability = ref(detectVoiceInputCapability())
const voiceMode = ref<VoiceInputMode>(voiceCapability.value.mode)
const voiceAvailable = computed(() => voiceCapability.value.available)
const voiceMimeType = ref(voiceCapability.value.mimeType || 'audio/webm')

const voiceButtonTitle = computed(() => {
  if (!voiceAvailable.value) return '当前浏览器不支持语音输入'
  if (recording.value) {
    return voiceMode.value === 'speech-recognition' ? '点击结束聆听' : '点击结束录音'
  }
  return voiceMode.value === 'speech-recognition'
    ? '点击开始语音输入（浏览器识别）'
    : '点击开始录音，再次点击结束并识别'
})

const voiceHintText = computed(() =>
  voiceMode.value === 'speech-recognition' ? '正在聆听，请说话…' : '正在录音，再次点击麦克风结束…'
)

let mediaRecorder: MediaRecorder | null = null
let mediaStream: MediaStream | null = null
let voiceChunks: Blob[] = []
let speechRecognition: SpeechRecognition | null = null

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

function resizeInputArea() {
  const el = inputAreaRef.value
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(Math.max(el.scrollHeight, 72), 200)
  el.style.height = `${next}px`
}

function appendVoiceText(text: string) {
  const t = text.trim()
  if (!t) return
  inputText.value = inputText.value ? `${inputText.value} ${t}` : t
  nextTick(resizeInputArea)
  message.success('语音识别完成，可编辑后点击发送')
}

function cleanupMediaStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
}

function stopSpeechRecognition() {
  if (speechRecognition) {
    try {
      speechRecognition.stop()
    } catch {
      /* ignore */
    }
    speechRecognition = null
  }
}

async function startMediaRecorderVoice() {
  const mime = voiceMimeType.value
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  mediaStream = stream
  voiceChunks = []
  mediaRecorder = new MediaRecorder(stream, { mimeType: mime })
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) voiceChunks.push(e.data)
  }
  mediaRecorder.onstop = () => {
    cleanupMediaStream()
    mediaRecorder = null
    void handleVoiceStop()
  }
  mediaRecorder.start()
  recording.value = true
}

function stopMediaRecorderVoice() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    recording.value = false
    cleanupMediaStream()
    return
  }
  mediaRecorder.stop()
  recording.value = false
}

function startBrowserSpeechRecognition() {
  const recognition = createSpeechRecognition()
  if (!recognition) {
    message.error('当前浏览器不支持语音输入')
    return
  }
  speechRecognition = recognition
  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const text = event.results?.[0]?.[0]?.transcript
    if (text) appendVoiceText(text)
  }
  recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    if (event.error !== 'aborted') {
      message.error(`语音识别失败：${event.error}`)
    }
  }
  recognition.onend = () => {
    recording.value = false
    speechRecognition = null
  }
  try {
    recognition.start()
    recording.value = true
  } catch {
    recording.value = false
    speechRecognition = null
    message.error('无法启动语音识别，请检查麦克风权限')
  }
}

async function onVoiceButtonClick() {
  if (!voiceAvailable.value || sending.value) return
  if (recording.value) {
    if (voiceMode.value === 'speech-recognition') {
      stopSpeechRecognition()
      recording.value = false
    } else {
      stopMediaRecorderVoice()
    }
    return
  }
  if (voiceMode.value === 'speech-recognition') {
    startBrowserSpeechRecognition()
    return
  }
  try {
    await startMediaRecorderVoice()
  } catch {
    message.error('无法访问麦克风，请在浏览器设置中允许麦克风权限')
  }
}

async function handleVoiceStop() {
  if (!voiceChunks.length) {
    message.warning('未录到有效语音，请重试')
    return
  }
  const mime = voiceChunks[0]?.type || voiceMimeType.value
  const blob = new Blob(voiceChunks, { type: mime })
  voiceChunks = []
  if (blob.size < 800) {
    message.warning('录音太短，请重试')
    return
  }
  const ext = extensionForMime(mime)
  sending.value = true
  try {
    const { text } = await agentSpeechToText(blob, `voice.${ext}`)
    if (text) appendVoiceText(text)
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
  voiceCapability.value = detectVoiceInputCapability()
  voiceMode.value = voiceCapability.value.mode
  voiceMimeType.value = voiceCapability.value.mimeType || 'audio/webm'
  syncToken()
  if (b2bToken.value) {
    await initSession()
  }
  nextTick(resizeInputArea)
})

onUnmounted(() => {
  clearPending()
  stopSpeechRecognition()
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  cleanupMediaStream()
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

.agent-compose-box {
  border: 1px solid #e8e8e8;
  border-radius: 16px;
  background: #f7f7f8;
  padding: 12px 14px 10px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.compose-pending {
  margin-bottom: 10px;
}

.agent-textarea {
  width: 100%;
  min-height: 72px;
  max-height: 200px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: #1a1a1a;
  font-size: 16px;
  line-height: 1.55;
  padding: 0;
  margin-bottom: 10px;
  font-family: inherit;
}

.agent-textarea::placeholder {
  color: #999;
}

.agent-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.agent-compose-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.compose-icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid #ddd;
  background: #fff;
  color: #555;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}

.compose-icon-btn:hover:not(:disabled) {
  border-color: #c9a962;
  background: rgba(201, 169, 98, 0.12);
}

.compose-icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.compose-icon-btn--active {
  border-color: #c9a962;
  background: rgba(201, 169, 98, 0.2);
  color: #5c4d2e;
}

.compose-send-btn {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(145deg, #d4af37 0%, #8b7355 100%);
  color: #1a1814;
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.compose-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-arrow {
  display: block;
  transform: translateY(-1px);
}

.send-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(26, 24, 20, 0.25);
  border-top-color: #1a1814;
  border-radius: 50%;
  animation: send-spin 0.7s linear infinite;
}

@keyframes send-spin {
  to {
    transform: rotate(360deg);
  }
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
