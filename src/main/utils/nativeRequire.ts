/**
 * 原生模块延迟加载工具
 *
 * 在 ESM + asar 归档环境中，模块顶层 require() 原生模块可能在导入阶段崩溃。
 * 本工具将 require 延迟到首次调用时执行，并缓存结果。
 */

import { createRequire } from 'node:module'

const _require = createRequire(import.meta.url)
const _cache = new Map<string, unknown>()

/**
 * 延迟加载 CommonJS 模块（仅首次调用时 require，后续返回缓存）
 * @param module 模块名，如 'better-sqlite3'、'tar'
 */
export function lazyRequire<T>(module: string): T {
  if (!_cache.has(module)) {
    _cache.set(module, _require(module))
  }
  return _cache.get(module) as T
}
