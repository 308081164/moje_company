import { message } from 'antd';

interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
}

/**
 * WebSocket 与 HTTP 共用 servlet context-path（默认 /api），须连到 /api/ws/...。
 * 反向代理需转发 Upgrade / Connection 头，否则握手失败。
 */
function resolveWsBaseUrl(): string {
  let raw = (typeof window !== 'undefined' && window.env?.API_URL?.trim()) || '';
  if (!raw) {
    return 'ws://localhost:8851/api';
  }
  raw = raw.replace(/\/+$/, '');
  let ws: string;
  if (/^https:/i.test(raw)) {
    ws = 'wss:' + raw.slice('https:'.length);
  } else {
    ws = raw.replace(/^http:/i, 'ws:');
  }
  return ws.endsWith('/api') ? ws : `${ws}/api`;
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private handlers: Record<string, ((data: Record<string, unknown>) => void)[]> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private currentUserId: number | null = null;
  private currentRole: string | null = null;

  connect(userId: number, role: string) {
    if (userId == null || role == null || role === '') {
      console.warn('[WebSocket] 跳过连接：缺少 userId 或 role');
      return;
    }

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.close();
    }

    this.currentUserId = userId;
    this.currentRole = role;

    const path = role === 'MODELER' ? '/ws/modeler' : '/ws/admin';
    const url = `${resolveWsBaseUrl()}${path}?userId=${userId}&role=${role}`;

    console.log('[WebSocket] Connecting to:', url);

    try {
      this.socket = new WebSocket(url);
    } catch (error) {
      console.error('[WebSocket] Failed to create WebSocket:', error);
      return;
    }

    this.socket.onopen = () => {
      console.log('[WebSocket] Connected successfully');
      this.reconnectAttempts = 0;
      message.success('实时消息连接成功');
    };

    this.socket.onmessage = (event) => {
      try {
        const wsMessage: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(wsMessage);
      } catch (error) {
        console.error('[WebSocket] Message parse error:', error);
      }
    };

    this.socket.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    this.socket.onclose = (event) => {
      console.log('[WebSocket] Closed:', event.code, event.reason);
      if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentUserId && this.currentRole) {
        this.reconnectAttempts++;
        const delay = 2000 * this.reconnectAttempts;
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(this.currentUserId!, this.currentRole!), delay);
      } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
        message.warning('实时消息连接失败，请刷新页面重试');
      }
    };
  }

  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.currentUserId = null;
    this.currentRole = null;
  }

  on(eventType: string, handler: (data: Record<string, unknown>) => void) {
    if (!this.handlers[eventType]) {
      this.handlers[eventType] = [];
    }
    this.handlers[eventType].push(handler);
  }

  off(eventType: string, handler: (data: Record<string, unknown>) => void) {
    if (this.handlers[eventType]) {
      this.handlers[eventType] = this.handlers[eventType].filter(h => h !== handler);
    }
  }

  private handleMessage(wsMessage: WebSocketMessage) {
    const handlers = this.handlers[wsMessage.type];
    if (handlers) {
      handlers.forEach(handler => handler(wsMessage.data));
    }

    switch (wsMessage.type) {
      case 'NEW_ORDER':
        message.info(`您有新的订单任务：${wsMessage.data.orderNumber}`);
        break;
      case 'ORDER_STATUS_CHANGE':
        console.log('订单状态变更:', wsMessage.data);
        break;
      case 'ORDER_REJECTED':
        message.warning(`订单 ${wsMessage.data.orderNumber} 已被驳回`);
        break;
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;