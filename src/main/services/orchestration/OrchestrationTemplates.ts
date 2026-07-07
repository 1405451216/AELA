// Orchestration 预置模板库
// 集中存放所有内置的 OrchestrationTemplate，避免污染 OrchestrationService 主体。
// 调用方通过 OrchestrationService.listTemplates / getTemplate / registerTemplate 访问。

import type { OrchestrationTemplate } from '@shared/types'

// ===== 预置编排模板库 =====

const PRESET_TEMPLATES: OrchestrationTemplate[] = [
  {
    id: 'tpl-code-review-pipeline',
    name: '代码审查流水线',
    description: '审查代码 -> 安全分析 -> 性能优化建议，三个 Agent 串行处理',
    mode: 'pipeline',
    category: 'development',
    agents: [
      {
        name: '代码审查员',
        role: 'reviewer',
        systemPrompt: '你是一个资深代码审查员。请仔细审查用户提供的代码，找出潜在问题、代码风格问题、逻辑错误。输出结构化的审查报告。',
      },
      {
        name: '安全分析师',
        role: 'security',
        systemPrompt: '你是一个安全分析师。请基于前一个 Agent 的审查结果，进行安全漏洞分析，包括注入风险、权限问题、数据泄露风险等。',
      },
      {
        name: '性能优化师',
        role: 'performance',
        systemPrompt: '你是一个性能优化专家。请基于前面的审查结果，给出具体的性能优化建议，包括算法改进、缓存策略、异步处理等。',
      },
    ],
    inputPlaceholder: '请输入要审查的代码...',
  },
  {
    id: 'tpl-research-parallel',
    name: '并行研究',
    description: '多个 Agent 从不同角度并行研究同一主题，最后汇总',
    mode: 'parallel',
    category: 'research',
    agents: [
      {
        name: '技术视角',
        role: 'tech',
        systemPrompt: '你是一个技术研究专家。请从技术实现角度分析给定主题，包括技术选型、架构设计、实现难点等。',
      },
      {
        name: '商业视角',
        role: 'business',
        systemPrompt: '你是一个商业分析师。请从商业模式、市场定位、竞争分析角度分析给定主题。',
      },
      {
        name: '用户视角',
        role: 'user',
        systemPrompt: '你是一个用户体验专家。请从用户需求、使用场景、痛点分析角度分析给定主题。',
      },
    ],
    inputPlaceholder: '请输入要研究的主题...',
  },
  {
    id: 'tpl-writing-pipeline',
    name: '写作流水线',
    description: '大纲生成 -> 内容撰写 -> 润色校对，三步流水线',
    mode: 'pipeline',
    category: 'writing',
    agents: [
      {
        name: '大纲设计师',
        role: 'outline',
        systemPrompt: '你是一个大纲设计师。请为用户的写作需求生成详细的结构化大纲，包括章节划分、要点梳理。',
      },
      {
        name: '内容撰写者',
        role: 'writer',
        systemPrompt: '你是一个专业撰稿人。请基于给定的大纲，撰写完整的内容。保持专业、流畅的行文风格。',
      },
      {
        name: '编辑校对',
        role: 'editor',
        systemPrompt: '你是一个资深编辑。请对前面的稿件进行润色校对，改善语言表达，修正逻辑问题，提升整体质量。',
      },
    ],
    inputPlaceholder: '请描述你的写作需求...',
  },
  {
    id: 'tpl-debate-handoff',
    name: '辩论交接',
    description: '正方和反方交替辩论，深入探讨争议话题',
    mode: 'handoff',
    category: 'research',
    agents: [
      {
        name: '正方辩手',
        role: 'pro',
        systemPrompt: '你是正方辩手。请从支持的角度论证给定话题，提供有力的论据和例证。',
      },
      {
        name: '反方辩手',
        role: 'con',
        systemPrompt: '你是反方辩手。请从反对的角度论证给定话题，指出潜在的风险和问题。',
      },
    ],
    inputPlaceholder: '请输入辩论话题...',
    maxRounds: 3,
  },
  {
    id: 'tpl-code-gen-pool',
    name: '多模型代码生成',
    description: '使用多个模型并行生成代码方案，择优采用',
    mode: 'pool',
    category: 'development',
    agents: [
      {
        name: '方案A-简洁风格',
        role: 'concise',
        systemPrompt: '你是一个追求简洁的程序员。请用最精简的代码实现需求，注重可读性和最小实现。',
      },
      {
        name: '方案B-企业级',
        role: 'enterprise',
        systemPrompt: '你是一个企业级开发专家。请生成健壮的、包含完整错误处理、日志、类型定义的代码。',
      },
      {
        name: '方案C-性能优先',
        role: 'performance',
        systemPrompt: '你是一个性能优化专家。请生成最高性能的实现，考虑时间复杂度、空间复杂度、缓存友好性。',
      },
    ],
    inputPlaceholder: '请描述代码需求...',
    maxConcurrent: 3,
  },
  {
    id: 'tpl-translation-review',
    name: '翻译审校流水线',
    description: '初译 -> 审校 -> 终稿，专业翻译流程',
    mode: 'pipeline',
    category: 'writing',
    agents: [
      {
        name: '初译',
        role: 'translator',
        systemPrompt: '你是一个专业翻译。请将用户提供的文本翻译为目标语言，保持准确性。',
      },
      {
        name: '审校',
        role: 'reviewer',
        systemPrompt: '你是一个翻译审校专家。请检查翻译的准确性、流畅性、术语一致性，并给出修改建议。',
      },
      {
        name: '终稿',
        role: 'finalizer',
        systemPrompt: '你是一个终稿编辑。请基于审校意见输出最终翻译版本，确保质量。',
      },
    ],
    inputPlaceholder: '请输入要翻译的文本和目标语言...',
  },
  // ===== [增强] StreamingPipeline 模板 =====
  {
    id: 'tpl-streaming-translation',
    name: '流式翻译管道',
    description: '使用 StreamingPipeline 实现 token 级流式传递，逐 token 翻译→审校→终稿，降低端到端延迟',
    mode: 'streaming_pipeline',
    category: 'writing',
    agents: [
      {
        name: '流式翻译',
        role: 'translator',
        systemPrompt: '你是一个专业翻译。请将用户提供的文本翻译为目标语言，保持准确性和流畅性。',
      },
      {
        name: '流式审校',
        role: 'reviewer',
        systemPrompt: '你是一个翻译审校专家。请检查翻译的准确性、流畅性、术语一致性，输出修正后的版本。',
      },
      {
        name: '流式终稿',
        role: 'finalizer',
        systemPrompt: '你是一个终稿编辑。请基于审校结果输出最终翻译版本，确保最高质量。',
      },
    ],
    inputPlaceholder: '请输入要翻译的文本和目标语言...',
  },
  // ===== [SDK 集成] 高级编排模式模板 =====
  {
    id: 'tpl-groupchat-brainstorm',
    name: '群聊头脑风暴',
    description: '多个 Agent 以群聊形式讨论主题，主持人引导方向并总结',
    mode: 'groupchat',
    category: 'research',
    agents: [
      {
        name: '创意总监',
        role: 'moderator',
        systemPrompt: '你是群聊主持人。请引导讨论方向，总结各方观点，确保讨论有成效。',
      },
      {
        name: '技术专家',
        role: 'tech',
        systemPrompt: '你是技术专家。请从技术可行性角度发表观点。',
      },
      {
        name: '产品经理',
        role: 'product',
        systemPrompt: '你是产品经理。请从用户需求和商业价值角度发表观点。',
      },
      {
        name: '设计师',
        role: 'design',
        systemPrompt: '你是设计师。请从用户体验和设计美学角度发表观点。',
      },
    ],
    inputPlaceholder: '请输入讨论主题...',
    maxRounds: 3,
  },
  {
    id: 'tpl-debate-pro-con',
    name: '辩论对决',
    description: '正方与反方多轮辩论，裁判给出最终裁决',
    mode: 'debate',
    category: 'research',
    agents: [
      {
        name: '正方',
        role: 'proponent',
        systemPrompt: '你是正方辩手。请从支持的角度论证话题，提供有力的论据和例证。',
      },
      {
        name: '反方',
        role: 'opponent',
        systemPrompt: '你是反方辩手。请从反对的角度论证话题，指出潜在的风险和问题。',
      },
      {
        name: '裁判',
        role: 'judge',
        systemPrompt: '你是裁判。请公正评估双方论点，给出裁决和理由。',
      },
    ],
    inputPlaceholder: '请输入辩论话题...',
    maxRounds: 3,
  },
  {
    id: 'tpl-supervisor-task',
    name: '监督者任务分配',
    description: '监督者 Agent 动态分配子任务给专业工作者，迭代完成复杂任务',
    mode: 'supervisor',
    category: 'development',
    agents: [
      {
        name: '监督者',
        role: 'supervisor',
        systemPrompt: '你是任务监督者。请分析任务，决定由哪个工作者处理下一个子任务，或宣布任务完成。',
      },
      {
        name: '研究员',
        role: 'researcher',
        systemPrompt: '你是研究员。负责信息收集、资料分析、文献综述。',
      },
      {
        name: '编码者',
        role: 'coder',
        systemPrompt: '你是编码者。负责代码编写、调试、重构。',
      },
      {
        name: '测试员',
        role: 'tester',
        systemPrompt: '你是测试员。负责编写和运行测试，验证代码质量。',
      },
    ],
    inputPlaceholder: '请输入要完成的复杂任务...',
    maxRounds: 10,
  },
]

/**
 * OrchestrationTemplates 仓储
 *
 * 封装内存中的模板存储 + 预置模板注册。
 * 设计为独立类，便于单测与未来持久化。
 */
export class OrchestrationTemplates {
  private templates: Map<string, OrchestrationTemplate> = new Map()

  constructor(presets: ReadonlyArray<OrchestrationTemplate> = PRESET_TEMPLATES) {
    for (const tpl of presets) {
      this.templates.set(tpl.id, tpl)
    }
  }

  list(): OrchestrationTemplate[] {
    return Array.from(this.templates.values())
  }

  get(id: string): OrchestrationTemplate | undefined {
    return this.templates.get(id)
  }

  register(template: OrchestrationTemplate): void {
    this.templates.set(template.id, template)
  }
}
