/**
 * 海外 C 端独立站 duxury（b2c-web）UI 操作公共步骤。
 */
import { Page, expect } from '@playwright/test';
import { BASE, CUSTOMER_EMAIL, VERIFY_CODE } from './accounts';

/** 客户邮箱验证码登录（自动建号）。 */
export async function loginCustomer(page: Page, email: string = CUSTOMER_EMAIL): Promise<void> {
  await page.goto(`${BASE.cSite}/index.html`);
  // 选择一个服务卡片触发登录弹窗
  await page.locator('.service-card__btn[data-service="designer"]').first().click();
  const emailInput = page.locator('#emailInput');
  await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
  await emailInput.fill(email);
  await page.locator('#emailContinue').click();
  const codeInput = page.locator('#codeInput');
  await codeInput.waitFor({ state: 'visible', timeout: 20_000 });
  await codeInput.fill(VERIFY_CODE);
  await page.locator('#codeConfirm').click();
  // 登录成功后进入结算弹窗
  await expect(page.locator('#payDeposit')).toBeVisible({ timeout: 20_000 });
}

/** 下单（设计师设计）：填需求并「Pay deposit」。 */
export async function placeOrder(page: Page, requirements: string): Promise<{ orderId: number; orderNumber: string }> {
  await page.locator('#requirementInput').fill(requirements);
  await page.locator('#payDeposit').click();
  await expect(page.locator('#checkoutSuccess')).toBeVisible({ timeout: 20_000 });
  // 从 localStorage 读取下单结果
  const order = await page.evaluate(() => {
    const raw = localStorage.getItem('duxury-order');
    return raw ? JSON.parse(raw) : null;
  });
  expect(order?.orderId).toBeTruthy();
  return { orderId: order.orderId, orderNumber: order.orderNumber };
}

/** 打开订单工作台，并选中指定订单的会话。 */
export async function openWorkspace(page: Page, orderNumber: string): Promise<void> {
  await page.goto(`${BASE.cSite}/order-workspace.html`);
  await expect(page.locator('#chatBody')).toBeVisible({ timeout: 20_000 });
  // 会话列表按订单号定位（避免自动选中旧订单会话）
  const conv = page.locator(`[data-order="${orderNumber}"]`);
  await conv.waitFor({ state: 'visible', timeout: 20_000 });
  await conv.click();
  await page.waitForTimeout(800);
}

/** 在工作台发送聊天消息。 */
export async function sendChat(page: Page, text: string): Promise<void> {
  await page.locator('#chatInput').fill(text);
  await page.locator('#chatSend').click();
  await expect(page.locator('#chatBody')).toContainText(text, { timeout: 15_000 });
}

/** 刷新进度面板。 */
export async function refreshProgress(page: Page): Promise<void> {
  await page.reload();
  await expect(page.locator('#chatProgressBody')).toBeVisible({ timeout: 20_000 });
}

/** 在进度面板点击确认设计稿。 */
export async function confirmDesign(page: Page): Promise<void> {
  await page.locator('[data-act="DESIGN_CONFIRM"]').click();
  await page.waitForTimeout(1_500);
}

/** 在进度面板驳回设计稿（填原因，走 window.prompt）。 */
export async function rejectDesign(page: Page, reason: string): Promise<void> {
  page.once('dialog', (d) => d.accept(reason));
  await page.locator('[data-act="DESIGN_REJECT"]').click();
  await page.waitForTimeout(1_500);
}

/** 在进度面板点击确认建模稿。 */
export async function confirmModel(page: Page): Promise<void> {
  await page.locator('[data-act="MODEL_CONFIRM"]').click();
  await page.waitForTimeout(1_500);
}

/** 在进度面板驳回建模稿（填原因，走 window.prompt）。 */
export async function rejectModel(page: Page, reason: string): Promise<void> {
  page.once('dialog', (d) => d.accept(reason));
  await page.locator('[data-act="MODEL_REJECT"]').click();
  await page.waitForTimeout(1_500);
}

/** 读取进度面板文本（用于断言物流/状态）。 */
export async function progressText(page: Page): Promise<string> {
  return (await page.locator('#chatProgressBody').innerText()) || '';
}
