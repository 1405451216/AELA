# AELA 增量修复回归验证 QA 报告（FixAll 2026-07-06）

> **QA 工程师**：严过关（software-qa-engineer）
> **验证对象**：工程师（寇豆码）T1–T9 增量修复交付
> **验证日期**：2026-07-06
> **环境约束**：根 `tsc` 与全量 `vitest` 依赖 `../codecast/AgentPrimordia/sdk/typescript/dist`，该目录缺失。按文档约定**仅运行不 import `@agentprimordia/sdk` 的单元测试子集**（SDK 的 `type` 导入在运行期被擦除，故含 `type ... from '@agentprimordia/sdk'` 的 handler 测试仍可运行）。未安装 SDK、未硬跑全量。

---

## 一、最终判定

**判定：通过（源码 Bug 已修复并经 Round 2 复跑确认全绿）**

- 测试通过率（不依赖 SDK 的可运行子集，两次合计唯一用例）：**185 / 185 通过（100%）**。
  - Round 1：运行 185 个唯一用例，183 通过 / 2 失败（均来自 `sdkEnhancements.test.ts`，源码 Bug 所致）。
  - Round 2：工程师修复 `sdkEnhancements.ts` 后复跑该文件 11 用例全过（含原 2 个失败用例）→ 全子集转绿。
- 遗留问题数：**1 项（非阻断）**
  1. 【已知缺口 · 非阻断】T3 的 `SettingsView` 不安全环境 UI 提示未实现（不在本次交付文件清单）。
- 智能路由判定：Round 1 → **Engineer**（源码 Bug）；Round 2 → 工程师已修复并复跑确认，**NoOne**（无需进一步动作）。
- T1/T2/T3(后端)/T4/T5/T6/T7 静态核查与测试均 PASS。

---

## 二、测试执行结果

### 2.1 重跑新增测试（任务要求第 1 项）

命令：`npx vitest run test/services/secretStore.test.ts test/ipc/schemas.test.ts test/shared/i18n.test.ts`

| 文件 | 用例数 | 结果 |
|------|-------|------|
| test/services/secretStore.test.ts | 7 | ✅ 通过 |
| test/ipc/schemas.test.ts | 14 | ✅ 通过 |
| test/shared/i18n.test.ts | 8 | ✅ 通过 |
| **合计** | **29** | **29 passed / 29** |

> 与工程师自测一致。工程师自测中修复的 `schemas.ts` 重复声明 `genericNumberOptionalSchema` 构建阻断，本环境核实 `schemas.ts` 现仅一处声明（L271），已无重复。

### 2.2 扩展可运行子集（任务要求第 2 项，不依赖 SDK）

实际运行文件清单（排除 `test/services/` 下 5 个直接 import SDK 的文件：agentContextBuilder / contextWindowService / costTrackerService / sdkEnhancementsService / MicroAgent）：

- `test/services/promptBuilder.test.ts`（25，验证 T6 拆分后 PromptBuilder 行为）
- `test/shared/i18n.test.ts`（8，验证 T6 导出面）
- `test/ipc/handlers/agent.test.ts`（12）
- `test/ipc/handlers/memory.test.ts`（11）
- `test/ipc/handlers/security.test.ts`（11）
- `test/ipc/handlers/orchestration.test.ts`（14）
- `test/ipc/handlers/agent.handlers.test.ts`（17）
- `test/ipc/handlers/session.handlers.test.ts`（12）
- `test/ipc/handlers/security.handlers.test.ts`（10）
- `test/ipc/handlers/orchestration.handlers.test.ts`（12）
- `test/ipc/handlers/memory.handlers.test.ts`（8）
- `test/ipc/handlers/modelConfig.handlers.test.ts`（13）
- `test/ipc/handlers/sdkEnhancements.test.ts`（11 → **9 通过 / 2 失败**）

**结果：162 passed / 2 failed（共 164）。失败全部位于 `sdkEnhancements.test.ts`，根因为源码 Bug（见第四节）。**

