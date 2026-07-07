#!/usr/bin/env node
/**
 * SDK 可用性检查（postinstall 钩子）
 * 不阻止安装，仅提供诊断信息
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const sdkModulePath = resolve(process.cwd(), 'node_modules/@agentprimordia/sdk')
const hasSdk = existsSync(sdkModulePath)

if (hasSdk) {
  console.log('[check-sdk] @agentprimordia/sdk resolved OK')
} else {
  console.warn('[check-sdk] ⚠ @agentprimordia/sdk not found in node_modules')
  console.warn('[check-sdk]   → If developing: npm run setup:sdk && npm install')
  console.warn('[check-sdk]   → If building: set AELA_SDK_PATH env var to SDK source root')
  console.warn('[check-sdk]   → CI installs from file: dep; ensure SDK is at ../codecast/AgentPrimordia/sdk/typescript')
}
