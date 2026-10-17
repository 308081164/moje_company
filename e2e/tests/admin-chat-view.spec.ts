import { test, expect } from '@playwright/test';
import { CUSTOMER_EMAIL, STAFF } from '../helpers/accounts';
import * as api from '../helpers/api';

/**
 * 管理员系统视角：查看全部客户群聊，发言自动带「超级客服」标签，
 * 且管理员不出现在客户可见的群成员列表中。
 */
test('管理员查看全部群聊且发言带超级客服标签', async () => {
  const admin = await api.staffLogin(STAFF.admin.username, STAFF.admin.password);
  expect(admin.role).toBe('ADMIN');

  // 1) 管理员应能看到全部会话（非空，而非之前的空列表）
  const adminConvs = await api.listConversations(admin.accessToken);
  expect(adminConvs.length).toBeGreaterThan(0);

  // 2) 以客户视角取一个真实会话作为验证对象
  const customer = await api.customerLoginByCode(CUSTOMER_EMAIL, '123456');
  const customerConvs = await api.listConversations(customer.accessToken);
  expect(customerConvs.length).toBeGreaterThan(0);
  const convId = customerConvs[0].id;

  // 3) 管理员可读取任意会话消息（不再 403）
  const msgsBefore = await api.getMessages(admin.accessToken, convId);
  expect(Array.isArray(msgsBefore)).toBe(true);

  // 4) 管理员发言 → 自动带超级客服标签
  const sent = await api.sendMessage(admin.accessToken, convId, `超级客服测试 ${Date.now()}`);
  expect(sent.role).toBe('SUPER_SERVICE');
  expect(sent.displayName).toBe('超级客服');

  // 5) 客户视角能看到该消息，且标签为超级客服
  const msgsAfter = await api.getMessages(customer.accessToken, convId);
  const found = msgsAfter.find((m) => m.id === sent.id);
  expect(found).toBeTruthy();
  expect(found.displayName).toBe('超级客服');
  expect(found.role).toBe('SUPER_SERVICE');

  // 6) 客户视角群成员中无超级客服（管理员不进群）
  const members = await api.getMembers(customer.accessToken, convId);
  expect(members.some((m) => m.role === 'SUPER_SERVICE')).toBe(false);
});