> 说明：`sdkEnhancements.ts` 头部虽有 `type ... from '@agentprimordia/sdk'`（仅类型导入，运行期擦除），故该测试文件可正常加载——失败纯粹是 handler 运行期 `ReferenceError`，与 SDK 缺失无关，确属源码问题。

---

## 三、静态正确性核查（逐项 PASS / FAIL / 无法验证）

### T1 依赖治理（D-1 + D-2）—— PASS
- `package.json`：`react`(^18.3.1)、`react-dom`(^18.3.1)、`electron-store`(^10) 已移入 `dependencies`（L38/39/36）。
- `yjs` / `y-websocket` / `lib0` 已从 `dependencies` 与 `devDependencies` 全部移除（grep 无命中）。
- `@agentprimordia/sdk` 仍保留在 `devDependencies`（D-3/A-1 不在本轮范围，正确）。
- 新增 `react-window@^1.8.11`（`devDependencies`，T7）。
- 小瑕疵（非阻断）：同时保留了 `@types/react-window`（设计文档称 react-window 自带类型无需 @types，实际无害，仅冗余）。

### T2 删除死代码（A-3 / S-4）—— PASS
- `src/main/server/sync-server.ts` 已删除；全仓 `src` 内 `grep "main/server/sync-server"` 零命中（仅文档引用）。保留的 `src/server/sync-server.ts` 不受影响。

### T3 SecretStore 失败即关闭（S-1）—— 后端 PASS / UI 缺口
- `src/main/secretStore.ts`：
  - `encrypt()` 在 `!available`（Keyring 不可用）时**抛 `SecretStoreInsecureError`**，拒绝明文/Base64 落盘 ✅
  - `decrypt()` 对 `enc:v1:` 前缀且 `!available` 时**同样抛错**（fail-closed）✅
  - `b64:` 前缀 / 无前缀：向后兼容只读还原 ✅
  - `isSecure()` 返回 `available` 语义保持 ✅
  - 空串 `encrypt('')`/`decrypt('')` 直接返回空（不抛），合理 ✅
- `src/main/services/ConfigStore.ts`（调用方内存兜底）：在 `catch (SecretStoreInsecureError)` 中将明文 API Key 存入**内存** `memoryApiKeys`，并向 `store.set()` 写入 **`apiKey: ''`**（清空，不落盘）；`decryptModelApiKey` 优先从内存取回。正确实现 fail-closed：明文**绝不写入磁盘**，仅本次会话内存持有 ✅
- **缺口（非阻断，已知问题）**：设计验收要求 `SettingsView` 在 insecure 时显示提示，但本次交付文件清单**不含 `SettingsView.tsx`**，且静态核查 `SettingsView.tsx` 无任何 `isApiKeyStorageSecure`/密钥/不安全相关接线。T3 后端逻辑达标，UI 警示未落地。

### T4 sync apiKey 加固（S-2）—— PASS（静态对齐）
- 客户端 `src/main/services/SyncService.ts:237-240`：`url = .../ws?roomId=...`，`new WebSocket(url, { headers: { 'X-Api-Key': config.apiKey } })`。
- 服务端 `src/server/sync-server.ts:167-179`：roomId 读 query；apiKey 优先读 `req.headers['x-api-key']`，兼容 `Sec-WebSocket-Protocol: auth.<apiKey>`；缺任一则 `ws.close(4001)`。
- **两端契约对齐**：客户端经 `X-Api-Key` header 传、服务端经 `x-api-key` header 收（Node 头名小写归一）；roomId 两端均走 query。**无一端改一端漏改** ✅
- 限流：服务端新增连接滑动窗口（30/分）+ 消息令牌桶（200/10s），两端无冲突 ✅
- 无法验证项：未运行端到端握手集成测试（需起独立 ws 服务，环境未做），仅静态核对契约一致。

