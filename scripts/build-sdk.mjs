#!/usr/bin/env node
/**
 * SDK 构建脚本 — 解耦本地依赖路径
 *
 * 解析策略（优先级从高到低）:
 * 1. 环境变量 AELA_SDK_PATH — SDK 源码根目录（包含 package.json）
 * 2. 默认相对路径 ../codecast/AgentPrimordia/sdk/typescript
 * 3. 如果都找不到，跳过构建（SDK 可能已预装或来自 npm）
 *
 * 用法:
 *   node scripts/build-sdk.mjs          # 构建默认路径的 SDK
 *   AELA_SDK_PATH=/path/to/sdk node scripts/build-sdk.mjs  # 构建指定路径的 SDK
 */

import { existsSync } from 'fs'
import { resolve, join } from 'path'
import { spawnSync } from 'child_process'

// 解析 SDK 源码路径
const envPath = process.env.AELA_SDK_PATH
const defaultPath = resolve(process.cwd(), '../codecast/AgentPrimordia/sdk/typescript')

let sdkPath = null

if (envPath && existsSync(join(envPath, 'package.json'))) {
  sdkPath = envPath
} else if (existsSync(join(defaultPath, 'package.json'))) {
  sdkPath = defaultPath
}

if (!sdkPath) {
  console.log('[build-sdk] No local SDK source found, skipping build.')
  console.log('[build-sdk] Set AELA_SDK_PATH env var to specify SDK source path.')
  process.exit(0)
}

console.log(`[build-sdk] Building SDK at: ${sdkPath}`)

const result = spawnSync('npm', ['run', 'build'], {
  cwd: sdkPath,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  console.error('[build-sdk] SDK build failed!')
  process.exit(result.status || 1)
}

console.log('[build-sdk] SDK build completed successfully.')
