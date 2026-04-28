import { message } from 'antd';

interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private handlers: Record<string, ((data: Record<string, unknown>) => void)[]> = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(userId: number, role: string) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const path = role === 'MODELER' ? '/ws/modeler' : '/ws/admin';
    
    const url = `${protocol}//${host}${path}?userId=${userId}&role=${role}`;
    
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.socket.onmessage = (event) => {
      try {
        const wsMessage: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(wsMessage);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.socket.onclose = () => {
      console.log('WebSocket closed');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(userId, role), 2000 * this.reconnectAttempts);
      }
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
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