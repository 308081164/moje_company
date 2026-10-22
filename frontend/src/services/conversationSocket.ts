import { API_ORIGIN } from '@/services/api';
import { conversationService } from '@/services/conversationService';
import type { Conversation, ConversationMessage } from '@/types/conversation';

export type ConversationSocketPayload = {
  type: string;
  data: ConversationMessage & Record<string, unknown>;
};

type Handler = (payload: ConversationSocketPayload) => void;
type ListHandler = (list: Conversation[]) => void;
type SyncHandler = (conversationId: number, messages: ConversationMessage[]) => void;
type StatusHandler = (connected: boolean) => void;

const PING_INTERVAL_MS = 20_000;
const PONG_TIMEOUT_MS = 10_000;
const CONNECT_TIMEOUT_MS = 8_000;
const POLL_INTERVAL_MS = 10_000;

let activeConversationId: number | null = null;

export function setActiveConversationId(id: number | null): void {
  activeConversationId = id;
}

export function getActiveConversationId(): number | null {
  return activeConversationId;
}

const alertedKeys = new Set<string>();

/** 同一条消息只提示一次（推送和补拉可能先后到达）。 */
export function claimChatAlert(key: string): boolean {
  if (!key || alertedKeys.has(key)) return false;
  alertedKeys.add(key);
  if (alertedKeys.size > 800) {
    let dropped = 0;
    for (const item of alertedKeys) {
      alertedKeys.delete(item);
      dropped += 1;
      if (dropped >= 400) break;
    }
  }
  return true;
}

function resolveConversationWsUrl(token: string): string {
  let raw = (typeof window !== 'undefined' && window.env?.API_URL?.trim()) || API_ORIGIN || '';
  raw = raw.replace(/\/+$/, '');
  if (raw.endsWith('/api')) {
    raw = raw.slice(0, -4);
  }
  let ws: string;
  if (/^https:/i.test(raw)) {
    ws = 'wss:' + raw.slice('https:'.length);
  } else if (/^http:/i.test(raw)) {
    ws = raw.replace(/^http:/i, 'ws:');
  } else {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = `${proto}//${window.location.host}`;
  }
  return `${ws}/api/ws/conversation?token=${encodeURIComponent(token)}`;
}

class ConversationSocket {
  private socket: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private listHandlers = new Set<ListHandler>();
  private syncHandlers = new Set<SyncHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private reconnectAttempts = 0;
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private waitingPong = false;
  private stopped = true;
  private connected = false;
  private pollInFlight = false;
  private pollQueued: 'interval' | 'catchup' | null = null;
  private includeAll = false;
  private listPrimed = false;
  private listBaseline = new Map<number, { fp: string; unread: number }>();
  private messageBaseline = new Map<number, number>();
  private primedMessages = new Set<number>();
  private recentRealtime = new Map<number, { at: number; content: string }>();

