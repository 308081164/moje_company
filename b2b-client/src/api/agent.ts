import request from '@/utils/request'
import { getB2bTokenRaw } from '@/utils/b2bAuth'

/** Agent 调用大模型可能较慢，单独延长超时 */
const AGENT_REQUEST_TIMEOUT_MS = 120_000

export interface B2bAgentDraft {
  basicRequirements?: string
  styleInfo?: string
  materialInfo?: string
  jewelryType?: string
  companyName?: string
  contactPerson?: string
  referenceImageUrls?: string[]
  detailImagesComplete?: boolean
  readyForConfirm?: boolean
  missingFields?: string[]
}

export interface B2bAgentOrderResultPayload {
  orderNumber: string
  accessUrl: string
  qrcodeBase64?: string
}

export interface B2bAgentMessagePayload {
  imageUrls?: string[]
  orderResult?: B2bAgentOrderResultPayload
  supportWecomQrUrl?: string
}

export interface B2bAgentMessage {
  id?: number
  role: string
  content?: string
  payload?: B2bAgentMessagePayload
  createdAt?: string
}

export interface B2bAgentSession {
  sessionId: number
  publicToken: string
  status: string
  draft?: B2bAgentDraft
  messages?: B2bAgentMessage[]
  readOnly: boolean
  createdAt?: string
}

export interface B2bAgentChatResponse {
  session: B2bAgentSession
  latestAssistantMessage?: B2bAgentMessage
  needLogin?: boolean
  showConfirmCard?: boolean
  orderResult?: {
    orderNumber: string
    accessUrl: string
    qrcodeBase64?: string
  }
  supportWecomQrUrl?: string
  supportWecomFallbackText?: string
}


export function agentWelcome(): Promise<{ message: string }> {
  return request.get('/b2b/agent/welcome')
}

function authConfig(extra?: Record<string, string>) {
  const token = getB2bTokenRaw()
  const headers: Record<string, string> = { ...extra }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return { headers }
}

export function agentCreateSession(): Promise<B2bAgentSession> {
  return request.post('/b2b/agent/sessions', {}, authConfig())
}

export function agentListSessions(): Promise<B2bAgentSession[]> {
  return request.get('/b2b/agent/sessions', { ...authConfig(), skipGlobalError: true })
}

export function agentGetSession(sessionId: number, publicToken: string): Promise<B2bAgentSession> {
  return request.get(`/b2b/agent/sessions/${sessionId}`, authConfig({ 'X-B2B-Agent-Session-Token': publicToken }))
}

export function agentBindSession(sessionId: number, publicToken: string): Promise<B2bAgentSession> {
  return request.post(`/b2b/agent/sessions/${sessionId}/bind`, {}, authConfig({ 'X-B2B-Agent-Session-Token': publicToken }))
}

export function agentSendMessage(
  sessionId: number,
  data: { text?: string; images?: File[] },
  extraHeaders: Record<string, string>
): Promise<B2bAgentChatResponse> {
  const form = new FormData()
  if (data.text) form.append('text', data.text)
  if (data.images?.length) {
    for (const img of data.images) {
      form.append('images', img)
    }
  }
  return request.post(`/b2b/agent/sessions/${sessionId}/messages`, form, {
    timeout: AGENT_REQUEST_TIMEOUT_MS,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...authConfig(extraHeaders).headers
    }
  })
}

export function agentSpeechToText(audio: Blob, filename = 'voice.webm'): Promise<{ text: string }> {
  const form = new FormData()
  form.append('audio', audio, filename)
  return request.post('/b2b/agent/speech-to-text', form, {
    timeout: AGENT_REQUEST_TIMEOUT_MS,
    headers: { 'Content-Type': 'multipart/form-data', ...authConfig().headers }
  })
}

export function agentCommit(sessionId: number, extraHeaders: Record<string, string>): Promise<B2bAgentChatResponse> {
  return request.post(`/b2b/agent/sessions/${sessionId}/commit`, {}, {
    timeout: AGENT_REQUEST_TIMEOUT_MS,
    ...authConfig(extraHeaders)
  })
}
