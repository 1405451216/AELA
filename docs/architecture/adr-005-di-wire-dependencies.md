# ADR-005: AgentService 依赖注入重构

| 字段 | 值 |
|------|-----|
| **状态** | 接受 (Accepted) — 已执行 |
| **日期** | 2026-07-01 |

## 上下文

`src/main/index.ts` 中 AgentService 创建后需要注入 13 个协作服务，通过 13 个独立的 `setXxx()` setter 调用。报告（v2 评估 P1）指出：**启动顺序硬编码在 index.ts**，新服务加入需修改多处。

## 决策

在 `AgentService` 新增统一的 `wireDependencies(deps)` 方法，将 13 个 setter 调用合并为 1 次调用。

## 重构前后对比

### 重构前（index.ts）
```ts
agentService.setCostTracker(costTrackerService)
agentService.setContextWindow(contextWindowService)
agentService.setHITLService(hitlService)
agentService.setAuditService(auditService)
agentService.setToolLearningService(toolLearningService)
agentService.setPromptService(promptService)
agentService.setHookConfigService(hookConfigService)
agentService.setGuardrailService(guardrailService)
agentService.setSecurityService(securityService)
agentService.setModelRouter(modelRouter)
```

### 重构后（index.ts）
```ts
agentService.wireDependencies({
  memoryService,
  costTracker: costTrackerService,
  contextWindow: contextWindowService,
  hitlService,
  auditService,
  toolLearningService,
  promptService,
  hookConfigService,
  guardrailService,
  securityService,
  modelRouter,
})
```

## 理由

1. **单一职责**：`wireDependencies` 封装了 AgentService 的依赖关系拓扑
2. **集中管理**：新服务加入只需修改 `wireDependencies` 的参数对象和接口定义
3. **向后兼容**：所有独立 setter 方法保留（供单独注入或测试使用）
4. **类型安全**：`wireDependencies` 接口类型定义确保所有必填依赖在编译时检查

## 未采用方案

- **纯构造器注入**：需要修改 AgentService 构造函数签名，影响现有测试 mock
- **容器 resolve**：ServiceContainer 是同步解析，不支持异步服务创建Launcher
