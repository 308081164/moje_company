import { test, expect } from '@playwright/test';
import { CUSTOMER_EMAIL, BASE } from '../helpers/accounts';
import * as api from '../helpers/api';

/**
 * 事件卡片 + orders 登录门槛验收：
 * 1) 聊天消息中的事件消息应携带结构化 event（含 eventType/actionable/images）。
 * 2) 未登录访问 orders 工作台应显示登录门槛视图而非跳转。
 */
test('事件消息携带结构化卡片字段', async () => {
  const customer = await api.customerLoginByCode(CUSTOMER_EMAIL, '123456');
  const convs = await api.listConversations(customer.accessToken);
  expect(convs.length).toBeGreaterThan(0);

  let eventCard: any = null;
  for (const cv of convs) {
    const msgs = await api.getMessages(customer.accessToken, cv.id);
    const evMsg = msgs.find((m) => m.msgType === 'event' && m.event);
    if (evMsg) {
      eventCard = evMsg.event;
      break;
    }
  }
  expect(eventCard).toBeTruthy();
  expect(eventCard.eventType).toBeTruthy();
  expect(Array.isArray(eventCard.images)).toBe(true);
  expect(typeof eventCard.actionable).toBe('boolean');
});

test('未登录访问 orders 工作台显示登录门槛', async ({ page }) => {
  await page.goto(`${BASE.cSite}/order-workspace.html`);
  // 不应被重定向到首页
  expect(page.url()).toContain('order-workspace.html');
  await expect(page.locator('#orderGate')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#orderGateLogin')).toBeVisible();
  // 登录弹窗触发按钮存在
  await page.locator('#orderGateLogin').click();
  await expect(page.locator('#loginModal')).toBeVisible({ timeout: 10_000 });
});
