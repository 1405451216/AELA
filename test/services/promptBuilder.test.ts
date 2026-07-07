import { describe, it, expect } from 'vitest'
import { PromptBuilder } from '../../src/main/services/PromptBuilder'

describe('PromptBuilder', () => {
  describe('resolveVariant', () => {
    it('returns default variant when name is undefined', () => {
      const variant = PromptBuilder.resolveVariant(undefined)
      expect(variant.name).toBe('default')
    })

    it('returns default variant when name is empty string', () => {
      const variant = PromptBuilder.resolveVariant('')
      expect(variant.name).toBe('default')
    })

    it('returns the requested variant when name is valid', () => {
      const variant = PromptBuilder.resolveVariant('concise')
      expect(variant.name).toBe('concise')
    })

    it('falls back to default when variant name does not exist', () => {
      const variant = PromptBuilder.resolveVariant('nonexistent-variant')
      expect(variant.name).toBe('default')
    })

    it('returns safety-first variant correctly', () => {
      const variant = PromptBuilder.resolveVariant('safety-first')
      expect(variant.name).toBe('safety-first')
    })
  })

  describe('listVariants', () => {
    it('returns at least 6 variants', () => {
      const variants = PromptBuilder.listVariants()
      expect(variants.length).toBeGreaterThanOrEqual(6)
    })

    it('includes default variant', () => {
      const variants = PromptBuilder.listVariants()
      expect(variants.some(v => v.name === 'default')).toBe(true)
    })

    it('includes all expected variant names', () => {
      const variants = PromptBuilder.listVariants()
      const names = variants.map(v => v.name)
      expect(names).toContain('default')
      expect(names).toContain('concise')
      expect(names).toContain('safety-first')
      expect(names).toContain('code-reviewer')
      expect(names).toContain('pair-programmer')
      expect(names).toContain('mentor-coach')
    })

    it('every variant has a non-empty description', () => {
      const variants = PromptBuilder.listVariants()
      for (const v of variants) {
        expect(v.description.length).toBeGreaterThan(0)
      }
    })
  })

  describe('resolveModePrompt', () => {
    it('returns daily prompt for office mode', () => {
      const variant = PromptBuilder.resolveVariant('default')
      const prompt = PromptBuilder.resolveModePrompt('office', variant)
      expect(prompt).toBe(variant.daily)
    })

    it('returns coding prompt for code mode', () => {
      const variant = PromptBuilder.resolveVariant('default')
      const prompt = PromptBuilder.resolveModePrompt('code', variant)
      expect(prompt).toBe(variant.coding)
    })
  })

  describe('buildToolCatalogText', () => {
    it('includes filesystem tools in code mode', () => {
      const text = PromptBuilder.buildToolCatalogText('code')
      expect(text).toContain('read_file')
      expect(text).toContain('write_file')
      expect(text).toContain('execute_command')
    })

    it('excludes shell tools in office mode', () => {
      const text = PromptBuilder.buildToolCatalogText('office')
      expect(text).not.toContain('execute_command')
      expect(text).not.toContain('filesystem')
    })

    it('includes MCP tools when provided', () => {
      const mcpTools = [
        { name: 'mcp_search', description: 'Search the web' },
        { name: 'mcp_weather', description: 'Get weather info' },
      ]
      const text = PromptBuilder.buildToolCatalogText('code', mcpTools)
      expect(text).toContain('mcp_search')
      expect(text).toContain('mcp_weather')
      expect(text).toContain('MCP')
    })

    it('truncates MCP tools list when more than 10', () => {
      const mcpTools = Array.from({ length: 15 }, (_, i) => ({
        name: `mcp_tool_${i}`,
        description: `Tool ${i}`,
      }))
      const text = PromptBuilder.buildToolCatalogText('code', mcpTools)
      expect(text).toContain('+5')
    })
  })

  describe('build', () => {
    it('produces a non-empty prompt with base content', () => {
      const prompt = PromptBuilder.build({ mode: 'code' })
      expect(prompt.length).toBeGreaterThan(100)
      expect(prompt).toContain('项目信息')
    })

    it('includes project path when provided', () => {
      const prompt = PromptBuilder.build({ mode: 'code', projectPath: '/test/path' })
      expect(prompt).toContain('/test/path')
    })

    it('includes custom instructions when provided', () => {
      const prompt = PromptBuilder.build({ mode: 'code', customInstructions: 'Always use TypeScript' })
      expect(prompt).toContain('Always use TypeScript')
      expect(prompt).toContain('自定义指令')
    })

    it('includes custom rules when provided', () => {
      const prompt = PromptBuilder.build({ mode: 'code', customRules: 'No console.log' })
      expect(prompt).toContain('No console.log')
      expect(prompt).toContain('自定义规则')
    })

    it('includes skill prompt when provided', () => {
      const prompt = PromptBuilder.build({ mode: 'code', skillPrompt: 'Skill: Code Review' })
      expect(prompt).toContain('Skill: Code Review')
      expect(prompt).toContain('技能提示')
    })

    it('includes global memory when provided', () => {
      const prompt = PromptBuilder.build({ mode: 'code', globalMemory: 'User prefers Python' })
      expect(prompt).toContain('User prefers Python')
      expect(prompt).toContain('全局记忆')
    })

    it('includes AGENTS.md content when enabled', () => {
      const prompt = PromptBuilder.build({
        mode: 'code',
        includeAgentsMd: true,
        agentsMdContent: '# AGENTS.md\nSome agent rules',
      })
      expect(prompt).toContain('AGENTS.md')
      expect(prompt).toContain('Some agent rules')
    })

    it('includes CLAUDE.md content when enabled', () => {
      const prompt = PromptBuilder.build({
        mode: 'code',
        includeClaudeMd: true,
        claudeMdContent: '# CLAUDE.md\nSome claude rules',
      })
      expect(prompt).toContain('CLAUDE.md')
      expect(prompt).toContain('Some claude rules')
    })

    it('uses office mode daily prompt variant', () => {
      const codePrompt = PromptBuilder.build({ mode: 'code' })
      const officePrompt = PromptBuilder.build({ mode: 'office' })
      expect(codePrompt).not.toBe(officePrompt)
    })

    it('uses concise variant when specified', () => {
      const defaultPrompt = PromptBuilder.build({ mode: 'code', variantName: 'default' })
      const concisePrompt = PromptBuilder.build({ mode: 'code', variantName: 'concise' })
      expect(defaultPrompt).not.toBe(concisePrompt)
      expect(concisePrompt).toContain('concise')
    })
  })
})
