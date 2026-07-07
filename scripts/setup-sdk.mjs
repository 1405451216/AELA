// AELA — SDK 安装脚本
// 支持三种 SDK 来源：
//   1. 本地 file: 依赖（默认，开发模式）
//   2. 环境变量 AELA_SDK_PATH 指定路径
//   3. npm 安装（未来 SDK 发布后）
//
// 使用方式：
//   node scripts/setup-sdk.mjs              # 自动检测最佳来源
//   node scripts/setup-sdk.mjs --local      # 强制使用本地路径
//   node scripts/setup-sdk.mjs --npm        # 从 npm 安装
//   AELA_SDK_PATH=/path/to/sdk node scripts/setup-sdk.mjs  # 自定义路径

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const pkgPath = resolve(process.cwd(), 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

const mode = process.argv[2] || 'auto'
const envPath = process.env.AELA_SDK_PATH

let sdkValue
let sdkSource

if (mode === '--npm') {
  // 从 npm 安装（未来 SDK 发布后）
  sdkValue = '@agentprimordia/sdk'
  sdkSource = 'npm'
} else if (mode === '--local' || (mode === 'auto' && !envPath)) {
  // 本地 file: 依赖
  const localPath = '../codecast/AgentPrimordia/sdk/typescript'
  if (!existsSync(resolve(process.cwd(), localPath))) {
    console.error(`[SDK Setup] Local SDK not found at ${localPath}`)
    console.error('[SDK Setup] Set AELA_SDK_PATH or use --npm mode')
    process.exit(1)
  }
  sdkValue = `file:${localPath}`
  sdkSource = 'local'
} else if (envPath) {
  // 环境变量指定路径
  sdkValue = `file:${envPath}`
  sdkSource = 'env'
} else {
  // 自动检测
  const localPath = '../codecast/AgentPrimordia/sdk/typescript'
  if (existsSync(resolve(process.cwd(), localPath))) {
    sdkValue = `file:${localPath}`
    sdkSource = 'local-auto'
  } else {
    sdkValue = '@agentprimordia/sdk'
    sdkSource = 'npm-fallback'
  }
}

// 更新 package.json
if (pkg.devDependencies) {
  pkg.devDependencies['@agentprimordia/sdk'] = sdkValue
}

writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
console.log(`[SDK Setup] Source: ${sdkSource}, Value: ${sdkValue}`)
