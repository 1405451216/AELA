# AELA 增量修复 PRD（FixAll 2026-07-06）

> **作者**：产品经理 许清楚（software-product-manager）
> **依据**：`docs/project-evaluation-2026-07-06.md`（架构师 高见远，2026-07-06）
> **目标**：对评估报告的 15 项问题逐条定性（**可直接修 / 需架构决策 / 分阶段演进**），明确本轮实现范围，指导架构师与工程师落地。
> **约定**：本轮只做需求与风险定性，不写代码。编号与评估报告 6.1 汇总表一致；其中 A-1≈D-3（同源：SDK 兄弟依赖耦合）、Q-2≈S-3（同源：IPC 输入校验）按同一根因处理。

## 0. 总览表

| 编号 | 分类 | 本轮是否实现 | 优先级 | 一句话动作 |
|------|------|------|--------|------------|
| A-1 | 需架构决策 | 否 | P1 | 先定 SDK 发布形态（npm 包 / monorepo / submodule），本轮只补文档 + 环境变量回退 |
| D-3 | 需架构决策 | 否 | P1 | 同上（兄弟 `file:` 依赖，与 A-1 同源） |
| A-2 | 分阶段演进 | 否 | P2 | 立「表面积收敛」规范，新功能优先抽象而非堆砌（长期路线） |
| A-3 | 可直接修 | 是 | P1 | 删除 `src/main/server/sync-server.ts` 死代码 |
| Q-1 | 分阶段演进 | 部分 | P2 | 本轮拆内容型（i18n/promptContents），逻辑型/类型型留分阶段 |
| Q-2 | 可直接修 | 是 | P1 | 为剩余 ~20 个 handler 补齐 zod 输入校验 |
| D-1 | 可直接修 | 是 | P1 | `react`/`react-dom`/`electron-store` 移入 `dependencies` |
| D-2 | 可直接修 | 是 | P2 | 移除 `yjs`/`y-websocket`/`lib0` 未使用依赖 |
| S-1 | 可直接修 | 是 | P1 | SecretStore 缺 Keyring 时 fail-closed，拒绝明文落盘 |
| S-2 | 分阶段演进 | 部分 | P2 | apiKey 从 URL query 移入 header/子协议，TLS/限流留部署决策 |
| S-3 | 可直接修 | 是 | P1 | 同 Q-2，IPC 边界统一 zod 校验 |
| S-4 | 可直接修 | 是 | P2 | 随 A-3 删死文件即消除误启用开放中继 |
| M-1 | 分阶段演进 | 否 | P2 | 分支覆盖 30%→60% 分步提升，补齐组件测试（长期） |
| M-2 | 可直接修 | 是 | P2 | 补 `CONTRIBUTING.md` 与 SDK 构建前置条件文档 |
| P-1 | 分阶段演进 | 部分 | P2 | 引入虚拟列表，先对消息列表做虚拟化试点 |

**本轮实现统计**：可直接修且实现 **8 项**（A-3, Q-2, D-1, D-2, S-1, S-3, S-4, M-2）；需架构决策 **2 项**推迟（A-1, D-3）；分阶段演进中做安全起步 **3 项**（Q-1, S-2, P-1），纯路线图 **2 项**（A-2, M-1）。

---

## 1. 逐项定性

### 1.1 A-1 / D-3 — SDK 兄弟依赖强耦合（P1，需架构决策）

1. **问题复述**：`@agentprimordia/sdk` 以 `file:../codecast/AgentPrimordia/sdk/typescript` + Vite alias 强耦合，CI/新环境必须存在该兄弟仓库，构建不可移植、CI 脆弱。
2. **定性分类**：**需架构决策** —— 涉及外部基建/发布形态/跨仓库契约，属不可逆改动，须由架构师或用户先定方案，本轮不盲目动。
3. **推荐修复方式**（三选一，待定）：
   - (a) **私有 npm 包**：将 SDK 发布到内部 registry（verdaccio/Artifactory），AELA 改为普通版本依赖；
   - (b) **monorepo workspace**：合并为 pnpm workspace / turbo，SDK 为内部包，版本随仓锁；
   - (c) **git submodule**：用 submodule 锁定 SDK 版本，AELA 仍本地构建。
   - **本轮安全起步**：确认 `electron.vite.config.ts` 已有 `AELA_SDK_PATH` 环境变量回退（报告 3.2 已确认）；在 README 显著标注本地构建前置条件（并入 M-2）。
