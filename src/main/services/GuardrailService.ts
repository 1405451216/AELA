// 安全护栏服务
// [重构] 使用 SDK 原生 RuleEngine / PromptInjectionRule / OutputSafetyRule / TopicConstraintRule / PIIDetector / Trie / Sanitizer
// 保持 AELA 公共 API 不变，内部委托给 SDK 实现
// SDK 优势: Trie O(k) 匹配、leet-speak 归一化、Go 端规则对齐、更多 PII 模式

import {
  RuleEngine,
  PromptInjectionRule,
  TopicConstraintRule,
  PIIDetector,
  Trie,
  type GuardrailRule as SDKGuardrailRule,
  type CheckPoint as SDKCheckPoint,
  type GuardrailRuleResult as SDKGuardrailRuleResult,
} from '@agentprimordia/sdk'
import type {
  GuardrailReport,
  GuardrailResult,
  GuardrailRuleConfig,
  GuardrailCheckPoint,
  GuardrailAction,
} from '@shared/types'

// ===== AELA checkPoint → SDK CheckPoint 映射 =====

function toSDKCheckPoint(point: GuardrailCheckPoint): SDKCheckPoint {
  // 'both' 默认走 input 检查；check() 方法会分别调用 input + output
  return point === 'output' ? 'output' : 'input'
}

// ===== Prompt 注入检测规则适配器 — 统一规则名 + 扩展模式 =====

class PromptInjectionRuleAdapter implements SDKGuardrailRule {
  private inner: PromptInjectionRule
  // AELA 额外模式（SDK 原生模式不覆盖的情况）
  private extraPatterns: RegExp[] = [
    /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
    /disregard\s+(?:all\s+)?(?:prior|previous)\s+instructions/i,
    /\[SYSTEM\]/i,
  ]

  constructor() {
    // 使用 flag 动作（非 reject），severity 为 high
    this.inner = new PromptInjectionRule({ action: 'flag', severity: 'high' } as never)
  }

  name(): string { return 'prompt-injection' }

  check(input: string, point: SDKCheckPoint): SDKGuardrailRuleResult {
    const result = this.inner.check(input, point)
    // 如果 SDK 原生模式已匹配，直接返回（覆盖 action 为 flag）
    if (result.action !== 'pass') {
      return { ...result, ruleName: this.name(), action: 'flag' }
    }
    // 检查 AELA 额外模式
    for (const p of this.extraPatterns) {
      p.lastIndex = 0
      if (p.test(input)) {
        return {
          ruleName: this.name(),
          action: 'flag',
          severity: 'high',
          message: 'potential prompt injection detected',
        }
      }
    }
    return { ruleName: this.name(), action: 'pass', severity: 'low', message: '' }
  }
}

// ===== 话题约束规则适配器 — 统一规则名 =====

class TopicConstraintRuleAdapter implements SDKGuardrailRule {
  private inner: TopicConstraintRule

  constructor(config: { mode: string; topics: string[] }) {
    this.inner = new TopicConstraintRule(config as never)
  }

  name(): string { return 'topic-filter' }

  check(input: string, point: SDKCheckPoint): SDKGuardrailRuleResult {
    const result = this.inner.check(input, point)
    // 覆盖 ruleName 和 severity（AELA 期望 topic 触发为 high severity）
    if (result.action !== 'pass') {
      return { ...result, ruleName: this.name(), severity: 'high' }
    }
    return { ...result, ruleName: this.name() }
  }
}

// ===== PII 脱敏规则 — 使用 SDK PIIDetector + 自定义中国 PII 模式 =====

class PIIRuleAdapter implements SDKGuardrailRule {
  private detector: PIIDetector

  constructor() {
    this.detector = new PIIDetector({
      patterns: ['email', 'phone', 'ssn', 'credit_card', 'ip_address', 'passport', 'id_card'],
      customPatterns: [
        // 中国手机号
        { name: 'cn_phone', regex: '\\b1[3-9]\\d{9}\\b', replacement: '[PHONE]' },
        // 中国身份证号
        { name: 'cn_id_card', regex: '\\b\\d{6}(?:19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]\\b', replacement: '[ID]' },
      ],
      redact: true,
    })
  }

  name(): string { return 'pii-detector' }

  check(input: string, _point: SDKCheckPoint): SDKGuardrailRuleResult {
    const result = this.detector.detect(input)

    if (!result.found) {
      return { ruleName: this.name(), action: 'pass', severity: 'low', message: '' }
    }

    const labels = result.types.map(t => `${t.type}(${t.count})`).join(', ')
    return {
      ruleName: this.name(),
      action: 'sanitize',
      severity: 'medium',
      message: `检测到 PII: ${labels}`,
      sanitized: result.redactedText ?? input,
      metadata: { types: result.types },
    }
  }
}

// ===== 敏感词过滤规则 — 使用 SDK Trie 实现 O(k) 匹配 =====

class KeywordRuleAdapter implements SDKGuardrailRule {
  private trie: Trie
  private replacement: string

  constructor(keywords: string[] = [], replacement = '[REDACTED]') {
    this.trie = new Trie()
    this.trie.insertBatch(keywords)
    this.replacement = replacement
  }

  name(): string { return 'keyword-filter' }

  check(input: string, _point: SDKCheckPoint): SDKGuardrailRuleResult {
    const matches = this.trie.match(input)

    if (matches.length === 0) {
      return { ruleName: this.name(), action: 'pass', severity: 'low', message: '' }
    }

    let sanitized = input
    for (const kw of matches) {
      const regex = new RegExp(kw, 'gi')
      sanitized = sanitized.replace(regex, this.replacement)
    }

    return {
      ruleName: this.name(),
      action: 'sanitize',
      severity: 'medium',
      message: `敏感词过滤: ${matches.join(', ')}`,
      sanitized,
      metadata: { matches },
    }
  }
}

