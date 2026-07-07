# ADR-001: SDK 本地依赖策略

| 字段 | 值 |
|------|-----|
| **状态** | 接受 (Accepted) |
| **日期** | 2026-07-01 |
| **决策者** | AELA 工程团队 |

## 上下文

AELA 需要集成 `@agentprimordia/sdk`（AgentPrimordia TypeScript SDK）。SDK 仍在活跃迭代中，API 接口和类型定义频繁变化。需要决定如何在 AELA 中引用 SDK。

## 决策

采用 **本地 `file:` 协议依赖**，引用 SDK 的本地 TypeScript 源码路径：

```json
"@agentprimordia/sdk": "file:../codecast/AgentPrimordia/sdk/typescript"
```

优先级策略（从 `electron.vite.config.ts`）：
1. 环境变量 `AELA_SDK_PATH` — 自定义 SDK 路径
2. 默认相对路径 `../codecast/AgentPrimordia/sdk/typescript`

## 理由

**优势：**
- SDK 迭代即时生效，无需等待 npm 发布
- 类型/接口与 SDK 头对头一致，编译期捕获 breaking change
- 开发调试可直接修改 SDK 源码验证

**风险：**
- 跨机器不可移植（依赖本地路径）
- SDK breaking change 直接穿透到 AELA（无 semver 缓冲）
- CI 需在每次 `npm ci` 前保证 SDK dist 已构建（`scripts/build-sdk.mjs`）

## 缓解措施

1. **类型漂移检测**：CI 中 `npm run typecheck` 阻塞 PR，确保 SDK 变化被及时发现
2. **SDK Adapter 层**（`src/main/sdk/`）：
   - `EvalSuiteAdapter` — 隔离 EvalSuite 动态 case 添加
   - `ABTestAdapter` — 隔离 PromptABTest 接口变化
   - `BatchAdapter` — 隔离 BatchProcessor/BatchRequestProcessor 差异
3. **环境变量覆盖**：CI/CD 通过 `AELA_SDK_PATH` 指向预构建 SDK dist

## 未来演进

当 SDK 接口稳定后：
- 将 SDK 发布为 npm 包（`@agentprimordia/sdk@^1.0.0`）
- AELA 改为 semver 依赖
- Adapter 层保留（防护未来 minor 变化）