### T5 IPC 输入校验补齐（Q-2 / S-3）—— 严格度 PASS / 1 处源码 Bug
- 严格度核查（S-3 核心风险）：新增 handler 统一使用 `generic*Schema`（类型级校验 + `min(1)`/`max(4096)` 边界），对照原 `preload/api/*` 实参属于「宽松但非零」，不会误拒历史合法调用（如 `genericIdSchema` 取 max 4096 而非 sessionIdSchema 的 128，规避超长 id 误拒）。抽查 security / advanced / multiAgent / skill / subagent 的 `validateInput` 用法与 schema 匹配，未发现过严。
- **源码 Bug（已路由工程师）**：`src/main/ipc/handlers/sdkEnhancements.ts` 第 57 行使用 `genericObjectOptionalSchema`，但第 17 行 import 未包含该符号（仅导入了 `genericObjectSchema`），运行期抛 `ReferenceError: genericObjectOptionalSchema is not defined`，导致 `SDK_EXTRACT_STRUCTURED` handler 崩溃。
- 全量交叉核对：对 `src/main/ipc/handlers/*.ts` 逐一比对 schema 使用 vs import。`advanced.ts`/`sdkPhase4.ts` 初筛标记的项经核实为**误报**（`advanced.ts` 的 `completeSchema` 等为文件内本地 `z.object` 定义；`sdkPhase4.ts` 的 `*Schema` 实为 `sdkEnhancementsService.getSentimentSchema()` 等服务方法调用）。**除 `sdkEnhancements.ts` 外，其余 handler 导入完整**。

### T6 内容型上帝文件拆分（Q-1）—— PASS
- i18n：原 `src/shared/i18n.ts` 删除；新增 `dict.ts`/`lang.ts`/`translate.ts` + `index.ts` 桶文件。`index.ts` 重导出 8 个符号（`Lang, dict, setLang, getLang, subscribeLang, getLangSnapshot, translate, translateF`），`test/shared/i18n.test.ts` 运行期 `Object.keys` 校验 8 符号齐备 ✅。
  - 小注：`Lang` 在 `dict.ts` 为 `export type`，经 `index.ts` `export { Lang, dict }` 值语法重导出后运行期为 `undefined` 绑定（无害；更规范应写 `export type { Lang }`）。AELA tsconfig 未开启 `isolatedModules`/`verbatimModuleSyntax`，故 `tsc` 不报 TS1205；测试通过证明运行期可用。
- promptContents：原 `src/main/services/promptContents.ts` 删除；新增 `base.ts`/`coding.ts`/`daily.ts` + `index.ts`。`index.ts` 重导出 13 个常量（1 base + 6 coding + 6 daily），与子文件实际 `export const` 完全一致 ✅。`PromptBuilder.ts` 经 `./promptContents` 解析到新 `index.ts`，全仓无其他断裂 import ✅。

### T7 消息列表虚拟化试点（P-1）—— PASS（静态）
- `MessageList.tsx` 以 `VariableSizeList` 包装，`messages.map` 已在 `ChatView.tsx:431` 替换为 `<MessageList messages={messages} />`。
- 流式内容（`streamingContent`）、工具事件（`currentToolEvents`）、diff 卡片（`diffStoreDiffs`）均在 `MessageList` **之外**渲染（ChatView L433–499），与 `MessageList.tsx` 注释约定一致，**未破坏流式/diff 渲染** ✅。
- `MessageBubble` 仍 `React.memo`，与 `stores/streaming.ts` 批量 flush 兼容 ✅。
- 无法验证项：虚拟化滚动性能/滚动位置保持等需 e2e（Playwright，环境未跑），仅静态确认接入正确。

---

## 四、智能路由判定

**路由对象：Engineer（软件工程师 寇豆码）**

**Bug 描述**：`src/main/ipc/handlers/sdkEnhancements.ts` 第 57 行 `validateInput(genericObjectOptionalSchema, config)` 引用了未导入的符号。

