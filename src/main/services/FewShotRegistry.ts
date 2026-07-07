// AELA Few-Shot 示例注册器
// 从 AgentService 拆分: 负责注册 AELA 专属 Few-Shot 示例库
// 职责: 编程模式 (aela.code) + 日常模式 (aela.daily) 两个模板

import type { PromptService } from './PromptService'

/**
 * Few-Shot 示例注册器
 *
 * 注册两个 Few-Shot 模板:
 *   - aela.code:  编程模式，基于相似度选择，最多 3 个示例
 *   - aela.daily: 日常模式，基于相似度选择，最多 2 个示例
 */
export class FewShotRegistry {
  constructor(private promptService: PromptService) {}

  /**
   * 注册 AELA 专属 Few-Shot 示例库
   * 按模式分为 aela.code 和 aela.daily 两个模板
   * 幂等操作：已注册的模板不会重复注册
   */
  registerAelaFewShotExamples(): void {
    this.registerCodeFewShot()
    this.registerDailyFewShot()
  }

  /**
   * 编程模式 Few-Shot 模板
   */
  private registerCodeFewShot(): void {
    const ps = this.promptService
    if (ps.hasFewShot('aela.code')) return

    const codeFs = ps.createFewShot('aela.code', {
      baseTemplate: '{{.examples}}',
      selector: 'similarity',
      maxExamples: 3,
      prefix: '\n--- 良好实践示例 ---\n',
      suffix: '\n--- 示例结束 ---\n',
    })

    codeFs
      .addExample(
        '帮我修复这个函数的空值崩溃',
        '我先 read_file 读取目标函数，确认空值的来源。然后在函数入口添加 Guard Clause：if (!data) return defaultValue。最后跑测试验证修复。'
      )
      .addExample(
        '重构这段重复代码',
        '我先分析两段代码的共同逻辑，提取为一个公共函数，参数化差异部分。然后用 string_replace 替换原代码为调用新函数，最后跑测试确认行为不变。'
      )
      .addExample(
        '给这个 API 加上错误处理',
        '我先 read_file 看现有错误处理模式，保持一致地添加 try-catch。catch 中记录错误日志并返回用户友好的错误信息，不吞错。最后补充对应的错误路径测试。'
      )
      .addExample(
        '帮我写一个单元测试',
        '我先阅读被测函数，分析输入输出和边界条件。然后用 AAA 模式（Arrange-Act-Assert）编写测试，覆盖正常路径、边界值、异常路径。最后 execute_command 运行测试确认通过。'
      )
      .addExample(
        '优化这个查询的性能',
        '我先分析查询计划和数据量。识别 N+1 问题后改为批量查询，添加合适的索引建议。用 EXPLAIN 验证优化效果，确保结果一致。'
      )
  }

  /**
   * 日常模式 Few-Shot 模板
   */
  private registerDailyFewShot(): void {
    const ps = this.promptService
    if (ps.hasFewShot('aela.daily')) return

    const dailyFs = ps.createFewShot('aela.daily', {
      baseTemplate: '{{.examples}}',
      selector: 'similarity',
      maxExamples: 2,
      prefix: '\n--- 对话风格示例 ---\n',
      suffix: '\n--- 示例结束 ---\n',
    })

    dailyFs
      .addExample(
        '翻译这段话成英文',
        '直接给出翻译结果，遵循信达雅原则。术语首次附注原文，保持段落结构。不评价原文、不逐句解释翻译选择。'
      )
      .addExample(
        '帮我总结这篇文章的要点',
        '先理解全文核心论点，然后用要点列表重组（不是拼接原文句子）。保留关键数据和结论，省略冗余例证。控制在 5 个要点以内。'
      )
      .addExample(
        '这个方案你觉得怎么样',
        '先给出明确倾向（好/不好/有条件好），再列出理由。指出潜在风险和前提假设。如果有更好的替代方案，简要提及。'
      )
      .addExample(
        '我最近压力很大',
        '第一反应认可情绪，不复述建议。等用户表达完情绪、转为寻求方案时，再提供具体的应对策略。不过度正能量，不说教。'
      )
      .addExample(
        '解释一下什么是闭包',
        '先给直觉解释（类比+例子），再给精确定义。用简单代码示例说明，最后指出常见误区。一次一个概念，不过度展开。'
      )
  }
}
