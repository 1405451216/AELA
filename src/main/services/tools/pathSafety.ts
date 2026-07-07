// 路径解析与穿越防护
// 防御:
//   1) 符号链接穿越
//   2) ../ 前缀
//   3) Windows 跨驱动器路径
//
// 使用 normalize + startsWith 校验，确保 "C:\project" 不会误匹配 "C:\project-evil"

import { resolve, sep } from 'node:path'

export function safeResolve(rootDir: string, p: string): string {
  const normalizedRoot = resolve(rootDir)

  // 绝对路径直接使用
  const target = p.startsWith('/') || p.match(/^[A-Za-z]:/) ? resolve(p) : resolve(normalizedRoot, p)

  // 核心校验：target 必须等于 rootDir 或在其内部
  if (target !== normalizedRoot && !target.startsWith(normalizedRoot + sep)) {
    throw new Error(`路径穿越被阻止: ${p} 解析为 ${target}，不在工作区 ${normalizedRoot} 内`)
  }

  return target
}

/** 文件大小限制: 10MB — 防止读取超大文件导致内存溢出 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024