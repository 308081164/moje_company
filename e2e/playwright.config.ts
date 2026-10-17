import { defineConfig } from '@playwright/test';

/**
 * 珠宝定制管理系统端到端 UI 测试配置。
 * - 单线程串行（订单状态流转与聊天记录有先后依赖）
 * - 三套前端用绝对 URL 驱动，不依赖单一 baseURL
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    browserName: 'chromium',
    locale: 'zh-CN',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
  },
  outputDir: 'test-results',
});
