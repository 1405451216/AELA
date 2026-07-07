// 内置工具：find_skill
// 让 Agent 在对话中自主搜索并激活相关 Skill

import type { Tool } from '@agentprimordia/sdk'
import type { SkillRouter } from '../../SkillRouter'

export class FindSkillTool implements Tool {
  name = 'find_skill'
  description = '根据当前任务搜索可用的 Skill 技能。当用户请求需要特定能力（如代码审查、测试生成、文档编写等）时调用此工具，返回匹配的技能列表。'
  parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: '要搜索的技能描述或关键词，如"代码审查"、"生成测试"、"API文档"等',
      },
    },
    required: ['query'],
  }

  private skillRouter: SkillRouter | null = null

  /**
   * 注入 SkillRouter（由 ToolManager 在注册时设置）
   */
  setSkillRouter(router: SkillRouter): void {
    this.skillRouter = router
  }

  async execute(args: { query: string }): Promise<string> {
    const router = this.skillRouter
    if (!router) {
      return '技能路由服务未初始化'
    }

    const matches = router.findRelevantSkills(args.query, 5)

    if (matches.length === 0) {
      return `没有找到与"${args.query}"相关的技能。可用的技能类别包括：代码审查、测试生成、文档编写、API设计等。`
    }

    const lines = [
      `找到 ${matches.length} 个与"${args.query}"相关的技能：`,
      '',
    ]

    for (const match of matches) {
      const icon = match.score >= 0.75 ? '⭐' : '💡'
      const badge = match.matchType === 'keyword' ? '[关键词匹配]' : '[语义匹配]'
      lines.push(`${icon} **${match.skill.name}** (相似度: ${Math.round(match.score * 100)}% ${badge})`)
      lines.push(`   ${match.skill.description}`)
      if (match.skill.asTool) {
        lines.push(`   类型: 可调用工具 (toolName: ${match.skill.toolName || match.skill.name})`)
      }
      lines.push('')
    }

    lines.push('提示: 高相似度技能(⭐)会在本次对话中自动激活。')

    return lines.join('\n')
  }
}

/**
 * 获取已注册的 FindSkillTool 实例（用于注入 SkillRouter）
 */
let findSkillInstance: FindSkillTool | null = null

export function createFindSkillTool(): FindSkillTool {
  findSkillInstance = new FindSkillTool()
  return findSkillInstance
}

export function getFindSkillTool(): FindSkillTool | null {
  return findSkillInstance
}
