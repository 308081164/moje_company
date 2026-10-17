/**
 * 跨角色 UI 操作公共步骤（员工后台 React）。
 */
import { Page, expect } from '@playwright/test';
import { BASE, STAFF } from './accounts';

/** 员工后台登录（React HashRouter）。 */
export async function loginStaff(page: Page, username: string, password: string): Promise<void> {
  await page.goto(`${BASE.staff}/#/login`);
  await page.getByPlaceholder('请输入用户名').fill(username);
  await page.getByPlaceholder('请输入密码').fill(password);
  await page.locator('button[class*="login-btn"], button[type="submit"]').first().click();
  await page.waitForURL(/#\/dashboard/, { timeout: 30_000 });
}

/** 直接进入订单详情页（绕过列表搜索），并切到「我的任务」Tab。 */
export async function openOrder(page: Page, orderId: number): Promise<void> {
  await page.goto(`${BASE.staff}/#/orders/${orderId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_200);
  await page.getByRole('tab', { name: /我的任务/ }).click();
  await page.waitForTimeout(800);
}

/** 设计师：填设计备注并保存设计信息。 */
export async function fillAndSaveDesign(page: Page, designNotes: string): Promise<void> {
  await page.locator('#designNotes').fill(designNotes);
  await page.getByRole('button', { name: '保存设计信息' }).click();
  await page.waitForTimeout(1_500);
}

/** 建模师：填克重/建模备注并保存建模信息。 */
export async function fillAndSaveModel(page: Page, opts: { weight?: number; modelNotes?: string }): Promise<void> {
  if (opts.weight != null) {
    await page.locator('#weight').fill(String(opts.weight));
  }
  if (opts.modelNotes) {
    await page.locator('#modelNotes').fill(opts.modelNotes);
  }
  await page.getByRole('button', { name: '保存建模信息' }).click();
  await page.waitForTimeout(1_500);
}

/** 跟单员：填评审备注并保存评审（无驳回即推送到生产）。 */
export async function fillAndSaveReview(page: Page, reviewNotes: string): Promise<void> {
  await page.locator('#reviewNotes').fill(reviewNotes);
  await page.getByRole('button', { name: '保存评审' }).click();
  await page.waitForTimeout(1_500);
}

/** 跟单员：发货（录入快递单号）。 */
export async function shipOrder(page: Page, trackingNumber: string): Promise<void> {
  await page.getByPlaceholder('如：RR123456789CN').fill(trackingNumber);
  await page.getByRole('button', { name: '确认发货' }).click();
  await page.waitForTimeout(1_500);
}

/** 员工在「客户沟通」页选中指定订单会话并回复消息。 */
export async function replyChat(page: Page, orderNumber: string, text: string): Promise<void> {
  await page.goto(`${BASE.staff}/#/chat`);
  await page.getByRole('button', { name: '刷新' }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByRole('button', { name: '刷新' }).click();
  await page.waitForTimeout(800);
  // 精确点击目标订单的会话列表项
  const item = page.locator('.ant-list-item', { hasText: orderNumber }).first();
  await item.waitFor({ state: 'visible', timeout: 15_000 });
  await item.click();
  await page.waitForTimeout(800);
  const input = page.getByPlaceholder('输入消息…');
  await input.waitFor({ state: 'visible', timeout: 15_000 });
  await input.fill(text);
  await page.getByRole('button', { name: '发送' }).click();
  await expect(page.getByText(text, { exact: false }).last()).toBeVisible({ timeout: 15_000 });
}
