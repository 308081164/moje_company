/**
 * 后端 REST 封装：用于 E2E 前置造数、指派、断言（直接调 API，绕过 UI 提高稳定性）。
 * 所有路径以 BASE.api 为前缀（context-path /api）。
 */
import { BASE } from './accounts';

interface RequestOptions {
  token?: string;
  body?: unknown;
}

async function request<T = any>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  const res = await fetch(`${BASE.api}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const msg = data?.message || data?.detail || `${method} ${path} 失败 (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export interface StaffLoginResult {
  accessToken: string;
  userId: number;
  username: string;
  realName: string;
  role: string;
}

export async function staffLogin(username: string, password: string): Promise<StaffLoginResult> {
  return request<StaffLoginResult>('POST', '/auth/login', { body: { username, password } });
}

export interface CustomerLoginResult {
  accessToken: string;
  id: number;
  email?: string;
  contact?: string;
  displayName?: string;
}

export async function customerLoginByCode(email: string, code: string): Promise<CustomerLoginResult> {
  return request<CustomerLoginResult>('POST', '/portal/c/account/login-by-code', {
    body: { email, code },
  });
}

export async function customerSendCode(email: string): Promise<void> {
  await request('POST', '/portal/c/account/send-verification-code', {
    body: { email, purpose: 'LOGIN' },
  });
}

/** 指派员工（admin）。designerId/modelerId/trackerId 为各员工 userId。 */
export async function assignOrder(
  token: string,
  orderId: number,
  assign: { designerId?: number; modelerId?: number; trackerId?: number; salesId?: number }
): Promise<any> {
  return request('PUT', `/orders/${orderId}/assign`, { token, body: assign });
}

export async function getOrder(token: string, orderId: number): Promise<any> {
  return request('GET', `/orders/${orderId}`, { token });
}

/** 按订单号搜索订单，返回 content 数组。 */
export async function searchOrders(token: string, keyword: string): Promise<any[]> {
  const page = await request<any>('GET', `/orders?keyword=${encodeURIComponent(keyword)}&page=0&size=20`, {
    token,
  });
  return page?.content || [];
}

export async function listConversations(token: string): Promise<any[]> {
  return request('GET', '/conversations', { token });
}

/** 确保订单会话存在并同步成员（指派员工后调用，把 designer/followUp 加入会话）。 */
export async function ensureConversation(token: string, orderId: number): Promise<any> {
  return request('POST', `/conversations/by-order/${orderId}`, { token });
}

export async function getMessages(token: string, conversationId: number): Promise<any[]> {
  return request('GET', `/conversations/${conversationId}/messages`, { token });
}

export async function getMembers(token: string, conversationId: number): Promise<any[]> {
  return request('GET', `/conversations/${conversationId}/members`, { token });
}

export async function sendMessage(token: string, conversationId: number, content: string): Promise<any> {
  return request('POST', `/conversations/${conversationId}/messages`, {
    token,
    body: { content, msgType: 'text' },
  });
}

/** 提交跟单进度（tracker token，note 即可，无需图片）。 */
export async function addProductionFollowLog(token: string, orderId: number, note: string): Promise<any> {
  return request('POST', `/orders/${orderId}/production-follow-logs`, {
    token,
    body: { note },
  });
}

export async function getOrderEvents(token: string, orderId: number): Promise<any[]> {
  return request('GET', `/portal/c/orders/${orderId}/events`, { token });
}

export async function getOrderSummary(token: string, orderId: number): Promise<any> {
  return request('GET', `/portal/c/orders/${orderId}/summary`, { token });
}
