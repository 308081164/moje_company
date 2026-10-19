import { API_ORIGIN } from '@/services/api';
import type { ConversationMessage } from '@/types/conversation';

export type ConversationSocketPayload = {
  type: string;
  data: ConversationMessage & Record<string, unknown>;
};

type Handler = (payload: ConversationSocketPayload) => void;

let activeConversationId: number | null = null;

export function setActiveConversationId(id: number | null): void {
  activeConversationId = id;
}

export function getActiveConversationId(): number | null {
  return activeConversationId;
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
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8;
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  connect(token: string) {
    if (!token) return;
    this.token = token;
    this.stopped = false;
    this.reconnectAttempts = 0;
    this.open();
  }

  disconnect() {
    this.stopped = true;
    this.token = null;
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private open() {
    if (this.stopped || !this.token) return;
    if (this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) {
      return;
    }
    try {
      this.socket = new WebSocket(resolveConversationWsUrl(this.token));
    } catch (error) {
      console.error('[ConversationWS] Failed to create socket', error);
      this.scheduleReconnect();
      return;
    }
    this.socket.onopen = () => {
      this.reconnectAttempts = 0;
    };
    this.socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as ConversationSocketPayload;
        this.handlers.forEach((handler) => handler(payload));
      } catch (error) {
        console.error('[ConversationWS] Message parse error', error);
      }
    };
    this.socket.onclose = () => {
      this.socket = null;
      this.scheduleReconnect();
    };
    this.socket.onerror = () => {
      /* onclose will reconnect */
    };
  }

  private scheduleReconnect() {
    if (this.stopped || !this.token) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(15000, 1000 * 2 ** (this.reconnectAttempts - 1));
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }
}

export const conversationSocket = new ConversationSocket();
