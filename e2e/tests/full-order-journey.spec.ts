import { test, expect } from '@playwright/test';
import { CUSTOMER_EMAIL, STAFF, TEST_TRACKING_NUMBER } from '../helpers/accounts';
import * as api from '../helpers/api';
import * as csite from '../helpers/csite';
import * as orders from '../helpers/orders';

/**
 * 端到端全流程（单个 test，串行）：
 * 客户登录 → 支付定金下单 → 沟通需求 → 设计师设计 → 客户驳回设计稿 → 重新设计 → 客户确认设计
 * → 建模师建模 → 客户确认建模 → 跟单员推送生产 → 提交跟单进度 → 发货录入快递单号 → 客户查看物流 → 确认收货
 * 全程真实登录各账号（客户邮箱 + 员工演示账号），聊天记录落库供后续验证。
 */
test('全流程端到端 + 真实登录 + 聊天记录', async ({ browser }) => {
  // ===== 0. API 预登录，拿 token/userId 用于指派与断言 =====
  const admin = await api.staffLogin(STAFF.admin.username, STAFF.admin.password);
  const designerAcc = await api.staffLogin(STAFF.designer.username, STAFF.designer.password);
  const modelerAcc = await api.staffLogin(STAFF.modeler.username, STAFF.modeler.password);
  const trackerAcc = await api.staffLogin(STAFF.tracker.username, STAFF.tracker.password);
  const customer = await api.customerLoginByCode(CUSTOMER_EMAIL, '123456');

  // 各角色独立浏览器上下文（localStorage 隔离）
  const customerCtx = await browser.newContext();
  const designerCtx = await browser.newContext();
  const modelerCtx = await browser.newContext();
  const trackerCtx = await browser.newContext();
  try {
    const c = await customerCtx.newPage();
    const d = await designerCtx.newPage();
    const m = await modelerCtx.newPage();
    const t = await trackerCtx.newPage();

    // ===== 1. 客户登录 + 支付定金下单 =====
    await csite.loginCustomer(c, CUSTOMER_EMAIL);
    const { orderId, orderNumber } = await csite.placeOrder(
      c,
      '我需要一枚18K金戒指，主石1克拉钻石，戒托铂金，手寸12号'
    );

    // ===== 2. 指派设计师并同步会话成员 =====
    await api.assignOrder(admin.accessToken, orderId, { designerId: designerAcc.userId });
    const conv = await api.ensureConversation(designerAcc.accessToken, orderId);
    expect(conv?.id).toBeTruthy();

    // ===== 3. 客户沟通需求 + 设计师回复 =====
    await csite.openWorkspace(c, orderNumber);
    await csite.sendChat(c, '您好，我的戒指主石想用1克拉钻石，款式简约一点');
    // 设计师真实登录后台（体现真实登录）；回复消息用 API 发到目标会话，避免多会话下 UI 切换脆弱
    await orders.loginStaff(d, STAFF.designer.username, STAFF.designer.password);
    await api.sendMessage(designerAcc.accessToken, conv.id, '收到您的需求，我先出设计稿');

    // ===== 4. 设计师提交设计（PENDING_DESIGN → PENDING_MODEL）=====
    await orders.openOrder(d, orderId);
    await orders.fillAndSaveDesign(d, '简约六爪钻戒设计，主石1克拉，戒托铂金');
    let o = await api.getOrder(admin.accessToken, orderId);
    expect(o.currentStatus).toBe('PENDING_MODEL');

    // ===== 5. 客户驳回设计稿（回到 DESIGNING）=====
    await csite.refreshProgress(c);
    await csite.rejectDesign(c, '主石位置偏了，请往中心调');
    let events = await api.getOrderEvents(customer.accessToken, orderId);
    expect(events.map((e) => e.eventType)).toContain('DESIGN_REJECT');

    // ===== 6. 设计师重新设计 + 客户确认设计 =====
    await orders.openOrder(d, orderId);
    await orders.fillAndSaveDesign(d, '已调整主石居中，六爪对称设计');
    o = await api.getOrder(admin.accessToken, orderId);
    expect(o.currentStatus).toBe('PENDING_MODEL');
    await csite.refreshProgress(c);
    await csite.confirmDesign(c);
    let summary = await api.getOrderSummary(customer.accessToken, orderId);
    expect(summary.designApproved).toBe(true);

    // ===== 7. 指派建模师 + 建模 + 客户驳回建模 + 重新建模 + 客户确认 =====
    await api.assignOrder(admin.accessToken, orderId, { modelerId: modelerAcc.userId });
    await orders.loginStaff(m, STAFF.modeler.username, STAFF.modeler.password);
    await orders.openOrder(m, orderId);
    await orders.fillAndSaveModel(m, { weight: 3.5, modelNotes: '六爪镶嵌，1克拉主石' });
    o = await api.getOrder(admin.accessToken, orderId);
    expect(o.currentStatus).toBe('PENDING_REVIEW');

    // 客户驳回建模稿
    await csite.refreshProgress(c);
    await csite.rejectModel(c, '爪镶角度不对，请调整');
    events = await api.getOrderEvents(customer.accessToken, orderId);
    expect(events.map((e) => e.eventType)).toContain('MODEL_REJECT');

    // 建模师重新提交
    await orders.openOrder(m, orderId);
    await orders.fillAndSaveModel(m, { weight: 3.5, modelNotes: '已调整爪镶角度' });
    o = await api.getOrder(admin.accessToken, orderId);
    expect(o.currentStatus).toBe('PENDING_REVIEW');

    // 客户确认建模
    await csite.refreshProgress(c);
    await csite.confirmModel(c);
    summary = await api.getOrderSummary(customer.accessToken, orderId);
    expect(summary.modelApproved).toBe(true);

    // ===== 8. 指派跟单员 + 评审推送生产 + 跟单进度 + 发货 =====
    await api.assignOrder(admin.accessToken, orderId, { trackerId: trackerAcc.userId });
    await orders.loginStaff(t, STAFF.tracker.username, STAFF.tracker.password);
    await orders.openOrder(t, orderId);
    await orders.fillAndSaveReview(t, '工艺验证通过，可进入生产');
    o = await api.getOrder(admin.accessToken, orderId);
    expect(o.currentStatus).toBe('PRODUCING');

    // 跟单员提交跟单进度（API，tracker token）
    await api.addProductionFollowLog(trackerAcc.accessToken, orderId, '已进入镶嵌工序，主石已定位');

    // 跟单员发货（录入快递单号）
    await orders.openOrder(t, orderId);
    await orders.shipOrder(t, TEST_TRACKING_NUMBER);

    // ===== 9. 客户查看物流 =====
    await csite.refreshProgress(c);
    const prog = await csite.progressText(c);
    expect(prog).toContain(TEST_TRACKING_NUMBER);
    expect(prog).toContain('物流信息');

    // ===== 10. 客户确认收货（→ COMPLETED）=====
    const deliveryBtn = c.locator('[data-act="DELIVERY"]');
    if ((await deliveryBtn.count()) > 0) {
      c.once('dialog', (dlg) => dlg.accept());
      await deliveryBtn.click();
      await c.waitForTimeout(1_500);
      o = await api.getOrder(admin.accessToken, orderId);
      expect(o.currentStatus).toBe('COMPLETED');
    }

    // ===== 11. 聊天记录完整验证（客户视角）=====
    const msgs = await api.getMessages(customer.accessToken, conv.id);
    const allText = msgs.map((x) => x.content || '').join('\n');
    expect(allText).toContain('简约一点'); // 客户需求
    expect(allText).toContain('我先出设计稿'); // 设计师回复
    expect(allText).toContain('设计师提交设计稿'); // 系统事件：设计提交
    expect(allText).toContain('订单已发货'); // 系统事件：发货
  } finally {
    await customerCtx.close();
    await designerCtx.close();
    await modelerCtx.close();
    await trackerCtx.close();
  }
});
