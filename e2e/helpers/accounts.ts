/**
 * 端到端测试账号与地址常量。
 * 员工演示账号密码统一 123456（DemoAccountBootstrap）；C 端邮箱验证码固定 123456。
 */

export const BASE = {
  /** 后端 API（context-path /api） */
  api: 'http://localhost:8851/api',
  /** 员工后台（React dev server） */
  staff: 'http://localhost:3000',
  /** 海外 C 端独立站 duxury */
  cSite: 'http://localhost:8853',
  /** B2B/C 门户（Vue） */
  portal: 'http://localhost:8852',
} as const;

export const CUSTOMER_EMAIL = '3080811164@qq.com';
export const VERIFY_CODE = '123456';

export const STAFF = {
  admin: { username: 'admin', password: '123456', role: 'ADMIN' },
  designer: { username: 'designer', password: '123456', role: 'DESIGNER' },
  modeler: { username: 'modeler', password: '123456', role: 'MODELER' },
  tracker: { username: 'follow_up', password: '123456', role: 'TRACKER' },
} as const;

/** 常用国际承运商编码（17TRACK），留空则自动识别 */
export const CARRIERS = [
  { code: 100003, name: 'FedEx' },
  { code: 100004, name: 'DHL' },
  { code: 100005, name: 'UPS' },
  { code: 100044, name: 'USPS' },
] as const;

/** 测试用快递单号（17TRACK 未启用时仅记录，不真正查询） */
export const TEST_TRACKING_NUMBER = 'RR123456789CN';
