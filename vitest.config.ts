import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * SDK 路径解析策略（优先级从高到低）:
 * 1. 环境变量 AELA_SDK_PATH — 自定义 SDK dist 路径
 * 2. 默认本地相对路径 ../codecast/AgentPrimordia/sdk/typescript/dist
 *
 * 这样支持:
 *   - 本地开发: 直接使用相对路径
 *   - CI / 其他环境: 通过环境变量指定 SDK 路径
 *   - 未来 npm 发布: 将 SDK 发布后改为 npm 依赖即可
 */
const SDK_SOURCE = process.env.AELA_SDK_PATH || resolve(__dirname, '../AgentPrimordia/sdk/typescript/dist')
const SDK_ENTRY = resolve(SDK_SOURCE, 'index.js')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@agentprimordia/sdk': SDK_ENTRY,
      '@shared/types': resolve(__dirname, 'src/shared/types/index.ts'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
    },
  },
  test: {
    globals: true,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    testTimeout: 30000,
    // 非组件测试使用 node 环境，组件测试通过 per-file // @vitest-environment jsdom 覆盖
    environment: 'node',
    setupFiles: ['test/setup.tsx'],
    // better-sqlite3 是原生 addon（.node）。将其标记为 external，强制 worker 通过
    // 包名直接走 Node 原生 require 加载（而非经 Vite 的 SSR transform 重写路径），
    // 规避原生模块在 worker 内被改写绝对路径后加载失败的风险。
    // 注：本轮 52 例失败的真正根因是 node_modules 内的 better-sqlite3 预编译二进制
    // ABI 不匹配（NMV 137 / Node 24 编译，却被 Node 22 加载），已通过替换为
    // 匹配当前 Node 的预编译二进制修复；此配置作为防御性加固保留。
    server: {
      deps: {
        external: ['better-sqlite3'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // 覆盖率门控阈值（基于当前基线设定，后续逐步提高至 60%）
      thresholds: {
        statements: 45,
        branches: 30,
        functions: 45,
        lines: 45,
      },
      // 排除非业务代码
      exclude: [
        'node_modules/**',
        'out/**',
        'release/**',
        'src/renderer/src/assets/**',
        'src/main/services/sdkTypes.ts',
        'src/main/services/promptContents/**',
        'src/renderer/src/types/**',
        'src/shared/types/**',
        'src/shared/ipcChannels.ts',
        '**/*.d.ts',
        '**/index.ts',
        'scripts/**',
        'test/**',
      ],
    },
  },
})
