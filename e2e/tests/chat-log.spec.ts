import { test, expect } from '@playwright/test';
import { CUSTOMER_EMAIL } from '../helpers/accounts';
import * as api from '../helpers/api';

/**
 * 聊天记录验收（独立）：用客户邮箱登录后，读取会话，验证完整聊天记录落库。
 * 依赖 full-order-journey 已跑过（或历史已存在完整订单会话）。
 * 用户可通过 C 端独立站（:8853）登录 3080811164@qq.com 查看相同聊天记录。
 */
test('客户邮箱登录后可见完整聊天记录', async () => {
  const customer = await api.customerLoginByCode(CUSTOMER_EMAIL, '123456');
  const convs = await api.listConversations(customer.accessToken);
  expect(convs.length).toBeGreaterThan(0);

  // 找到包含完整流程事件（含「订单已发货」）的会话
  let fullText: string | null = null;
  for (const cv of convs) {
    const msgs = await api.getMessages(customer.accessToken, cv.id);
    const text = msgs.map((x) => x.content || '').join('\n');
    if (text.includes('订单已发货')) {
      fullText = text;
      break;
    }
  }
  expect(fullText).toBeTruthy();
  // 全流程关键节点应作为系统事件卡片出现在聊天室
  expect(fullText!).toContain('设计师提交设计稿');
  expect(fullText!).toContain('订单已发货');
});