4. **风险与影响面**：改动 `package.json` 依赖声明 + `electron.vite.config.ts` alias + `scripts/build-sdk.mjs`；影响全仓库对 SDK 的 import；若方案选错（如强推 npm 但 SDK 未发布）会阻塞整个 CI。属不可逆的依赖图变更。
5. **优先级**：P1；**本轮不实现结构化解耦**，仅做文档 + 环境变量安全起步。

### 1.2 A-2 — 服务/IPC 表面积过大（P2，分阶段演进）

1. **问题复述**：~53 个服务 + 325 个 IPC 通道，系统表面积过大，认知负荷高，新功能易继续堆砌而非抽象收敛。
2. **定性分类**：**分阶段演进** —— 长期结构性治理，非一次性修复。
3. **推荐修复方式**：本轮只立规范 —— 新增架构准则：新功能优先抽象收敛（聚合相关 handler 到域门面、合并细碎服务）；建立「表面积预算」意识；下阶段审计 325 通道，识别可合并/废弃项；对 53 服务做职责聚类评审。**不做结构性拆分**。
4. **风险与影响面**：规范类，无代码风险；本轮不改动代码。
5. **优先级**：P2；**本轮不实现**（列入持续重构路线）。

### 1.3 A-3 — 重复/死代码 sync-server（P1，可直接修）

1. **问题复述**：两份 `sync-server.ts` 并存，其中 `src/main/server/sync-server.ts`（776B 纯 echo 无鉴权）在 `src` 内无任何引用，为死代码，易误导维护者。
2. **定性分类**：**可直接修** —— 删除死代码明确、低风险、机械化。
3. **推荐修复方式**：删除 `src/main/server/sync-server.ts`（报告附录 B grep 已确认零引用）；保留并加固 `src/server/sync-server.ts`（见 S-2）；顺手检查 `src/main/server/` 目录是否还有其他孤儿文件一并清理。
4. **风险与影响面**：删除单文件，零运行时影响（无引用）；需确认构建脚本/CI 未显式引用该路径。低。同时消除 S-4 风险。
5. **优先级**：P1；**本轮实现**。

### 1.4 Q-1 — 上帝文件（P2，分阶段演进）

1. **问题复述**：上帝文件集中 —— `i18n.ts`(1428)、`promptContents.ts`(860)、`SessionStore.ts`(720)、`global.d.ts`(673)、`ToolManager.ts`(664)、`MemoryService.ts`(652)。
2. **定性分类**：**分阶段演进** —— 重构，风险随文件类型差异大。
3. **推荐修复方式**（按风险分层，详见第 4.2 节）：
   - **内容型（低风险，本轮拆）**：`i18n.ts` 按语言/模块拆为 `src/shared/i18n/{zh,en,...}.ts` + 索引；`promptContents.ts` 按 agent/tool/system 拆子模块（纯字典/常量搬移）。
   - **类型型（中风险，分阶段）**：`global.d.ts` 改为由 preload 暴露 API 自动生成或按域拆多个 `.d.ts`，避免与 preload 漂移。
   - **逻辑型（高风险，分阶段/暂缓）**：`SessionStore`/`ToolManager`/`MemoryService` 按子域方法聚类拆分，需配套单测与调用方更新，单独立项。
4. **风险与影响面**：内容型极低（导出保持）；类型型需同步 preload/renderer 类型引用；逻辑型高回归，波及大量服务/store 调用。
5. **优先级**：P2；**本轮部分实现**（仅内容型安全起步）。

### 1.5 Q-2 / S-3 — IPC 输入校验不一致（P1，可直接修）

1. **问题复述**：约 20/37 个 IPC handler 未在边界做 zod 输入校验，渲染进程传入的 `id`/对象直接进服务层，存在非法输入/越权访问面。
2. **定性分类**：**可直接修** —— 明确、低风险、机械化；且收益高（报告列为 Top 1）。
3. **推荐修复方式**：复用现有 `main/utils/ipcHelpers.ts` 的 `validateInput` + zod schema 模式；为未校验 handler 补 schema（参数形状从 `src/shared/ipcChannels.ts` 推）；在 handler 入口 `wrap()` 前置校验；建议补一条 ESLint/CI 规则强制 handler 调用 `validateInput`。**优先覆盖涉及 id/路径/外部命令的域**（terminal/file/agent 等）。
4. **风险与影响面**：改动 20 个 handler 文件；主要回归风险是 schema 过严导致历史合法入参被拒 → 须对照现有调用方（`preload/api/*`、`renderer`）实测；仅收紧输入边界，不改业务逻辑。建议配套单测/e2e。
5. **优先级**：P1；**本轮实现**。

