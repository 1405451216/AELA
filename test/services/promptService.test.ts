import { describe, it, expect, beforeEach, vi } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// mock electron-store，避免测试环境中缺少 Electron app 的问题
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      private data: Record<string, any>
      constructor(opts: any) {
        this.data = opts?.defaults ?? {}
      }
      get(key: string, defaultValue?: any) {
        return this.data[key] ?? defaultValue
      }
      set(key: string, value: any) {
        this.data[key] = value
      }
    }
  }
})

import { PromptService } from '../../src/main/services/PromptService'

describe('PromptService', () => {
  let ps: PromptService

  beforeEach(() => {
    ps = new PromptService()
  })

  describe('register and render', () => {
    it('registers a named template and renders it with variables', () => {
      ps.register('greeting', 'Hello {{.name}}, you are {{.age}} years old.')
      const result = ps.render('greeting', { name: 'Alice', age: 30 })
      expect(result).toContain('Hello Alice')
      expect(result).toContain('30 years old')
    })

    it('throws when rendering a non-existent template', () => {
      expect(() => ps.render('nonexistent', {})).toThrow('不存在')
    })

    it('checks if template exists with has()', () => {
      ps.register('test', 'Hello')
      expect(ps.has('test')).toBe(true)
      expect(ps.has('missing')).toBe(false)
    })
  })

  describe('conditionals', () => {
    it('renders conditional block when variable is truthy', () => {
      ps.register('cond', 'Start{{if .show}}VISIBLE{{end}}End')
      expect(ps.render('cond', { show: true })).toBe('StartVISIBLEEnd')
    })

    it('omits conditional block when variable is falsy', () => {
      ps.register('cond', 'Start{{if .show}}VISIBLE{{end}}End')
      expect(ps.render('cond', { show: false })).toBe('StartEnd')
    })

    it('omits conditional block when variable is missing', () => {
      ps.register('cond', 'Start{{if .show}}VISIBLE{{end}}End')
      expect(ps.render('cond', {})).toBe('StartEnd')
    })
  })

  describe('ranges (loops)', () => {
    it('iterates over array of primitives', () => {
      ps.register('loop', '{{range .items}}- {{.}}\n{{end}}')
      const result = ps.render('loop', { items: ['a', 'b', 'c'] })
      expect(result).toContain('- a')
      expect(result).toContain('- b')
      expect(result).toContain('- c')
    })

    it('iterates over array of objects', () => {
      ps.register('loop', '{{range .users}}{{.name}} {{.age}}\n{{end}}')
      const result = ps.render('loop', {
        users: [
          { name: 'Alice', age: '30' },
          { name: 'Bob', age: '25' },
        ],
      })
      expect(result).toContain('Alice 30')
      expect(result).toContain('Bob 25')
    })

    it('renders empty string for empty array', () => {
      ps.register('loop', '{{range .items}}- {{.}}\n{{end}}')
      expect(ps.render('loop', { items: [] })).toBe('')
    })
  })

  describe('delete', () => {
    it('deletes an existing template', () => {
      ps.register('temp', 'Hello')
      expect(ps.has('temp')).toBe(true)
      ps.delete('temp')
      expect(ps.has('temp')).toBe(false)
    })

    it('returns false when deleting non-existent template', () => {
      expect(ps.delete('nonexistent')).toBe(false)
    })
  })

  describe('list', () => {
    it('lists all registered template names', () => {
      const names = ps.list()
      expect(names).toContain('agent.system')
      expect(names).toContain('rag.system')
      expect(names).toContain('tool.system')
      expect(names).toContain('code.system')
    })

    it('includes custom templates in list', () => {
      ps.register('custom.template', 'Hello')
      const names = ps.list()
      expect(names).toContain('custom.template')
    })
  })

  describe('listDetailed', () => {
    it('returns entries with name and description', () => {
      const entries = ps.listDetailed()
      for (const entry of entries) {
        expect(typeof entry.name).toBe('string')
        expect(typeof entry.description).toBe('string')
      }
    })
  })

  describe('message templates', () => {
    it('sets and renders a system message template', () => {
      ps.setMessageTemplate('system', 'System: {{.role}}')
      const result = ps.renderMessage('system', { role: 'assistant' })
      expect(result).toBe('System: assistant')
    })

    it('throws when rendering an unregistered message template', () => {
      expect(() => ps.renderMessage('assistant', {})).toThrow('不存在')
    })
  })

  describe('Few-Shot', () => {
    it('creates a few-shot template and checks existence with hasFewShot', () => {
      ps.createFewShot('test.fs', { maxExamples: 3 })
      expect(ps.hasFewShot('test.fs')).toBe(true)
      expect(ps.hasFewShot('nonexistent')).toBe(false)
    })

    it('adds examples and retrieves them', () => {
      const fs = ps.createFewShot('test.fs', { maxExamples: 5 })
      fs.addExample('hello', 'world')
      fs.addExample('foo', 'bar')

      const examples = ps.getFewShotExamples('test.fs')
      expect(examples.length).toBe(2)
      expect(examples[0].input).toBe('hello')
      expect(examples[0].output).toBe('world')
    })

    it('renders few-shot with examples included', () => {
      const fs = ps.createFewShot('test.fs', {
        baseTemplate: '{{.examples}}',
        prefix: '--- START ---\n',
        suffix: '\n--- END ---',
        maxExamples: 3,
      })
      fs.addExample('question 1', 'answer 1')

      const result = ps.renderFewShot('test.fs', 'new question')
      expect(result).toContain('question 1')
      expect(result).toContain('answer 1')
    })

    it('limits examples to maxExamples', () => {
      const fs = ps.createFewShot('test.fs', {
        baseTemplate: '{{.examples}}',
        maxExamples: 2,
      })
      fs.addExample('q1', 'a1')
      fs.addExample('q2', 'a2')
      fs.addExample('q3', 'a3')
      fs.addExample('q4', 'a4')

      const examples = ps.getFewShotExamples('test.fs')
      expect(examples.length).toBe(4) // getExamples returns all

      // But render should only include maxExamples
      const result = ps.renderFewShot('test.fs', 'input')
      // Count how many "输入:" appear (should be 2 max)
      const matches = result.match(/输入:/g)
      expect(matches).not.toBeNull()
      expect(matches!.length).toBeLessThanOrEqual(2)
    })

    it('returns empty array for non-existent few-shot template', () => {
      expect(ps.getFewShotExamples('nonexistent')).toEqual([])
    })

    it('adds examples via addFewShotExample method', () => {
      ps.createFewShot('test.fs', { maxExamples: 3 })
      ps.addFewShotExample('test.fs', 'input1', 'output1')
      const examples = ps.getFewShotExamples('test.fs')
      expect(examples.length).toBe(1)
      expect(examples[0].input).toBe('input1')
    })
  })

  describe('predefined templates', () => {
    it('has agent.system template with role variable', () => {
      expect(ps.has('agent.system')).toBe(true)
      const result = ps.render('agent.system', { role: 'coder', language: '中文' })
      expect(result).toContain('coder')
      expect(result).toContain('中文')
    })

    it('has rag.system template with context variable', () => {
      expect(ps.has('rag.system')).toBe(true)
      const result = ps.render('rag.system', { context: 'Some context here' })
      expect(result).toContain('Some context here')
    })

    it('has code.system template with language variable', () => {
      expect(ps.has('code.system')).toBe(true)
      const result = ps.render('code.system', { language: 'TypeScript' })
      expect(result).toContain('TypeScript')
    })
  })
})