  private lastNudge = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.nudge());
    window.addEventListener('pageshow', () => this.nudge());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.nudge();
    });
  }

  connect(token: string) {
    if (!token) return;
    if (this.token && this.token !== token) {
      this.resetBaselines();
    }
    const live = this.token === token && this.socket?.readyState === WebSocket.OPEN;
    this.token = token;
    this.stopped = false;
    if (live) return;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.open();
    if (!this.isConnected()) this.startPoll();
  }

  disconnect() {
    this.stopped = true;
    this.token = null;
    this.clearReconnectTimer();
    this.clearConnectTimeout();
    this.stopHeartbeat();
    this.stopPoll();
    this.connected = false;
    const ws = this.socket;
    this.socket = null;
    if (ws) {
      this.detach(ws);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  setIncludeAll(includeAll: boolean) {
    this.includeAll = includeAll;
  }

  /** 打开会话后记下已展示的最大消息 id，避免把历史记录当成新消息再响一次。 */
  noteSnapshot(conversationId: number, messages: Array<{ id: number }>) {
    let max = 0;
    for (const message of messages) {
      if (message && message.id > max) max = message.id;
    }
    const prev = this.messageBaseline.get(conversationId) ?? 0;
    if (!this.messageBaseline.has(conversationId) || max > prev) {
      this.messageBaseline.set(conversationId, Math.max(prev, max));
    }
    this.primedMessages.add(conversationId);
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  onConversationList(handler: ListHandler): () => void {
    this.listHandlers.add(handler);
    return () => {
      this.listHandlers.delete(handler);
    };
  }

  onMessagesSynced(handler: SyncHandler): () => void {
    this.syncHandlers.add(handler);
    return () => {
      this.syncHandlers.delete(handler);
    };
  }

  onStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private resetBaselines() {
    this.listPrimed = false;
    this.listBaseline.clear();
    this.messageBaseline.clear();
    this.primedMessages.clear();
    this.recentRealtime.clear();
    alertedKeys.clear();
  }

  private nudge() {
    if (this.stopped || !this.token) return;
    const now = Date.now();
    const cooledDown = now - this.lastNudge >= 5000;
    if (this.isConnected()) {
      this.sendPing();
      if (cooledDown) {
        this.lastNudge = now;
        void this.pollOnce('catchup');
      }
      return;
    }
    this.lastNudge = now;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.open();
    this.startPoll();
  }

  private detach(ws: WebSocket) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
  }

  private open() {
    if (this.stopped || !this.token) return;
    const current = this.socket;
    if (current && (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (current) {
      this.detach(current);
      try {
        current.close();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(resolveConversationWsUrl(this.token));
    } catch (error) {
      console.error('[ConversationWS] Failed to create socket', error);
      this.setConnected(false);
      this.scheduleReconnect();
      return;
    }
    this.socket = ws;
    this.armConnectTimeout(ws);
    ws.onopen = () => {
      if (this.socket !== ws) return;
      this.clearConnectTimeout();
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.setConnected(true);
      void this.pollOnce('catchup');
    };
    ws.onmessage = (event) => {
      if (this.socket !== ws) return;
      this.consumeMessage(event.data);
    };
    ws.onerror = () => {
      /* onclose 或连接超时会负责重连 */
    };
    ws.onclose = () => {
      if (this.socket !== ws) return;
      this.socket = null;
      this.clearConnectTimeout();
      this.stopHeartbeat();
      if (this.stopped) return;
      this.setConnected(false);
      this.scheduleReconnect();
    };
  }

  private armConnectTimeout(ws: WebSocket) {
    this.clearConnectTimeout();
    this.connectTimeout = setTimeout(() => {
      this.connectTimeout = null;
      if (this.socket !== ws || ws.readyState === WebSocket.OPEN) return;
      console.warn('[ConversationWS] connect timeout');
      this.socket = null;
      this.detach(ws);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (this.stopped) return;
      this.setConnected(false);
      this.scheduleReconnect();
    }, CONNECT_TIMEOUT_MS);
  }

  private consumeMessage(raw: unknown) {
    let payload: ConversationSocketPayload;
    try {
      payload = JSON.parse(String(raw)) as ConversationSocketPayload;
    } catch (error) {
      console.error('[ConversationWS] Message parse error', error);
      return;
    }
    if (payload?.type === 'pong') {
      this.waitingPong = false;
      if (this.pongTimer) {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
      return;
    }
    if (payload?.type === 'MESSAGE' && payload.data) {
      const conversationId = Number(payload.data.conversationId);
      const messageId = Number(payload.data.id);
      if (!Number.isNaN(conversationId)) {
        const prev = this.messageBaseline.get(conversationId) ?? 0;
        if (!Number.isNaN(messageId) && messageId > prev) {
          this.messageBaseline.set(conversationId, messageId);
        }
        this.primedMessages.add(conversationId);
        this.recentRealtime.set(conversationId, {
          at: Date.now(),
          content: String(payload.data.content || ''),
        });
      }
    }
    this.emit(payload);
  }

  private emit(payload: ConversationSocketPayload) {
    this.handlers.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error('[ConversationWS] handler error', error);
      }
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.sendPing();
    this.pingTimer = setInterval(() => this.sendPing(), PING_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.waitingPong = false;
  }

  private sendPing() {
    const ws = this.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: 'ping' }));
    } catch (error) {
      console.warn('[ConversationWS] ping failed', error);
      this.dropAndReconnect();
      return;
    }
    this.waitingPong = true;
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = setTimeout(() => {
      this.pongTimer = null;
      if (!this.waitingPong || this.stopped) return;
      console.warn('[ConversationWS] pong timeout, reconnecting');
      this.dropAndReconnect();
    }, PONG_TIMEOUT_MS);
  }

  private dropAndReconnect() {
    const ws = this.socket;
    this.stopHeartbeat();
    if (ws) {
      if (this.socket === ws) this.socket = null;
      this.detach(ws);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    if (this.stopped) return;
    this.setConnected(false);
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.stopped || !this.token) return;
    if (this.reconnectTimer != null) return;
    this.reconnectAttempts += 1;
    const exp = Math.min(this.reconnectAttempts - 1, 4);
    const delay = Math.min(15000, 1000 * 2 ** exp);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearConnectTimeout() {
    if (this.connectTimeout != null) {
      clearTimeout(this.connectTimeout);
      this.connectTimeout = null;
    }
  }

  private setConnected(connected: boolean) {
    const changed = this.connected !== connected;
    this.connected = connected;
    if (connected) this.stopPoll();
    else this.startPoll();
    if (!changed) return;
    this.statusHandlers.forEach((handler) => {
      try {
        handler(connected);
      } catch (error) {
        console.error('[ConversationWS] status handler error', error);
      }
    });
  }

  private startPoll() {
    if (this.stopped || this.pollTimer != null) return;
    void this.pollOnce('interval');
    this.pollTimer = setInterval(() => {
      void this.pollOnce('interval');
    }, POLL_INTERVAL_MS);
  }

  private stopPoll() {
    if (this.pollTimer != null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce(kind: 'interval' | 'catchup') {
    if (this.pollInFlight) {
      if (kind === 'catchup') this.pollQueued = 'catchup';
      return;
    }
    if (this.stopped || !this.token) return;
    if (kind === 'interval' && this.isConnected()) return;
    this.pollInFlight = true;
    try {
      const list = await conversationService.listConversations();
      if (this.stopped || (kind === 'interval' && this.isConnected())) return;
      this.listHandlers.forEach((handler) => {
        try {
          handler(list);
        } catch (error) {
          console.error('[ConversationWS] list handler error', error);
        }
      });
      this.noteList(list);
      const active = activeConversationId;
      if (active != null) {
        const messages = await conversationService.getMessages(active, this.includeAll);
        if (this.stopped || (kind === 'interval' && this.isConnected())) return;
        this.applyMessages(active, messages);
      }
    } catch (error) {
      console.warn('[ConversationWS] poll failed', error);
    } finally {
      this.pollInFlight = false;
      const queued = this.pollQueued;
      this.pollQueued = null;
      if (queued && !this.stopped) {
        void this.pollOnce(queued);
      }
    }
  }

  private noteList(list: Conversation[]) {
    const active = activeConversationId;
    for (const conversation of list) {
      const fp = `${conversation.lastMessageAt || ''}|${conversation.unreadCount}|${conversation.lastMessage || ''}`;
      const prev = this.listBaseline.get(conversation.id);
      this.listBaseline.set(conversation.id, { fp, unread: conversation.unreadCount });
      if (!this.listPrimed) continue;
      if (conversation.id === active) continue;
      const recent = this.recentRealtime.get(conversation.id);
      if (
        recent &&
        recent.content === (conversation.lastMessage || '') &&
        Date.now() - recent.at < 20_000
      ) {
        continue;
      }
      const unreadGrew = prev ? conversation.unreadCount > prev.unread : conversation.unreadCount > 0;
      if (!unreadGrew || (prev && prev.fp === fp)) continue;
      this.emit({
        type: 'INBOX',
        data: {
          id: 0,
          conversationId: conversation.id,
          senderType: 'CUSTOMER',
          senderId: 0,
          displayName: conversation.orderNumber || conversation.title || '新消息',
          msgType: 'text',
          content: conversation.lastMessage || '收到新消息',
          createdAt: conversation.lastMessageAt,
        },
      });
    }
    this.listPrimed = true;
  }

  private applyMessages(conversationId: number, messages: ConversationMessage[]) {
    const primed = this.primedMessages.has(conversationId);
    const prevMax = this.messageBaseline.get(conversationId) ?? 0;
    let max = prevMax;
    const fresh: ConversationMessage[] = [];
    for (const message of messages) {
      if (message.id > max) max = message.id;
      if (primed && message.id > prevMax) fresh.push(message);
    }
    this.messageBaseline.set(conversationId, max);
    this.primedMessages.add(conversationId);
    this.syncHandlers.forEach((handler) => {
      try {
        handler(conversationId, messages);
      } catch (error) {
        console.error('[ConversationWS] sync handler error', error);
      }
    });
    for (const message of fresh) {
      this.recentRealtime.set(conversationId, { at: Date.now(), content: message.content || '' });
      this.emit({
        type: 'MESSAGE',
        data: message as ConversationMessage & Record<string, unknown>,
      });
    }
  }
}

export const conversationSocket = new ConversationSocket();
