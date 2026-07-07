// 代码审查服务
// 1. 读取文件内容
// 2. 静态规则扫描（安全、性能、风格）
// 3. 可选 LLM 增强 review
// 4. 生成结构化审查报告

import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { randomUUID } from 'crypto'
import type { CodeReviewResult, ReviewIssue } from '@shared/types'

// 静态审查规则
interface ReviewRule {
  id: string
  category: string
  severity: ReviewIssue['severity']
  pattern: RegExp
  message: string
  suggestion?: string
  languages?: string[] // 适用的语言，空=全部
}

const STATIC_RULES: ReviewRule[] = [
  // 安全规则
  {
    id: 'SEC001',
    category: 'security',
    severity: 'critical',
    pattern: /eval\s*\(/g,
    message: '使用 eval() 存在代码注入风险',
    suggestion: '避免使用 eval，考虑使用 Function 构造器或 JSON.parse',
    languages: ['typescript', 'javascript'],
  },
  {
    id: 'SEC002',
    category: 'security',
    severity: 'critical',
    pattern: /innerHTML\s*=/g,
    message: '直接赋值 innerHTML 存在 XSS 风险',
    suggestion: '使用 textContent 或 DOM API 替代',
    languages: ['typescript', 'javascript'],
  },
  {
    id: 'SEC003',
    category: 'security',
    severity: 'error',
    pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi,
    message: '检测到硬编码密码',
    suggestion: '使用环境变量或密钥管理服务',
  },
  {
    id: 'SEC004',
    category: 'security',
    severity: 'error',
    pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
    message: '检测到硬编码 API Key',
    suggestion: '使用环境变量管理 API 密钥',
  },
  {
    id: 'SEC005',
    category: 'security',
    severity: 'warning',
    pattern: /exec\s*\(|execSync\s*\(/g,
    message: '使用 exec/execSync 可能存在命令注入风险',
    suggestion: '使用 spawn 并验证输入参数',
    languages: ['typescript', 'javascript'],
  },

  // 性能规则
  {
    id: 'PERF001',
    category: 'performance',
    severity: 'warning',
    pattern: /console\.log\s*\(/g,
    message: '生产代码中存在 console.log',
    suggestion: '使用条件日志或移除调试日志',
    languages: ['typescript', 'javascript'],
  },
  {
    id: 'PERF002',
    category: 'performance',
    severity: 'warning',
    pattern: /JSON\.parse\s*\(/g,
    message: 'JSON.parse 在循环中可能影响性能',
    suggestion: '在循环外解析 JSON',
  },
  {
    id: 'PERF003',
    category: 'performance',
    severity: 'info',
    pattern: /var\s+\w+/g,
    message: '使用 var 声明变量',
    suggestion: '使用 let 或 const 替代 var',
    languages: ['typescript', 'javascript'],
  },
  {
    id: 'PERF004',
    category: 'performance',
    severity: 'warning',
    pattern: /await\s+.*\bfor\s*\(|\.forEach\s*\(\s*async/g,
    message: '在循环中使用 await 可能导致性能问题',
    suggestion: '使用 Promise.all 并行执行',
    languages: ['typescript', 'javascript'],
  },

  // 风格规则
  {
    id: 'STYLE001',
    category: 'style',
    severity: 'info',
    pattern: /\bany\b/g,
    message: '使用 any 类型会失去类型安全',
    suggestion: '使用具体类型或 unknown',
    languages: ['typescript'],
  },
  {
    id: 'STYLE002',
    category: 'style',
    severity: 'info',
    pattern: /:\s*any\s*[\];,=)]/g,
    message: '显式 any 类型标注',
    suggestion: '定义更具体的类型',
    languages: ['typescript'],
  },
  {
    id: 'STYLE003',
    category: 'style',
    severity: 'info',
    pattern: /TODO|FIXME|HACK|XXX/g,
    message: '代码中存在待办标记',
    suggestion: '及时处理或创建 Issue',
  },

  // Bug 规则
  {
    id: 'BUG001',
    category: 'bug',
    severity: 'error',
    pattern: /==\s*[^=]/g,
    message: '使用 == 进行比较（类型转换可能导致意外行为）',
    suggestion: '使用 === 严格相等比较',
    languages: ['typescript', 'javascript'],
  },
  {
    id: 'BUG002',
    category: 'bug',
    severity: 'warning',
    pattern: /catch\s*\(\s*\w*\s*\)\s*{\s*}/g,
    message: '空 catch 块会吞掉错误',
    suggestion: '至少记录错误日志',
    languages: ['typescript', 'javascript'],
  },
  {
    id: 'BUG003',
    category: 'bug',
    severity: 'error',
    pattern: /return\s*\n\s*\w+\s*[+\-*/]/g,
    message: 'return 后换行可能导致 ASI 问题',
    suggestion: '将 return 值放在同一行或使用括号',
    languages: ['typescript', 'javascript'],
  },
]

export class CodeReviewService {
  private rootDir: string
  private llmCall: ((prompt: string, modelConfigId: string) => Promise<string>) | null
  private reviews: Map<string, CodeReviewResult> = new Map()

  constructor(rootDir: string, llmCall?: (prompt: string, modelConfigId: string) => Promise<string>) {
    this.rootDir = rootDir
    this.llmCall = llmCall || null
  }

  /**
   * 审查文件
   */
  async review(files: string[], modelConfigId: string): Promise<CodeReviewResult> {
    const issues: ReviewIssue[] = []

    for (const filePath of files) {
      const absPath = filePath.startsWith('/') || filePath.match(/^[A-Za-z]:/) ? filePath : join(this.rootDir, filePath)
      try {
        const content = await readFile(absPath, 'utf-8')
        const ext = extname(absPath).toLowerCase()
        const language = this.detectLanguage(ext)

        // 静态规则扫描
        for (const rule of STATIC_RULES) {
          if (rule.languages && !rule.languages.includes(language)) continue

          rule.pattern.lastIndex = 0
          let match: RegExpExecArray | null
          while ((match = rule.pattern.exec(content)) !== null) {
            const lineStart = content.substring(0, match.index).split('\n').length
            issues.push({
              id: randomUUID(),
              filePath,
              lineStart,
              lineEnd: lineStart,
              severity: rule.severity,
              category: rule.category,
              message: rule.message,
              suggestion: rule.suggestion,
              rule: rule.id,
            })
          }
        }

        // LLM 增强审查
        if (this.llmCall && content.length < 10000) {
          try {
          const llmIssues = await this.llmReview(filePath, content, language, modelConfigId)
            issues.push(...llmIssues)
          } catch (err) {
            // LLM 审查失败不阻塞
            console.error('[CodeReviewService] LLM 审查失败:', err)
          }
        }
      } catch (err) {
        // 文件读取失败跳过
        console.error('[CodeReviewService] 文件读取失败:', err)
      }
    }

    // 计算评分
    const score = this.computeScore(issues, files.length)
    const summary = this.generateSummary(issues, files.length, score)
    const approved = score >= 70 && !issues.some(i => i.severity === 'critical')

    const result: CodeReviewResult = {
      id: randomUUID(),
      files,
      issues,
      summary,
      score,
      reviewedAt: new Date().toISOString(),
      approved,
    }

    this.reviews.set(result.id, result)
    return result
  }

  get(id: string): CodeReviewResult | null {
    return this.reviews.get(id) || null
  }

  list(): CodeReviewResult[] {
    return Array.from(this.reviews.values()).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))
  }

  /**
   * 导入外部生成的审查结果（用于 IPC 层动态 LLM 回调场景）
   */
  importResult(result: CodeReviewResult): void {
    this.reviews.set(result.id, result)
  }

  // ===== 私有方法 =====

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript', '.tsx': 'typescript',
      '.js': 'javascript', '.jsx': 'javascript',
      '.py': 'python', '.go': 'go', '.rs': 'rust',
      '.java': 'java', '.cpp': 'cpp', '.c': 'c',
    }
    return map[ext] || 'unknown'
  }

  private async llmReview(filePath: string, content: string, language: string, modelConfigId: string): Promise<ReviewIssue[]> {
    const prompt = `你是一个严格的代码审查员。请审查以下 ${language} 代码，找出潜在问题。

文件: ${filePath}

代码:
\`\`\`${language}
${content}
\`\`\`

请以 JSON 数组格式返回问题，每个问题包含:
- lineStart: 行号
- severity: "info" | "warning" | "error" | "critical"
- category: "security" | "performance" | "style" | "bug"
- message: 问题描述
- suggestion: 修复建议

只返回 JSON 数组，不要其他文本。`

    if (!this.llmCall) return []
    const response = await this.llmCall(prompt, modelConfigId)
    try {
      // 提取 JSON
      const jsonMatch = response.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return []
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        lineStart: number
        severity: string
        category: string
        message: string
        suggestion?: string
      }>
      return parsed.map(item => ({
        id: randomUUID(),
        filePath,
        lineStart: item.lineStart || 1,
        lineEnd: item.lineStart || 1,
        severity: (['info', 'warning', 'error', 'critical'].includes(item.severity) ? item.severity : 'info') as ReviewIssue['severity'],
        category: item.category || 'style',
        message: item.message,
        suggestion: item.suggestion,
        rule: 'LLM',
      }))
    } catch (err) {
      console.error('[CodeReviewService] LLM 审查解析失败:', err)
      return []
    }
  }

  private computeScore(issues: ReviewIssue[], fileCount: number): number {
    let score = 100
    const weights: Record<ReviewIssue['severity'], number> = {
      critical: 25,
      error: 10,
      warning: 5,
      info: 1,
    }
    for (const issue of issues) {
      score -= weights[issue.severity]
    }
    // 按文件数归一化（多文件时问题密度更低）
    if (fileCount > 0) {
      score = Math.max(0, Math.min(100, score + (fileCount - 1) * 2))
    }
    return Math.max(0, score)
  }

  private generateSummary(issues: ReviewIssue[], fileCount: number, score: number): string {
    const bySeverity: Record<string, number> = {}
    const byCategory: Record<string, number> = {}
    for (const i of issues) {
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1
      byCategory[i.category] = (byCategory[i.category] || 0) + 1
    }

    const parts: string[] = []
    parts.push(`审查了 ${fileCount} 个文件，发现 ${issues.length} 个问题。`)
    parts.push(`评分: ${score}/100`)

    const severityText = Object.entries(bySeverity)
      .map(([sev, count]) => `${sev}: ${count}`)
      .join(', ')
    if (severityText) parts.push(`严重程度 — ${severityText}`)

    const categoryText = Object.entries(byCategory)
      .map(([cat, count]) => `${cat}: ${count}`)
      .join(', ')
    if (categoryText) parts.push(`问题分类 — ${categoryText}`)

    if (issues.some(i => i.severity === 'critical')) {
      parts.push('⚠ 存在严重问题，建议立即修复后再合并。')
    } else if (score >= 80) {
      parts.push('✓ 代码质量良好，可以合并。')
    } else if (score >= 60) {
      parts.push('△ 代码质量一般，建议修复 warning 级别问题。')
    } else {
      parts.push('✕ 代码质量较差，需要较多改进。')
    }

    return parts.join('\n')
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
