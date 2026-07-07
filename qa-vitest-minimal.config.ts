import { defineConfig } from 'vitest/config'

// 临时最小 config：不含任何 plugin / setup / external deps。
// 目的：隔离验证「vitest/vite 版本冲突」是否导致整仓收集阶段失败，
// 与具体测试文件或 setup 无关。
export default defineConfig({
  test: {
    include: ['qa-minimal-blocker.test.ts'],
    name: 'minimal-blocker-check',
  },
})
