# 贡献指南（CONTRIBUTING）

感谢你为 AELA 做出贡献！本文档说明本地开发、代码规范与提交流程。

## 1. 前置条件

AELA 通过 `file:` 依赖直接引用本地 **AgentPrimordia SDK**（`@agentprimordia/sdk`），因此开发前必须满足以下任一条件：

- **方式一（默认路径）**：在本仓库同级目录存在 `../codecast/AgentPrimordia/sdk/typescript`（即克隆 `AgentPrimordia` 仓库到 `E:/codecast/AgentPrimordia`）；
- **方式二（自定义路径）**：设置环境变量 `AELA_SDK_PATH` 指向**已构建**的 SDK `dist` 目录：
  ```bash
  AELA_SDK_PATH=/abs/path/to/AgentPrimordia/sdk/typescript/dist npm install
  ```

若 SDK 未就绪，`npm install` 的 `postinstall` 校验会提示，类型检查与构建也会因无法解析 `@agentprimordia/sdk` 而失败。

## 2. 本地开发

```bash
npm install          # 安装依赖（需要本地 SDK，见上文）
npm run dev          # 启动开发模式（Vite HMR + 主进程热重载）
npm run typecheck    # 类型检查（node + web 两个工程）
npm run lint         # ESLint 检查
npm test             # 单元测试（vitest run）
npm run test:coverage # 单测 + 覆盖率（门槛见 vitest.config.ts）
npm run build        # 构建当前平台
```

## 3. 代码规范

- **语言**：TypeScript（strict 模式开启），源码注释使用**简体中文**（与现有代码库一致）。
- **风格**：遵循 Google 风格（2 空格缩进、`camelCase` 命名、清晰的函数/类型注释）。
- **强类型**：所有函数签名必须有显式类型标注；变量赋予合理默认值；避免 `any`（SDK 载荷等确需 `any` 处需注明原因）。
- **可测试**：公共逻辑路径应有单测覆盖，核心服务覆盖率目标 ≥ 60%。
- **组件**：渲染层使用 React 函数组件 + Hooks；状态通过 Zustand slice 管理。

## 4. 架构约定

### 4.1 新增服务

在 `src/main/services/` 下新增服务后，必须在 `ServiceContainer` 中注册并使用 `SERVICE_TOKENS` 常量，通过 DI 容器获取依赖，避免全局单例散落。

### 4.2 新增 IPC 通道

1. 在 `src/shared/ipcChannels.ts` 定义通道常量（`IPC_CHANNELS`）。
2. 主进程 handler（`src/main/ipc/handlers/`）**必须对入参做 zod 校验**：
   - 使用 `src/main/ipc/schemas.ts` 的 `validateInput(schema, params)`；
   - 校验失败返回 `{ success: false, error }`，成功路径用 `wrap(() => service.xxx(params))` 包裹。
   - 优先复用 `genericIdSchema` / `genericStringSchema` / `genericObjectSchema` 等宽松 Schema，避免误伤历史合法调用。
3. 在 `src/preload/api/*.ts` 通过 `invoke()` 暴露，并在 `src/renderer/src/types/global.d.ts` 的 `AELAApi` 接口补齐类型。

### 4.3 上帝文件拆分（内容型）

对于纯内容/常量型大文件（如翻译字典 `src/shared/i18n/`、提示词常量 `src/main/services/promptContents/`），按业务维度拆为子模块，并由 `index.ts` **桶文件 re-export 全部既有导出**。

- **红线**：对外导出面（导出符号名、类型）必须 100% 不变，仅内部文件重组。
- 调用方无需改动（如 `@shared/i18n`、`PromptBuilder` 的 `./promptContents` 仍指向新目录的 `index.ts`）。

### 4.4 安全基线（不可降级）

以下内容属于生产安全基线，**任何改动都不得削弱**：

- `contextIsolation: true` + `nodeIntegration: false`；
- 严格的 Content-Security-Policy（CSP）；
- API Key 存储使用 `safeStorage`（OS Keyring）；当 OS Keyring 不可用时 `SecretStore` 必须 **fail-closed**（拒绝持久化明文，或在内存中临时保存并提示用户），不得静默落盘明文。

## 5. 提交与 PR

1. 开分支：`feat/xxx`、`fix/xxx`、`refactor/xxx`、`docs/xxx`。
2. 提交前确保：`npm run typecheck && npm run lint && npm test` 全部通过。
3. 提交信息使用 Conventional Commits：`feat/fix/refactor/docs/test/chore/style/perf(type): description`。
4. PR 描述说明：改动动机、影响范围、自测结果、是否触及安全基线。
5. 涉及上帝文件拆分 / 安全相关改动时，在 PR 中标注，便于重点评审。

## 6. 许可证

本项目基于 [MIT](LICENSE) 许可证开源。
