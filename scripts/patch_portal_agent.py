#!/usr/bin/env python3
"""One-shot patch for PortalAgentView.vue"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'b2b-client/src/views/PortalAgentView.vue'
text = TARGET.read_text(encoding='utf-8')

text = text.replace('MOJE 珠宝定制 · 需求录入', '恒鎏珠宝AI建模平台 · 需求录入')

compose_old = """            <div v-else class=\"agent-compose\">
              <div v-if=\"pendingPreviews.length\" class=\"pending-images\">
                <div v-for=\"p in pendingPreviews\" :key=\"p.id\" class=\"pending-thumb\">
                  <img :src=\"p.url\" alt=\"待发送\" />
                  <button type=\"button\" class=\"pending-remove\" aria-label=\"移除\" @click=\"removePending(p.id)\">×</button>
                </div>
              </div>
              <div class=\"agent-input-bar\">
                <a-upload
                  :before-upload=\"onPickImage\"
                  :show-upload-list=\"false\"
                  accept=\"image/*\"
                  multiple
                >
                  <a-button :disabled=\"sending\" title=\"添加图片\"><PictureOutlined /></a-button>
                </a-upload>
                <a-button
                  :disabled=\"sending || !voiceSupported\"
                  :type=\"recording ? 'primary' : 'default'\"
                  :danger=\"recording\"
                  :title=\"voiceSupported ? '按住说话，松开发送识别' : '当前浏览器不支持语音'\"
                  @mousedown.prevent=\"startVoice\"
                  @mouseup.prevent=\"stopVoice\"
                  @mouseleave=\"stopVoice\"
                  @touchstart.prevent=\"startVoice\"
                  @touchend.prevent=\"stopVoice\"
                >
                  <AudioOutlined />
                </a-button>
                <a-input
                  v-model:value=\"inputText\"
                  placeholder=\"描述定制需求；图片会先进入暂存区，点击发送后一并提交…\"
                  :disabled=\"sending\"
                  @press-enter=\"sendMessage\"
                />
                <a-button
                  type=\"primary\"
                  :loading=\"sending\"
                  :disabled=\"!canSend\"
                  @click=\"sendMessage\"
                >
                  发送
                </a-button>
              </div>
              <p v-if=\"recording\" class=\"voice-hint\">正在录音，松开后识别为文字…</p>
            </div>"""

compose_new = """            <div v-else class=\"agent-compose\">
              <div class=\"agent-compose-box\">
                <div v-if=\"pendingPreviews.length\" class=\"pending-images compose-pending\">
                  <div v-for=\"p in pendingPreviews\" :key=\"p.id\" class=\"pending-thumb\">
                    <img :src=\"p.url\" alt=\"待发送\" />
                    <button type=\"button\" class=\"pending-remove\" aria-label=\"移除\" @click=\"removePending(p.id)\">×</button>
                  </div>
                </div>
                <textarea
                  ref=\"inputAreaRef\"
                  v-model=\"inputText\"
                  class=\"agent-textarea\"
                  rows=\"3\"
                  placeholder=\"描述定制需求；可添加参考图，点击发送后一并提交…\"
                  :disabled=\"sending\"
                  @input=\"resizeInputArea\"
                  @keydown.enter.exact.prevent=\"sendMessage\"
                />
                <div class=\"agent-compose-toolbar\">
                  <div class=\"toolbar-left\">
                    <a-upload
                      :before-upload=\"onPickImage\"
                      :show-upload-list=\"false\"
                      accept=\"image/*\"
                      multiple
                    >
                      <button type=\"button\" class=\"compose-icon-btn\" :disabled=\"sending\" title=\"添加图片\">
                        <PictureOutlined />
                      </button>
                    </a-upload>
                    <button
                      type=\"button\"
                      class=\"compose-icon-btn\"
                      :class=\"{ 'compose-icon-btn--active': recording }\"
                      :disabled=\"sending || !voiceAvailable\"
                      :title=\"voiceButtonTitle\"
                      @click=\"onVoiceButtonClick\"
                    >
                      <AudioOutlined />
                    </button>
                  </div>
                  <button
                    type=\"button\"
                    class=\"compose-send-btn\"
                    :disabled=\"!canSend\"
                    :aria-busy=\"sending\"
                    title=\"发送\"
                    @click=\"sendMessage\"
                  >
                    <span v-if=\"sending\" class=\"send-spinner\" />
                    <span v-else class=\"send-arrow\">↑</span>
                  </button>
                </div>
              </div>
              <p v-if=\"recording\" class=\"voice-hint\">{{ voiceHintText }}</p>
            </div>"""

if 'agent-compose-box' not in text:
    if compose_old not in text:
        raise SystemExit('compose_old not found')
    text = text.replace(compose_old, compose_new)

import_old = "import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'\nimport { message } from 'ant-design-vue'"
import_new = """import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue'
import {
  createSpeechRecognition,
  detectVoiceInputCapability,
  extensionForMime,
  type VoiceInputMode
} from '@/utils/voiceInput'
import { message } from 'ant-design-vue'"""
if '@/utils/voiceInput' not in text:
    text = text.replace(import_old, import_new)

voice_old = """const msgBoxRef = ref<HTMLElement | null>(null)
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
let voiceChunks: Blob[] = []"""

voice_new = """const msgBoxRef = ref<HTMLElement | null>(null)
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
let speechRecognition: SpeechRecognition | null = null"""

if 'voiceAvailable' not in text:
    if voice_old not in text:
        raise SystemExit('voice_old not found')
    text = text.replace(voice_old, voice_new)

funcs_old = """async function startVoice() {
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
}"""

funcs_new = Path(ROOT / 'scripts/patch_portal_agent_voice_funcs.txt').read_text(encoding='utf-8')

if 'onVoiceButtonClick' not in text:
    if funcs_old not in text:
        raise SystemExit('funcs_old not found')
    text = text.replace(funcs_old, funcs_new)

mounted_old = """onMounted(async () => {
  syncToken()
  if (b2bToken.value) {
    await initSession()
  }
})"""

mounted_new = """onMounted(async () => {
  voiceCapability.value = detectVoiceInputCapability()
  voiceMode.value = voiceCapability.value.mode
  voiceMimeType.value = voiceCapability.value.mimeType || 'audio/webm'
  syncToken()
  if (b2bToken.value) {
    await initSession()
  }
  nextTick(resizeInputArea)
})"""

if 'voiceCapability.value = detectVoiceInputCapability' not in text:
    text = text.replace(mounted_old, mounted_new)

unmounted_old = """onUnmounted(() => {
  clearPending()
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
})"""

unmounted_new = """onUnmounted(() => {
  clearPending()
  stopSpeechRecognition()
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  cleanupMediaStream()
})"""

if 'stopSpeechRecognition' not in text:
    text = text.replace(unmounted_old, unmounted_new)

styles_old = """.agent-input-bar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.agent-input-bar .ant-input {
  flex: 1;
}

.agent-readonly-hint {"""

styles_new = Path(ROOT / 'scripts/patch_portal_agent_styles.txt').read_text(encoding='utf-8')

if '.agent-compose-box' not in text:
    if styles_old not in text:
        raise SystemExit('styles_old not found')
    text = text.replace(styles_old, styles_new)

tmp = TARGET.with_suffix('.vue.tmp')
tmp.write_text(text, encoding='utf-8')
tmp.replace(TARGET)
print('patched OK', 'onVoiceButtonClick' in text, 'agent-compose-box' in text)