// ===== 护栏服务（保持公共 API 不变）=====

export class GuardrailService {
  private engine: RuleEngine
  private ruleConfigs: Map<string, GuardrailRuleConfig> = new Map()
  private enabled = true

  constructor() {
    this.engine = new RuleEngine()

    // 默认启用注入检测和 PII
    this.addDefaultRule('injection', 'Prompt 注入检测', 'injection', 'input', new PromptInjectionRuleAdapter())
    this.addDefaultRule('pii', 'PII 脱敏', 'pii', 'both', new PIIRuleAdapter())
  }

  /**
   * 添加默认规则
   */
  private addDefaultRule(
    id: string,
    name: string,
    type: GuardrailRuleConfig['type'],
    checkPoint: GuardrailCheckPoint,
    rule: SDKGuardrailRule,
  ): void {
    this.engine.addRule(rule)
    this.ruleConfigs.set(id, { id, name, type, enabled: true, checkPoint, config: {} })
  }

  /**
   * 获取所有规则配置
   */
  getRules(): GuardrailRuleConfig[] {
    return Array.from(this.ruleConfigs.values())
  }

  /**
   * 更新规则配置 — 重建 SDK RuleEngine
   */
  setRules(configs: GuardrailRuleConfig[]): void {
    this.ruleConfigs.clear()
    this.engine = new RuleEngine()

    for (const cfg of configs) {
      if (!cfg.enabled) {
        this.ruleConfigs.set(cfg.id, cfg)
        continue
      }

      let rule: SDKGuardrailRule | null = null
      switch (cfg.type) {
        case 'injection':
          // SDK PromptInjectionRule: 更全面的模式 + leet-speak 归一化 + 中文关键词
          rule = new PromptInjectionRuleAdapter()
          break
        case 'pii':
          rule = new PIIRuleAdapter()
          break
        case 'topic': {
          const topics = (cfg.config.topics as string[]) || []
          rule = new TopicConstraintRuleAdapter({ mode: 'denylist', topics })
          break
        }
        case 'keyword': {
          const keywords = (cfg.config.keywords as string[]) || []
          const replacement = (cfg.config.replacement as string) || '[REDACTED]'
          rule = new KeywordRuleAdapter(keywords, replacement)
          break
        }
      }

      if (rule) {
        this.engine.addRule(rule)
        this.ruleConfigs.set(cfg.id, cfg)
      } else {
        this.ruleConfigs.set(cfg.id, cfg)
      }
    }
  }

  /**
   * 检查输入/输出 — 委托给 SDK RuleEngine
   * AELA 的 checkPoint ('input' | 'output' | 'both') 映射到 SDK 的 CheckPoint ('input' | 'output')
   */
  check(input: string, point: GuardrailCheckPoint): GuardrailReport {
    if (!this.enabled) {
      return { passed: true, results: [], action: 'pass' }
    }

    // 对 'both'，分别检查 input 和 output，合并结果
    const checkpoints: SDKCheckPoint[] = point === 'both' ? ['input', 'output'] : [toSDKCheckPoint(point)]

    const allResults: GuardrailResult[] = []
    let worstAction: GuardrailAction = 'pass'
    let sanitized = input

    for (const cp of checkpoints) {
      const sdkReport = this.engine.check(input, cp)
      for (const r of sdkReport.results) {
        // 只保留该 checkPoint 对应的规则结果
        // 规则 checkPoint 为 'both' 时在 input 和 output 都生效
        const cfg = this.findConfigByRuleName(r.ruleName)
        if (cfg && cfg.checkPoint !== 'both' && cfg.checkPoint !== cp) {
          continue
        }
        if (r.action !== 'pass') {
          allResults.push({
            ruleName: r.ruleName,
            action: r.action,
            severity: r.severity,
            message: r.message,
            sanitized: r.sanitized,
          })
          if (r.sanitized) {
            sanitized = r.sanitized
          }
          if (actionPriority(r.action) > actionPriority(worstAction)) {
            worstAction = r.action
          }
        }
      }
    }

    // 如果有 sanitize 结果, 添加一个汇总
    if (sanitized !== input && worstAction === 'sanitize') {
      allResults.push({
        ruleName: 'sanitized-output',
        action: 'sanitize',
        severity: 'low',
        message: '内容已脱敏',
        sanitized,
      })
    }

    return {
      passed: worstAction !== 'reject',
      results: allResults,
      action: worstAction,
    }
  }

  /**
   * 根据规则名查找配置
   */
  private findConfigByRuleName(ruleName: string): GuardrailRuleConfig | undefined {
    const typeMap: Record<string, GuardrailRuleConfig['type']> = {
      'prompt-injection': 'injection',
      'prompt_injection': 'injection',
      'pii-detector': 'pii',
      'pii': 'pii',
      'keyword-filter': 'keyword',
      'keyword': 'keyword',
      'topic-filter': 'topic',
      'topic_constraint': 'topic',
    }
    const type = typeMap[ruleName]
    if (!type) return undefined
    return Array.from(this.ruleConfigs.values()).find(c => c.type === type)
  }

  /**
   * 启用/禁用
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  isEnabled(): boolean {
    return this.enabled
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}

function actionPriority(action: GuardrailAction): number {
  const priorities: Record<GuardrailAction, number> = {
    pass: 0,
    flag: 1,
    sanitize: 2,
    reject: 3,
  }
  return priorities[action] || 0
}