### 1.6 D-1 — 依赖分类错误（P1，可直接修）

1. **问题复述**：`react`/`react-dom`(^18.3.1)、`electron-store`(^10) 误置于 `devDependencies`，语义错误，未来任何外部依赖假设会破裂。
2. **定性分类**：**可直接修** —— 编辑 `package.json` 机械化、低风险。
3. **推荐修复方式**：将 `react`、`react-dom`、`electron-store` 从 `devDependencies` 移至 `dependencies`；重新安装并锁定 lockfile；确认 `electron-store` 的 `BUNDLE_DEPS` 配置无需改。
4. **风险与影响面**：仅 `package.json` + lockfile；CI 重装依赖；运行行为不变（electron-vite 仍打包进 `out/`）。极低。
5. **优先级**：P1；**本轮实现**。

### 1.7 D-2 — 未使用依赖（P2，可直接修）

1. **问题复述**：`yjs`(^13.6.31)/`y-websocket`(^3.0.0)/`lib0`(^0.2.117) 声明但全仓（含类型/transitive）零引用，徒增安装体积与供应链面。
2. **定性分类**：**可直接修** —— 移除依赖机械化、低风险。
3. **推荐修复方式**：从 `package.json` 移除三项；删除 lockfile 对应项并 `npm install`；全局 grep 确认无 `import`/类型引用（含 `.d.ts`）；若未来「协作编辑」需要，单独立项引入。
4. **风险与影响面**：仅依赖声明；减小安装/供应链面；需确认无 transitive 类型引用。极低。
5. **优先级**：P2；**本轮实现**。

### 1.8 S-1 — SecretStore 明文降级（P1，可直接修）

1. **问题复述**：`secretStore.ts:47-49` 当 OS Keyring 不可用时降级为 Base64（明文等价）存储 API Key，`isSecure()` 返回 false 仍持久化明文，Linux 无 GUI 会话静默降级有泄露风险。
2. **定性分类**：**可直接修** —— 单文件 fail-closed，行为清晰。
3. **推荐修复方式**：当 `safeStorage.isEncryptionAvailable()`/`isSecure()` 为 false 时，**不在 electron-store 持久化明文**，返回明确错误，UI 提示「当前环境无法安全保存密钥，请手动配置或设置主密码」。**可选增强（需产品决策，本轮列为 Open Question）**：实现主密码派生密钥（PBKDF2 + AES）做二次加密。
4. **风险与影响面**：仅改 `main/services/secretStore.ts` 及周边调用（`ConfigStore`/`SettingsView` 错误提示）；行为变更：Linux 无 GUI 会话下无法自动持久化密钥（需用户干预）；现有依赖明文降级的测试/路径需更新。属安全行为变更，fail-closed 更安全。
5. **优先级**：P1；**本轮实现**（最小 fail-closed 方案）。

### 1.9 S-2 — apiKey 置于 URL query（P2，分阶段演进）

1. **问题复述**：`src/server/sync-server.ts:116-117` 将 `apiKey` 置于 WebSocket URL query（`?apiKey=...`），易被代理/日志记录；且服务端无 TLS、无限流、无 `apiKey` 强度校验。
2. **定性分类**：**分阶段演进** —— TLS/限流涉及部署假设；apiKey 传输为协议契约。
3. **推荐修复方式**：**本轮安全起步** —— 将 `apiKey` 从 URL query 移入 `Sec-WebSocket-Protocol` 子协议或首次握手消息头（同步改 `SyncService.ts` 客户端握手），避免代理/日志泄露；加一个简单内存令牌桶限流。**TLS 终止与部署拓扑**（sync-server 是否暴露公网）留待架构师/部署决策后再做。
4. **风险与影响面**：改 `src/server/sync-server.ts` + `src/main/services/SyncService.ts`（握手契约），需两端同步；限流改动小。
5. **优先级**：P2；**本轮部分实现**（query→header + 基础限流，TLS 推迟）。

### 1.10 S-4 — echo 死代码开放中继（P2，可直接修）

1. **问题复述**：`src/main/server/sync-server.ts` 纯 echo 无鉴权，若被误启用将开放任意消息中继。
2. **定性分类**：**可直接修** —— 随 A-3 删除即消除。
3. **推荐修复方式**：同 A-3 删除死文件（`src/main/server/sync-server.ts`）。
4. **风险与影响面**：无（无引用）。
5. **优先级**：P2；**本轮实现**（并入 A-3）。

