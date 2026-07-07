// AELA — Playwright E2E 测试配置
// 使用 @playwright/test 的 _electron 模块测试 Electron 应用
// 运行方式: npx playwright test

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e-playwright',
  fullyParallel: false, // Electron 应用不支持并行
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Electron 单实例
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 60000,
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'electron',
      use: {},
    },
  ],
})
