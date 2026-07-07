// AELA — Playwright Electron E2E 冒烟测试
// 验证 Electron 应用能正常启动、窗口可见、基础 UI 渲染

import { test, expect, _electron as electron } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ESM 上下文无 __dirname，需通过 import.meta.url 推导当前目录
const __dirname = dirname(fileURLToPath(import.meta.url))

test.describe('AELA Electron 启动冒烟测试', () => {
  test('应用能正常启动并显示窗口', async () => {
    const electronApp = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      cwd: join(__dirname, '../..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    })

    const window = await electronApp.firstWindow()

    // 等待窗口加载
    await window.waitForLoadState('domcontentloaded')

    // 验证窗口标题
    const title = await window.title()
    expect(title).toBe('AELA')

    // 验证窗口可见
    const isVisible = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getFocusedWindow()
      return win?.isVisible() ?? false
    })
    expect(isVisible).toBeTruthy()

    // 验证 textarea 存在（输入框）
    const textarea = window.locator('textarea')
    await expect(textarea).toBeVisible({ timeout: 15000 })

    // 截图保存
    await window.screenshot({ path: 'test/e2e-playwright/screenshots/launch.png' })

    await electronApp.close()
  })

  test('命令面板能打开（Ctrl+P）', async () => {
    const electronApp = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')],
      cwd: join(__dirname, '../..'),
      env: { ...process.env, NODE_ENV: 'test' },
    })

    const window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    // 等待应用渲染完成
    await window.waitForTimeout(3000)

    // 按 Ctrl+P 打开命令面板
    await window.keyboard.press('Control+p')

    // 验证命令面板可见
    const palette = window.locator('text=输入命令名称...')
    await expect(palette).toBeVisible({ timeout: 5000 })

    await window.screenshot({ path: 'test/e2e-playwright/screenshots/command-palette.png' })

    await electronApp.close()
  })
})