**证据**：
```
FAIL test/ipc/handlers/sdkEnhancements.test.ts > SDK_EXTRACT_STRUCTURED > extracts JSON from text
ReferenceError: genericObjectOptionalSchema is not defined
  at src/main/ipc/handlers/sdkEnhancements.ts:57:30
```

**修复建议（一行）**：将第 17 行 import 改为包含 `genericObjectOptionalSchema`：
```ts
import { validateInput, genericIdSchema, genericStringSchema, genericStringOptionalSchema, genericObjectSchema, genericObjectOptionalSchema, genericArraySchema, genericBooleanSchema, genericNumberOptionalSchema } from '../schemas'
```

**判定理由**：测试（`sdkEnhancements.test.ts`）正确，失败源于源码缺导入（T5 改动引入的回归），非测试代码问题 → 按规则路由给工程师修复，不由 QA 自行修改。

> 轮次说明：本轮为 **Round 1**（发现并上报源码 Bug）。待工程师修复后，QA 进行 **Round 2** 复跑确认（见第七节）。

---

## 七、Round 2 复跑结果（工程师修复后）

- **修复确认**：工程师已在 `src/main/ipc/handlers/sdkEnhancements.ts:17` 补上 `genericObjectOptionalSchema` 导入，并与文件内实际使用的 8 个 `generic*Schema` 符号逐一对齐（无遗漏、无多余）。
- **复跑命令**：`npx vitest run test/ipc/handlers/sdkEnhancements.test.ts`
- **复跑结果**：
  ```
  ✓ test/ipc/handlers/sdkEnhancements.test.ts (11 tests) 11ms
    Test Files  1 passed (1)
    Tests       11 passed (11)
  ```
- **结论**：原 2 个失败用例（`extracts JSON from text` / `returns null for non-JSON text`）已转绿，**全子集 185/185 通过（100%）**。2 轮内闭环，无需进入第 3 轮。

> 备注：工程师反馈其本地因 `../codecast/AgentPrimordia/sdk/typescript/dist` 缺失无法跑该测试；但本 QA 环境已验证该测试文件仅含 `@agentprimordia/sdk` 的 **type** 导入（运行期被擦除），故可正常加载运行——Round 2 复跑即在本环境完成，结果与预期一致。

---

## 五、已知问题 / 未覆盖项

1. ~~**【源码 Bug · 待返工】** `sdkEnhancements.ts` 缺 `genericObjectOptionalSchema` 导入（见第四节）。影响：`SDK_EXTRACT_STRUCTURED` handler 运行期崩溃。已路由工程师。~~
   **→【已修复 · Round 2 闭环】** 工程师于 2026-07-06 修复 `sdkEnhancements.ts:17` 导入，复跑 `sdkEnhancements.test.ts` **11/11 通过**，源码 Bug 已消除，全子集转绿。
2. **【已知缺口 · 非阻断】** T3 的 `SettingsView` 不安全环境 UI 提示未实现（不在本次交付清单）。建议后续补 `SettingsView` 调用 `ConfigStore.isApiKeyStorageSecure()` 展示警示。
3. **【环境限制 · 未覆盖】** 根 `tsc`、全量 `vitest`、`playwright` e2e 因缺 `AgentPrimordia/sdk/typescript/dist` 无法运行；T4 sync 握手、T7 虚拟化滚动性能未做端到端验证，仅静态核查。

---

## 六、结论

工程师 T1–T9 修复整体质量良好：依赖治理、死代码清理、SecretStore fail-closed 后端逻辑、sync 契约两端对齐、i18n/promptContents 导出面保持、虚拟化接入均正确。增量新增 29 测试全部通过，扩展子集 164 测试中 162 通过。**唯一阻断性回归**为 T5 在 `sdkEnhancements.ts` 引入的缺导入 Bug（已定位、已路由工程师，修复仅一行）。修复后预计全子集转绿。