### 1.11 M-1 — 测试覆盖率（P2，分阶段演进）

1. **问题复述**：分支测试覆盖率仅 35.91%（门禁 30% 刚越线），错误处理/边界路径覆盖弱；渲染层组件测试仅少数 View，大量 View 无测试。
2. **定性分类**：**分阶段演进** —— 持续测试建设。
3. **推荐修复方式**：分阶段提升分支门禁 30%→45%→60%；优先补 handler 边界/错误分支单测（与 Q-2/S-3 同步，校验改动应带测试）；补齐核心 View 组件测试（`ChatView`/`SettingsView`/`InputBox` 等）。**本轮不出强制门禁提升**（避免 CI 红），只排路线图 + 为高优 handler 补测试。
4. **风险与影响面**：门禁突变会致 CI 失败；须逐步提升。
5. **优先级**：P2；**本轮不实现**（路线图）。

### 1.12 M-2 — 缺失贡献/构建文档（P2，可直接修）

1. **问题复述**：无 `CONTRIBUTING.md`；SDK 兄弟依赖的本地构建前置条件未在 README 显著标注，新手易踩坑。
2. **定性分类**：**可直接修** —— 写文档机械化、低风险。
3. **推荐修复方式**：新增 `CONTRIBUTING.md`（开发环境、依赖安装、SDK 前置、测试/lint 命令、PR 规范）；在 README 顶部加「本地开发前置条件」框（含 `../codecast/AgentPrimordia` 路径要求、`AELA_SDK_PATH` 用法、`predev`/`prebuild` 脚本）。可与 A-1 安全起步合并。
4. **风险与影响面**：极低（纯文档）。
5. **优先级**：P2；**本轮实现**。

### 1.13 P-1 — 大列表未虚拟化（P2，分阶段演进）

1. **问题复述**：会话/消息/技能等大列表未发现 `react-window` 等虚拟滚动方案，数据量大时存在渲染压力。
2. **定性分类**：**分阶段演进** —— 多 View 重构。
3. **推荐修复方式**：引入 `react-window`/`@tanstack/react-virtual`；**本轮安全起步** —— 先对体量最大的「消息列表」做虚拟化试点，验证性能与交互（滚动位置保持、流式追加兼容）后再推广到会话列表、技能列表。
4. **风险与影响面**：改 `SessionManagerView`/`SkillsView`/`MessageList` 等组件；回归点：滚动位置、选中态、虚拟项事件；须与流式渲染（`streaming.ts` 的 `React.memo`/批量 flush）兼容验证。
5. **优先级**：P2；**本轮部分实现**（消息列表试点）。

---

## 2. 本轮「可直接修」实现清单（应实现）

| 编号 | 动作 | 主要文件 |
|------|------|----------|
| A-3 | 删除死代码 `sync-server.ts` | `src/main/server/sync-server.ts` |
| S-4 | 随 A-3 删除即消除 | （同 A-3） |
| Q-2 / S-3 | 为剩余 ~20 handler 补 zod 校验 | `src/main/ipc/handlers/*`、`main/utils/ipcHelpers.ts` |
| D-1 | 依赖移入 `dependencies` | `package.json` + lockfile |
| D-2 | 移除未使用依赖 | `package.json`（yjs/y-websocket/lib0）+ lockfile |
| S-1 | SecretStore fail-closed | `src/main/services/secretStore.ts` + `SettingsView` 错误提示 |
| M-2 | 补文档 | `CONTRIBUTING.md`、README 前置条件框 |

> 本轮「可直接修」共 **8 项**（含 S-4 并入 A-3）。建议执行顺序：D-1/D-2（依赖，1 天）→ A-3/S-4（死代码，0.5 天）→ S-1（安全，0.5 天）→ Q-2/S-3（校验，按域分批）→ M-2（文档，0.5 天）。

## 3. 「需架构决策 / 分阶段」推迟清单（应推迟）

| 编号 | 分类 | 本轮动作 |
|------|------|----------|
| A-1 / D-3 | 需架构决策 | 定 SDK 发布形态（npm/monorepo/submodule）；本轮只补文档 + `AELA_SDK_PATH` 回退 |
| A-2 | 分阶段演进 | 立表面积收敛规范，无代码改动 |
| Q-1 | 分阶段演进 | **安全起步**：本轮只拆内容型（i18n/promptContents） |
| S-2 | 分阶段演进 | **安全起步**：apiKey query→header + 基础限流；TLS 推迟 |
| M-1 | 分阶段演进 | 路线图：分支覆盖 30%→60% 分步，补组件测试 |
| P-1 | 分阶段演进 | **安全起步**：消息列表虚拟化试点 |

