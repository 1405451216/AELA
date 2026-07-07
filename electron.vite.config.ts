import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * SDK 路径解析策略（优先级从高到低）:
 * 1. 环境变量 AELA_SDK_PATH — SDK dist 目录的父目录
 * 2. 默认本地相对路径 ../codecast/AgentPrimordia/sdk/typescript/dist
 *
 * 这样支持:
 *   - 本地开发: 直接使用相对路径
 *   - CI / 其他环境: 通过环境变量指定 SDK 路径
 *   - 未来 npm 发布: 将 SDK 发布后改为 npm 依赖即可
 */
const SDK_BASE = process.env.AELA_SDK_PATH || resolve(__dirname, '../AgentPrimordia/sdk/typescript')
const SDK_DIST = resolve(SDK_BASE, 'dist')

// 需要打包进来的 ESM 依赖（不外部化）
const BUNDLE_DEPS = ['@agentprimordia/sdk', 'electron-store']

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: BUNDLE_DEPS })],
    resolve: {
      alias: {
        '@shared/types': resolve('src/shared/types/index.ts'),
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main'),
        '@agentprimordia/sdk': resolve(SDK_DIST, 'index.js')
      }
    },
    build: {
      minify: 'esbuild',
      target: 'node20',
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts')
        },
        external: ['electron', 'better-sqlite3', 'node:crypto', 'node:fs', 'node:path', 'node:module', 'node:child_process', 'node:url', 'node:os']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: BUNDLE_DEPS })],
    resolve: {
      alias: {
        '@shared/types': resolve('src/shared/types/index.ts'),
        '@shared': resolve('src/shared'),
        '@agentprimordia/sdk': resolve(SDK_DIST, 'index.js')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts')
        },
        external: ['electron']
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      minify: 'esbuild',
      target: 'chrome120',
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html')
        }
      }
    },
    plugins: [react()]
  }
})
