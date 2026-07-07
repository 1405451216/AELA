// 工作区管理器
// 管理项目目录、文件树、文件读写

import { dialog } from 'electron'
import { readdir, stat, readFile } from 'node:fs/promises'
import { join, extname, relative, resolve, sep } from 'node:path'
import type { FileTreeNode } from '@shared/types'

// 允许读取的根目录列表（由 IPC 层在打开工作区时设置）
// 如果设置了此列表，readFile/searchFiles 将拒绝读取根目录之外的文件
let allowedRoots: string[] = []
export function setAllowedRoots(roots: string[]): void {
  allowedRoots = roots.map(r => resolve(r))
}
function isPathAllowed(filePath: string): boolean {
  if (allowedRoots.length === 0) return true // 未设置限制时允许全部（向后兼容）
  const resolved = resolve(filePath)
  return allowedRoots.some(root => resolved === root || resolved.startsWith(root + sep))
}

// 检测可能的 ReDoS 正则模式（嵌套量词等）
function isPotentialReDoS(pattern: string): boolean {
  // 检测嵌套量词: (a+)+, (a*)*, (a{1,3})+ 等
  if (/\([^)]*[+*?][^)]*\)[+*?]/.test(pattern)) return true
  // 检测重叠量词: a+a+, a*a* 等（简化检测）
  if (/[a-zA-Z][+*]{1}[a-zA-Z][+*]{1}/.test(pattern)) return true
  // 限制正则长度，过长的正则可能有性能问题
  if (pattern.length > 200) return true
  return false
}

export class WorkspaceManager {
  /**
   * 打开文件夹选择对话框
   */
  async selectFolder(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  }

  /**
   * 读取文件内容
   */
  async readFile(filePath: string): Promise<string> {
    if (!isPathAllowed(filePath)) {
      throw new Error(`访问被拒绝: 路径 ${filePath} 不在允许的工作区范围内`)
    }
    return readFile(filePath, 'utf-8')
  }

  /**
   * 构建文件树
   */
  async getFileTree(rootPath: string, maxDepth: number = 4): Promise<FileTreeNode> {
    return this.buildNode(rootPath, rootPath, 0, maxDepth)
  }

  /**
   * 递归构建文件树节点
   */
  private async buildNode(
    fullPath: string,
    rootPath: string,
    depth: number,
    maxDepth: number
  ): Promise<FileTreeNode> {
    const name = fullPath === rootPath ? 'root' : fullPath.split(/[/\\]/).pop() || ''
    const stats = await stat(fullPath)

    const node: FileTreeNode = {
      name,
      path: relative(rootPath, fullPath) || '.',
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      extension: stats.isFile() ? extname(fullPath) : undefined
    }

    if (stats.isDirectory() && depth < maxDepth) {
      try {
        const entries = await readdir(fullPath, { withFileTypes: true })
        const filtered = entries.filter(e => {
          // 过滤隐藏文件和常见忽略目录
          if (e.name.startsWith('.')) return false
          if (['node_modules', '__pycache__', 'dist', 'build', '.git', 'target', 'vendor'].includes(e.name)) return false
          return true
        })
        filtered.sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
          return a.name.localeCompare(b.name)
        })

        node.children = []
        for (const entry of filtered) {
          const childPath = join(fullPath, entry.name)
          const childNode = await this.buildNode(childPath, rootPath, depth + 1, maxDepth)
          node.children.push(childNode)
        }
      } catch {
        // 无权限访问的目录跳过
      }
    }

    return node
  }

  /**
   * 搜索工作区文件
   */
  async searchFiles(
    rootPath: string,
    query: string,
    options: { extension?: string; maxResults?: number } = {}
  ): Promise<Array<{ path: string; line: number; content: string }>> {
    const maxResults = options.maxResults ?? 50
    const results: Array<{ path: string; line: number; content: string }> = []

    // ReDoS 防护: 检测潜在的危险正则模式
    let regex: RegExp
    if (isPotentialReDoS(query)) {
      // 使用转义后的字面量进行搜索，而非正则
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      regex = new RegExp(escaped, 'i')
    } else {
      try {
        regex = new RegExp(query, 'i')
      } catch {
        regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      }
    }

    await this.searchDir(rootPath, rootPath, regex, options.extension, results, maxResults)
    return results
  }

  private async searchDir(
    dir: string,
    root: string,
    regex: RegExp,
    extension: string | undefined,
    results: Array<{ path: string; line: number; content: string }>,
    max: number
  ): Promise<void> {
    if (results.length >= max) return

    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (results.length >= max) return
      if (entry.name.startsWith('.') || ['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue

      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await this.searchDir(fullPath, root, regex, extension, results, max)
      } else {
        if (extension && extname(entry.name) !== extension) continue
        const ext = extname(entry.name)
        if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.zip', '.gz', '.tar', '.exe', '.dll'].includes(ext)) continue

        try {
          const content = await readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          const relPath = relative(root, fullPath)
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push({ path: relPath, line: i + 1, content: lines[i].trim() })
              if (results.length >= max) return
            }
          }
        } catch {
          // 跳过无法读取的文件
        }
      }
    }
  }
}
