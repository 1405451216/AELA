// Builtin tools: 数据加载器（CSV / JSON / Markdown）+ 计算器 + 日期时间
// 拆分自 ToolManager.ts，2026-07-01 重构

import type { Tool } from '@agentprimordia/sdk'
import { readFile } from 'node:fs/promises'
import { safeResolve } from '../pathSafety'
import { safeMathEval } from '../mathParser'

// ===== CSV 加载器 =====
export class CsvLoaderTool implements Tool {
  name = 'load_csv'
  description = '加载 CSV 文件并解析为结构化数据。'
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'CSV 文件路径' },
      delimiter: { type: 'string', description: '分隔符，默认逗号' },
      maxRows: { type: 'number', description: '最大返回行数，默认 100' }
    },
    required: ['path']
  }

  constructor(private rootDir: string) {}

  async execute(args: { path: string; delimiter?: string; maxRows?: number }): Promise<string> {
    const filePath = this.resolvePath(args.path)
    const content = await readFile(filePath, 'utf-8')
    const delimiter = args.delimiter ?? ','
    const maxRows = args.maxRows ?? 100
    const lines = content.split('\n').filter(l => l.trim())
    if (lines.length === 0) return 'CSV 文件为空'

    const headers = lines[0].split(delimiter).map(h => h.trim())
    const rows: string[] = []
    rows.push(`| ${headers.join(' | ')} |`)
    rows.push(`| ${headers.map(() => '---').join(' | ')} |`)
    for (let i = 1; i < Math.min(lines.length, maxRows + 1); i++) {
      const cells = lines[i].split(delimiter).map(c => c.trim())
      rows.push(`| ${cells.join(' | ')} |`)
    }
    return `CSV: ${args.path} (${Math.min(lines.length - 1, maxRows)}/${lines.length - 1} 行)\n\n${rows.join('\n')}`
  }

  private resolvePath(p: string): string {
    return safeResolve(this.rootDir, p)
  }
}

// ===== JSON 加载器 =====
export class JsonLoaderTool implements Tool {
  name = 'load_json'
  description = '加载 JSON 文件并格式化显示。'
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'JSON 文件路径' },
      query: { type: 'string', description: 'JSONPath 查询表达式（可选）' }
    },
    required: ['path']
  }

  constructor(private rootDir: string) {}

  async execute(args: { path: string; query?: string }): Promise<string> {
    const filePath = this.resolvePath(args.path)
    const content = await readFile(filePath, 'utf-8')
    try {
      const data = JSON.parse(content)
      return `JSON: ${args.path}\n\n${JSON.stringify(data, null, 2).slice(0, 10000)}`
    } catch {
      return `文件不是有效的 JSON: ${args.path}\n\n${content.slice(0, 5000)}`
    }
  }

  private resolvePath(p: string): string {
    return safeResolve(this.rootDir, p)
  }
}

// ===== Markdown 加载器 =====
export class MarkdownLoaderTool implements Tool {
  name = 'load_markdown'
  description = '加载 Markdown 文件并提取标题结构。'
  parameters = {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Markdown 文件路径' },
      extractCodeBlocks: { type: 'boolean', description: '是否提取代码块，默认 false' }
    },
    required: ['path']
  }

  constructor(private rootDir: string) {}

  async execute(args: { path: string; extractCodeBlocks?: boolean }): Promise<string> {
    const filePath = this.resolvePath(args.path)
    const content = await readFile(filePath, 'utf-8')
    const headings = content.match(/^#{1,6}\s+.+$/gm) ?? []
    let result = `Markdown: ${args.path}\n\n## 标题结构\n${headings.join('\n')}`
    if (args.extractCodeBlocks) {
      const codeBlocks = content.match(/```[\s\S]*?```/g) ?? []
      result += `\n\n## 代码块 (${codeBlocks.length})\n${codeBlocks.join('\n\n')}`
    }
    return result.slice(0, 10000)
  }

  private resolvePath(p: string): string {
    return safeResolve(this.rootDir, p)
  }
}

// ===== 计算器 =====
export class CalculatorTool implements Tool {
  name = 'calculator'
  description = '执行数学计算。支持基本运算、三角函数、对数等。'
  parameters = {
    type: 'object' as const,
    properties: {
      expression: { type: 'string', description: '数学表达式，如 "2+3*4", "sin(3.14)", "log(100)"' }
    },
    required: ['expression']
  }

  async execute(args: { expression: string }): Promise<string> {
    try {
      const result = safeMathEval(args.expression)
      if (!isFinite(result)) return `${args.expression} = ${result} (无穷大或非数)`
      return `${args.expression} = ${result}`
    } catch (err: unknown) {
      return `计算失败: ${err instanceof Error ? err.message : String(err)}`
    }
  }
}

// ===== 日期时间 =====
export class DateTimeTool implements Tool {
  name = 'datetime'
  description = '获取当前日期时间或格式化指定时间戳。'
  parameters = {
    type: 'object' as const,
    properties: {
      timezone: { type: 'string', description: '时区，如 Asia/Shanghai，默认本地' },
      format: { type: 'string', description: '格式字符串，默认 ISO' },
      timestamp: { type: 'number', description: 'Unix 时间戳（可选）' }
    },
    required: []
  }

  async execute(args: { timezone?: string; format?: string; timestamp?: number }): Promise<string> {
    const date = args.timestamp ? new Date(args.timestamp * 1000) : new Date()
    if (args.timezone) {
      return date.toLocaleString('zh-CN', { timeZone: args.timezone })
    }
    return date.toISOString()
  }
}