---

## 4. 重点处置建议

### 4.1 A-1 / D-3（SDK 解耦）

**根因**：SDK 通过 `file:../codecast/AgentPrimordia/sdk/typescript` + Vite alias 强耦合，导致 AELA 无法独立 `npm install`/构建，CI 与新人环境必须存在兄弟仓库。

**结论**：**需架构决策，本轮不做结构化解耦**。理由：三种解耦路径（私有 npm 包 / monorepo workspace / git submodule）涉及外部基建与跨仓库契约，且依赖图变更不可逆，必须由架构师 + 用户先拍板；盲目改 `package.json`/`electron.vite.config.ts` 可能直接阻塞 CI。

**本轮安全起步（可立即做）**：
1. 确认 `electron.vite.config.ts` 已有 `AELA_SDK_PATH` 环境变量回退（报告 3.2 已确认存在），无需改动；
2. 在 README 显著标注本地构建前置条件（并入 M-2）：必须存在 `../codecast/AgentPrimordia` 或设置 `AELA_SDK_PATH`，并说明 `predev`/`prebuild` 会触发 `scripts/build-sdk.mjs`；
3. 把「SDK 解耦方案选择」作为 Open Question 上报架构师，建议优先评估 **monorepo workspace**（改动最小、版本随仓锁）或 **私有 npm 包**（最利于独立 CI）。

**决策点（需架构师/用户确认）**：
- SDK 的发布与版本治理形态？
- 是否接受将 SDK 源码并入 AELA 仓（monorepo）？
- 内部 npm registry 是否可用？

### 4.2 Q-1（上帝文件拆分）

**根因**：内容型（字典/常量）、类型型（window.aela 全量类型）、逻辑型（聚合过多方法的服务/store）三类文件混杂长大，拆分风险差异大。

**结论**：**分阶段演进，按风险分层处理**。本轮只做低风险内容型拆分，逻辑型与类型型留作后续单独立项。

**具体处置建议（分层）**：
- **本轮做（内容型，低风险、纯搬移、导出保持）**：
  - `src/shared/i18n.ts`(1428) → 按语言/模块拆为 `src/shared/i18n/{zh,en,...}.ts` + `index.ts` 统一导出；对外 `export` 接口不变，仅内部文件重组。
  - `src/main/services/promptContents.ts`(860) → 按 `agent`/`tool`/`system` 等子域拆为子模块，由桶文件再导出。
  - 这两类改动无逻辑分支，回归风险极低，可安全纳入本轮。
- **分阶段做（类型型，中风险）**：
  - `src/renderer/src/types/global.d.ts`(673) → 改为由 preload 暴露的 API 自动生成，或按域拆为多个 `.d.ts`，避免与 `preload` 类型漂移；需同步渲染进程类型引用，建议配合类型生成脚本。
- **暂缓 / 单独立项（逻辑型，高风险）**：
  - `SessionStore.ts`(720)/`ToolManager.ts`(664)/`MemoryService.ts`(652) → 按子域方法聚类拆分，波及大量服务与 store 调用方，必须配套单测 + 调用方更新；不纳入本轮，作为独立重构项排期。

**拆分红线**：任何拆分必须保持对外 `export` 签名不变（内容型/类型型），逻辑型拆分须有单测覆盖且通过全量 e2e 才允许合并。

---

## 5. 风险与回归总览

| 维度 | 低风险（可直接修） | 中/高风险（决策/分阶段） |
|------|------|------|
| 改动面 | 依赖声明、死代码删除、单文件安全加固、文档 | SDK 依赖图、多 View 重构、逻辑型大文件拆分、TLS/部署 |
| 生产影响 | 仅 S-1 为安全行为变更（fail-closed 更安全）；其余不影响运行行为 | A-1 误改会阻塞 CI；P-1 改动交互；Q-1 逻辑型高回归 |
| 回归重点 | D-1/D-2 重装依赖跑 CI；Q-2/S-3 校验需对照调用方实测；S-1 更新降级测试 | Q-1/i18n 导出、P-1 滚动/流式兼容、S-2 握手契约两端同步 |
| 建议门禁 | 全量 `lint` + `typecheck` + unit + e2e 通过 | 分阶段项须带单测 + e2e 后合并 |

---

*PRD 结束。后续由架构师确认 A-1/D-3 解耦方案与 Q-1 逻辑型拆分排期，工程师按第 2 节清单落地本轮可直接修项。*
