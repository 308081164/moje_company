/** 检测浏览器可用的录音 MIME（优先兼容 iOS Safari 的 audio/mp4） */
export function pickRecorderMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return null
}

export function extensionForMime(mime: string): string {
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

export type VoiceInputMode = 'media-recorder' | 'speech-recognition' | 'none'

export interface VoiceInputCapability {
  mode: VoiceInputMode
  available: boolean
  mimeType?: string
}

type SpeechRecognitionCtor = new () => SpeechRecognition

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const W = window as Window
  return W.SpeechRecognition ?? W.webkitSpeechRecognition
}

export function detectVoiceInputCapability(): VoiceInputCapability {
  if (typeof window === 'undefined') {
    return { mode: 'none', available: false }
  }
  const hasMic = !!navigator.mediaDevices?.getUserMedia
  const mime = pickRecorderMimeType()
  if (hasMic && mime) {
    return { mode: 'media-recorder', available: true, mimeType: mime }
  }
  if (getSpeechRecognitionCtor()) {
    return { mode: 'speech-recognition', available: true }
  }
  return { mode: 'none', available: false }
}

export function createSpeechRecognition(): SpeechRecognition | null {
  const Ctor = getSpeechRecognitionCtor()
  if (!Ctor) return null
  const recognition = new Ctor()
  recognition.lang = 'zh-CN'
  recognition.continuous = false
  recognition.interimResults = false
  recognition.maxAlternatives = 1
  return recognition
}
