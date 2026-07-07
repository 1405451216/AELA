// TaskRouter — 任务类型检测 + 工具组预激活
// 根据用户输入识别任务类型，推荐对应的工具组
//
// 检测策略（双通道）：
// 1. 关键词通道：用户输入匹配预定义模式 → 精确命中
// 2. 语义通道：基于工具描述语义相似度 → 模糊匹配

export type TaskType =
  | 'code_review'
  | 'testing'
  | 'documentation'
  | 'refactoring'
  | 'debugging'
  | 'git'
  | 'research'
  | 'general'

export interface TaskRoute {
  taskType: TaskType
  confidence: number
  recommendedTools: string[]
  reason: string
}

// 任务类型 → 关键词模式映射
const TASK_PATTERNS: Array<{ type: TaskType; patterns: string[]; tools: string[] }> = [
  {
    type: 'code_review',
    patterns: [
      'review', '审查', '检查代码', '代码审查', 'review code', '检查一下代码',
      '看看代码有什么问题', '代码质量', 'codereview', 'pr review',
      '帮我 review', '审查一下', '代码有没有问题',
    ],
    tools: ['review_code', 'read_file', 'search_code'],
  },
  {
    type: 'testing',
    patterns: [
      'test', '测试', '写测试', '生成测试', '单元测试', '集成测试',
      'testing', '写个测试', 'test case', '测试用例', 'generate test',
      'add test', '增加测试', '测试覆盖',
    ],
    tools: ['generate_test', 'read_file', 'execute_command'],
  },
  {
    type: 'documentation',
    patterns: [
      'doc', '文档', '写文档', '生成文档', 'documentation', 'readme',
      'api 文档', 'api doc', '注释', '注释文档', '生成 wiki',
      '项目文档', '说明文档', '使用文档',
    ],
    tools: ['generate_wiki', 'read_file', 'get_project_structure'],
  },
  {
    type: 'refactoring',
    patterns: [
      'refactor', '重构', '优化代码', '改进代码', '代码优化',
      '重写', 'rewrite', 'clean code', '清理代码', '改善结构',
      '优化结构', '提取函数', '拆分', '解耦',
    ],
    tools: ['read_file', 'search_code', 'write_file'],
  },
  {
    type: 'debugging',
    patterns: [
      'debug', '调试', '排查', 'bug', '修复', 'fix', '报错',
      '出错了', '有问题', '不工作', 'not working', '崩溃', 'crash',
      '异常', 'exception', '错误', 'error', '失败', 'failed',
    ],
    tools: ['execute_command', 'read_file', 'search_code'],
  },
  {
    type: 'git',
    patterns: [
      'git', 'commit', 'push', 'pull', '分支', 'branch', '合并', 'merge',
      '提交代码', '推送代码', '拉取代码', '创建分支', '切换分支',
      '版本控制', 'clone', 'checkout', 'rebase', 'stash',
    ],
    tools: ['execute_command'],
  },
  {
    type: 'research',
    patterns: [
      'search', '搜索', '查找', '查一下', '帮我查', 'search for',
      'look up', '查询', '调研', '研究', '了解一下', 'find',
      'google', '百度', '搜索一下', '帮我搜',
    ],
    tools: ['http_fetch', 'search_code'],
  },
]

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  code_review: '代码审查',
  testing: '测试生成',
  documentation: '文档生成',
  refactoring: '代码重构',
  debugging: '调试排错',
  git: 'Git 操作',
  research: '搜索调研',
  general: '通用任务',
}

export class TaskRouter {
  /**
   * 检测用户输入的任务类型
   */
  detectTask(input: string): TaskRoute {
    const lowerInput = input.toLowerCase()

    // 1. 关键词精确匹配（优先级最高）
    for (const { type, patterns, tools } of TASK_PATTERNS) {
      for (const pattern of patterns) {
        if (lowerInput.includes(pattern.toLowerCase())) {
          return {
            taskType: type,
            confidence: 0.95,
            recommendedTools: tools,
            reason: `关键词匹配: "${pattern}"`,
          }
        }
      }
    }

    // 2. 模糊匹配（部分关键词命中）
    let bestMatch: { type: TaskType; tools: string[]; score: number } | null = null

    for (const { type, patterns, tools } of TASK_PATTERNS) {
      let matchCount = 0
      for (const pattern of patterns) {
        // 取模式的最后 2-4 个字符做模糊匹配
        const shortPattern = pattern.slice(-Math.min(4, pattern.length))
        if (lowerInput.includes(shortPattern)) {
          matchCount++
        }
      }
      if (matchCount > 0) {
        const score = Math.min(0.7, matchCount * 0.2)
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { type, tools, score }
        }
      }
    }

    if (bestMatch) {
      return {
        taskType: bestMatch.type,
        confidence: bestMatch.score,
        recommendedTools: bestMatch.tools,
        reason: '模糊匹配',
      }
    }

    // 3. 无匹配 → 通用任务
    return {
      taskType: 'general',
      confidence: 0.5,
      recommendedTools: ['read_file', 'list_directory'],
      reason: '未识别特定任务类型，使用通用工具',
    }
  }

  /**
   * 获取任务类型的中文标签
   */
  getLabel(taskType: TaskType): string {
    return TASK_TYPE_LABELS[taskType] || '未知任务'
  }

  /**
   * 获取所有支持的任务类型
   */
  getSupportedTaskTypes(): TaskType[] {
    return TASK_PATTERNS.map(t => t.type)
  }
}
