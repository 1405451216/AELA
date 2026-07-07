import { describe, it, expect, beforeEach } from 'vitest'
import { ContextCollector } from '../../src/main/services/ContextCollector'

describe('ContextCollector', () => {
  let collector: ContextCollector

  beforeEach(() => {
    collector = new ContextCollector()
  })

  describe('updateEditor', () => {
    it('合并部分更新', async () => {
      collector.updateEditor({ activeFile: '/test/file.ts', cursorLine: 10 })
      collector.updateEditor({ selectedText: 'hello' })
      const block = await collector.collect()
      expect(block.activeFile?.activeFile).toBe('/test/file.ts')
      expect(block.activeFile?.cursorLine).toBe(10)
      expect(block.activeFile?.selectedText).toBe('hello')
    })

    it('返回正确结构', async () => {
      collector.updateEditor({ activeFile: '/test/file.ts', cursorLine: 5 })
      const block = await collector.collect()
      expect(block).toHaveProperty('timestamp')
      expect(block).toHaveProperty('terminalHistory')
      expect(block.terminalHistory).toEqual([])
    })
  })

  describe('addTerminalOutput', () => {
    it('添加终端记录', () => {
      collector.addTerminalOutput('ls', 'file1.ts file2.ts')
      expect(collector['terminalHistory'].length).toBe(1)
      expect(collector['terminalHistory'][0].command).toBe('ls')
    })

    it('超出 20 条时自动淘汰旧记录', () => {
      for (let i = 0; i < 25; i++) {
        collector.addTerminalOutput(`cmd-${i}`, `output-${i}`)
      }
      expect(collector['terminalHistory'].length).toBe(20)
      expect(collector['terminalHistory'][0].command).toBe('cmd-5')
      expect(collector['terminalHistory'][19].command).toBe('cmd-24')
    })

    it('截断超过 500 字符的输出', () => {
      const longOutput = 'x'.repeat(1000)
      collector.addTerminalOutput('cmd', longOutput)
      expect(collector['terminalHistory'][0].output.length).toBe(500)
    })
  })

  describe('collect', () => {
    it('无工作区时不收集 git 状态', async () => {
      const block = await collector.collect()
      expect(block.gitStatus).toBeUndefined()
    })

    it('包含 timestamp', async () => {
      collector.updateEditor({ activeFile: '/test/file.ts' })
      const block = await collector.collect()
      expect(block).toHaveProperty('timestamp')
    })
  })

  describe('formatForPrompt', () => {
    it('生成包含活跃文件的 prompt', async () => {
      collector.updateEditor({ activeFile: '/test/file.ts', cursorLine: 10, selectedText: 'hello' })
      const block = await collector.collect()
      const prompt = collector.formatForPrompt(block)
      expect(prompt).toContain('/test/file.ts')
      expect(prompt).toContain('10')
      expect(prompt).toContain('hello')
    })

    it('包含终端历史', async () => {
      collector.addTerminalOutput('ls', 'file.ts')
      const block = await collector.collect()
      const prompt = collector.formatForPrompt(block)
      expect(prompt).toContain('ls')
    })
  })
})
