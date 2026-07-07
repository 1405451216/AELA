// 自动测试生成服务
// 1. 静态分析源文件（函数、类、导入）
// 2. 基于 LLM 生成测试代码
// 3. 执行测试并返回结果

import { readFile, writeFile } from 'node:fs/promises'
import { join, extname, basename, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import type { TestGenAnalysis, TestGenResult } from '@shared/types'

export class TestGenService {
  private rootDir: string
  private llmCall: ((prompt: string, modelConfigId: string) => Promise<string>) | null

  constructor(rootDir: string, llmCall?: (prompt: string, modelConfigId: string) => Promise<string>) {
    this.rootDir = rootDir
    this.llmCall = llmCall || null
  }

  /**
   * 获取根目录
   */
  getRootDir(): string {
    return this.rootDir
  }

  /**
   * 静态分析源文件
   */
  async analyze(filePath: string): Promise<TestGenAnalysis> {
    const absPath = filePath.startsWith('/') || filePath.match(/^[A-Za-z]:/) ? filePath : join(this.rootDir, filePath)
    const content = await readFile(absPath, 'utf-8')
    const ext = extname(absPath).toLowerCase()

    const language = this.detectLanguage(ext)
    const analysis = this.parseCode(content, language)
    analysis.filePath = filePath
    return analysis
  }

  /**
   * 生成测试代码
   */
  async generate(filePath: string, modelConfigId: string): Promise<TestGenResult> {
    const analysis = await this.analyze(filePath)

    // 构造 LLM prompt
    const prompt = this.buildPrompt(analysis, filePath)

    let testContent: string
    if (this.llmCall) {
      testContent = await this.llmCall(prompt, modelConfigId)
      // 清理 LLM 可能的 markdown 包裹
      testContent = this.stripMarkdown(testContent)
    } else {
      // 无 LLM 时生成基础模板
      testContent = this.generateTemplate(analysis, filePath)
    }

    const testFilePath = this.getTestFilePath(filePath, analysis.language)
    const framework = analysis.frameworkSuggestion
    const coverageTargets = [
      ...analysis.functions.map(f => f.name),
      ...analysis.classes.map(c => c.name),
    ]

    return {
      testFilePath,
      testContent,
      framework,
      coverageTargets,
      analysis,
    }
  }

  /**
   * 执行测试
   */
  async run(testFilePath: string): Promise<{ success: boolean; output: string; passed: number; failed: number }> {
    return new Promise((resolve) => {
      const absPath = testFilePath.startsWith('/') || testFilePath.match(/^[A-Za-z]:/) ? testFilePath : join(this.rootDir, testFilePath)
      const ext = extname(absPath).toLowerCase()

      let command: string
      let args: string[]

      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
        command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
        args = ['vitest', 'run', absPath, '--reporter=verbose']
      } else if (ext === '.py') {
        command = process.platform === 'win32' ? 'python.exe' : 'python'
        args = ['-m', 'pytest', absPath, '-v']
      } else {
        resolve({ success: false, output: `Unsupported test file type: ${ext}`, passed: 0, failed: 0 })
        return
      }

      const proc = spawn(command, args, {
        cwd: this.rootDir,
        shell: false,
        env: { ...process.env, FORCE_COLOR: '0' },
      })

      let output = ''
      proc.stdout.on('data', (data) => { output += data.toString() })
      proc.stderr.on('data', (data) => { output += data.toString() })

      proc.on('close', (code) => {
        const { passed, failed } = this.parseTestOutput(output, ext)
        resolve({
          success: code === 0,
          output,
          passed,
          failed,
        })
      })

      proc.on('error', (err) => {
        resolve({
          success: false,
          output: `Failed to run test: ${err.message}`,
          passed: 0,
          failed: 0,
        })
      })
    })
  }

  /**
   * 写入测试文件到磁盘
   */
  async writeTestFile(testFilePath: string, content: string): Promise<void> {
    const absPath = join(this.rootDir, testFilePath)
    await import('node:fs/promises').then(fs => fs.mkdir(dirname(absPath), { recursive: true }))
    await writeFile(absPath, content, 'utf-8')
  }

  // ===== 私有方法 =====

  private detectLanguage(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.rb': 'ruby',
    }
    return map[ext] || 'unknown'
  }

  private parseCode(content: string, language: string): TestGenAnalysis {
    const functions: TestGenAnalysis['functions'] = []
    const classes: TestGenAnalysis['classes'] = []
    const imports: string[] = []

    if (language === 'typescript' || language === 'javascript') {
      // 匹配函数声明
      const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*{/g
      let match: RegExpExecArray | null
      while ((match = funcRegex.exec(content)) !== null) {
        const lineStart = content.substring(0, match.index).split('\n').length
        functions.push({
          name: match[1],
          params: match[2].trim(),
          returnType: match[3]?.trim() || 'void',
          lineStart,
          lineEnd: lineStart,
        })
      }

      // 匹配箭头函数
      const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*=>/g
      while ((match = arrowRegex.exec(content)) !== null) {
        const lineStart = content.substring(0, match.index).split('\n').length
        functions.push({
          name: match[1],
          params: match[2].trim(),
          returnType: match[3]?.trim() || 'void',
          lineStart,
          lineEnd: lineStart,
        })
      }

      // 匹配类
      const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*{([\s\S]*?)^}/gm
      while ((match = classRegex.exec(content)) !== null) {
        const lineStart = content.substring(0, match.index).split('\n').length
        const body = match[2]
        const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+?)?\s*{/g
        const methods: string[] = []
        let m: RegExpExecArray | null
        while ((m = methodRegex.exec(body)) !== null) {
          if (m[1] !== 'constructor') methods.push(m[1])
        }
        classes.push({
          name: match[1],
          methods,
          lineStart,
          lineEnd: lineStart + body.split('\n').length,
        })
      }

      // 匹配导入
      const importRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1])
      }

      return {
        filePath: '',
        language,
        functions,
        classes,
        imports,
        frameworkSuggestion: 'vitest',
      }
    }

    if (language === 'python') {
      const funcRegex = /def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/g
      let match: RegExpExecArray | null
      while ((match = funcRegex.exec(content)) !== null) {
        const lineStart = content.substring(0, match.index).split('\n').length
        functions.push({
          name: match[1],
          params: match[2].trim(),
          returnType: match[3]?.trim() || '',
          lineStart,
          lineEnd: lineStart,
        })
      }

      const classRegex = /class\s+(\w+)(?:\([^)]*\))?\s*:\n([\s\S]*?)(?=\nclass\s|\n\ndef\s|$)/g
      while ((match = classRegex.exec(content)) !== null) {
        const lineStart = content.substring(0, match.index).split('\n').length
        const body = match[2]
        const methodRegex = /def\s+(\w+)\s*\(/g
        const methods: string[] = []
        let m: RegExpExecArray | null
        while ((m = methodRegex.exec(body)) !== null) {
          if (m[1] !== '__init__') methods.push(m[1])
        }
        classes.push({
          name: match[1],
          methods,
          lineStart,
          lineEnd: lineStart + body.split('\n').length,
        })
      }

      return {
        filePath: '',
        language,
        functions,
        classes,
        imports,
        frameworkSuggestion: 'pytest',
      }
    }

    return {
      filePath: '',
      language,
      functions,
      classes,
      imports,
      frameworkSuggestion: 'unknown',
    }
  }

  private buildPrompt(analysis: TestGenAnalysis, filePath: string): string {
    const funcList = analysis.functions.map(f => `- ${f.name}(${f.params}): ${f.returnType}`).join('\n')
    const classList = analysis.classes.map(c => `- class ${c.name}: ${c.methods.join(', ')}`).join('\n')

    return `你是一个测试工程师。请为以下文件生成完整的单元测试代码。

文件: ${filePath}
语言: ${analysis.language}
测试框架: ${analysis.frameworkSuggestion}

函数:
${funcList || '(无)'}

类:
${classList || '(无)'}

要求:
1. 为每个公开函数和方法生成测试用例
2. 包含正常路径、边界条件和错误场景
3. 使用 ${analysis.frameworkSuggestion} 框架
4. 只输出测试代码，不要 markdown 包裹
5. 包含必要的 import 语句`
  }

  private generateTemplate(analysis: TestGenAnalysis, filePath: string): string {
    const importPath = filePath.replace(/\.\w+$/, '')

    if (analysis.language === 'python') {
      const testFuncs = analysis.functions.map(f =>
`def test_${f.name}():
    """测试 ${f.name}"""
    # TODO: 实现测试逻辑
    pass`).join('\n\n')

      return `import pytest
from ${importPath.replace(/\//g, '.')} import *

${testFuncs}`
    }

    const testFuncs = analysis.functions.map(f =>
`  it('${f.name} - 正常路径', () => {
    // TODO: 实现测试
  })

  it('${f.name} - 边界条件', () => {
    // TODO: 实现边界测试
  })

  it('${f.name} - 错误场景', () => {
    // TODO: 实现错误测试
  })`).join('\n\n')

    return `import { describe, it, expect } from 'vitest'
import { ${analysis.functions.map(f => f.name).join(', ')} } from './${importPath}'

describe('${filePath}', () => {
${testFuncs}
})`
  }

  private getTestFilePath(filePath: string, language: string): string {
    const dir = dirname(filePath)
    const base = basename(filePath, extname(filePath))
    if (language === 'python') {
      return join(dir, `test_${base}.py`)
    }
    return join(dir, `${base}.test.ts`)
  }

  private stripMarkdown(text: string): string {
    // 去除 ```ts ... ``` 或 ```python ... ``` 包裹
    const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/)
    return match ? match[1].trim() : text.trim()
  }

  private parseTestOutput(output: string, ext: string): { passed: number; failed: number } {
    if (ext === '.py') {
      const passedMatch = output.match(/(\d+)\s+passed/)
      const failedMatch = output.match(/(\d+)\s+failed/)
      return {
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : 0,
      }
    }
    // vitest
    const passedMatch = output.match(/(\d+)\s+passed/)
    const failedMatch = output.match(/(\d+)\s+failed/)
    return {
      passed: passedMatch ? parseInt(passedMatch[1]) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]) : 0,
    }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
