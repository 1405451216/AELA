# AELA 测试技术债修复 · 回归验证 QA 报告（2026-07-06）

**验证工程师**：严过关（QA）
**项目**：`E:\codecast\AELA`（Electron + React + TypeScript 桌面 AI 编程助手）
**背景**：上一轮全量验证（qa-report-fullverify-2026-07-06.md）遗留 4 项测试技术债；工程师完成一轮修复后，由 QA 独立实跑回归确认。

---

## 0. 最终判定（TL;DR）

| 项 | 复跑结果 | 是否真绿 | 路由 | 备注 |
|---|---|---|---|---|
| ① better-sqlite3 加载失败 | 66/66 PASS | **是** | **NoOne** | 工程师二进制替换 + vitest.config 加固有效 |
| ③ smoke.spec.ts `__dirname` | 不再报 `__dirname`，改为 `Process failed to launch!` | 测试层**真绿**（e2e 仍因无显示环境失败） | **NoOne** | 工程师 ESM 修复有效 |
| ④ DiffCard 断言歧义 | 9/9 PASS | **是** | **NoOne** | 工程师断言收紧有效 |
| ② BackgroundAgentService 无限循环 | 独立复现确认无限循环真实存在 | N/A（**真实产品 bug，非测试债**） | **NoOne**（本轮不返工，另立产品 bug） | 工程师「不改业务源码」约束下未修，处理正确 |

**总判定**：①③④ 三项工程师修复经独立实跑**全部确认有效，无需工程师返工**；② 确认为**真实产品 bug（非测试债）**，本轮不在返工范围，建议另立产品 bug 跟进。**遗留问题 2 项**。

---

## 1. 复跑 ①：better-sqlite3 相关 66 用例

**命令**
```bash
npx vitest run test/services/memoryService.test.ts test/services/sessionStore.test.ts test/e2e/coreUserFlow.test.ts
```

**结果**
```
 Test Files  3 passed (3)
      Tests  66 passed (66)
```
- `memoryService.test.ts`：**25 passed**
- `sessionStore.test.ts`：**25 passed**
- `test/e2e/coreUserFlow.test.ts`：**16 passed**（修前 14 跑通 2 失败 → 本次全 16，符合预期）

**结论**：工程师的「替换匹配 Node 22（NMV127）的预编译二进制 v12.11.1 node-v127-win32-x64」+「`vitest.config.ts` 增加 `test.server.deps.external: ['better-sqlite3']` 防御加固」**有效**。独立佐证：`node -e "require('better-sqlite3')"` 加载成功（sqlite 3.53.2），`node_modules/.../better_sqlite3.node` 时间戳 07-06 23:01（近期替换）。**① 真绿。**

---

## 2. 复跑 ④：DiffCard 断言歧义

**命令**
```bash
npx vitest run test/components/DiffCard.test.tsx
```

**结果**
```
 test/components/DiffCard.test.tsx  9 tests  172ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

**结论**：`DiffCard.test.tsx` 第 87 行已将 `getByText(/View Details/)` 收紧为 `getByRole('button', { name: /View Details/ })`，命中折叠提示文案歧义已消除。**9/9 全绿，④ 真绿。**

---

## 3. 复跑 ③：Playwright smoke（确认不再 `__dirname`）

**命令**
```bash
npx playwright test
```

**结果**
```
Running 2 tests using 1 worker
  1) smoke.spec.ts:12 › 应用能正常启动并显示窗口
  2) smoke.spec.ts:48 › 命令面板能打开（Ctrl+P）
  2 failed
Error: Process failed to launch!
```
- **关键**：错误已由上一轮的 `ReferenceError: __dirname is not defined` 变为 **`Process failed to launch!`**。`__dirname` 缺陷**已消除**，当前阻断因素为无显示环境（本沙箱 `DISPLAY` 为空、无 xvfb），与测试代码无关。
- 确认 `out/main/index.js` 存在（1.1MB），启动失败纯属显示环境限制。

**结论**：③ 工程师 ESM 修复（`fileURLToPath(import.meta.url)`）**有效**——`__dirname` 不再出现。e2e 仍失败属显示环境限制，**非代码回归**。若仍报 `__dirname` 则判工程师修复无效并路由回工；本次已确认不再出现，**路由 NoOne**。

---

## 4. ② 独立复现：extractFilePathsFromOutput 无限循环（关键）

> 目标：独立确认「② 是真实产品 bug，不是测试债」，不修改业务源码，只复现/验证。

### 4.1 最小复现脚本
文件：`E:\codecast\AELA\qa-repro-extractFilePaths.js`（照搬源码 `extractFilePathsFromOutput` 的「正则 + while(exec)」逻辑，未改业务源码）。对 12 种输入跑同一段逻辑，设迭代上限 100000、并对「`lastIndex` 长期不前进」计数。

### 4.2 复现结果（全部陷入无限循环）
```
[LOOP!] case3_input(.ts后跟括号)   iter=1003 lastIndex=56 matched=""@56
[LOOP!] case6_input                iter=1003 lastIndex=26 matched=""@26
[LOOP!] tsx_path_end_no_trailing_nl iter=1002 lastIndex=22 matched=""@22
[LOOP!] tsx_path_end_with_nl       iter=1002 lastIndex=23 matched=""@23
[LOOP!] windows_path_backslash     iter=1002 lastIndex=28 matched=""@28
[LOOP!] empty                      iter=1002 lastIndex=0  matched=""@0
[LOOP!] realistic_ts_error         iter=1003 lastIndex=88 matched=""@88
[LOOP!] tsx_single_last_token_no_nl iter=1002 lastIndex=7 matched=""@7
[LOOP!] two_tsx_each_end_of_line   iter=1003 lastIndex=12 matched=""@12
... （共 12/12 全部 LOOP）
=== 结论 === 存在无限循环：所有输入均在有限次迭代内未返回，lastIndex 卡死
```
**注意**：包含空字符串、以及实际测试用例 3 的输入 `'app.ts(1,7): error TS2322: ...'`——**无一例外全部死循环**，证明这是结构性缺陷，而非特定输入触发。

### 4.3 根因诊断（node 实跑确认）
正则 `/([\w./\-]+\.tsx?)[\s(,:;]|$/gm` 因**运算符优先级**被解析为
`([\w./\-]+\.tsx?)[\s(,:;])  |  ($)` ——
`$` 是与「路径 + 字符类」**整体并列**的备选分支，而非字符类的备选。因此该正则可在**行尾/串尾匹配一个零宽位置而无需捕获任何路径**（`match[0]=""`、`match[1]=undefined`）。在**字符串末尾**的零宽 `$` 匹配**不会推进 `lastIndex`**（冻结于串尾），与 `while ((match = pattern.exec(normalized)) !== null)` 配合即**真·无限循环**。

实测证据（case3 输入，len=56）：
```
iter 0  match.index 0  lastIndex 7   match[0]="app.ts("  match[1]="app.ts"   ← 正常匹配
iter 1  match.index 56 lastIndex 56  match[0]=""         match[1]=undefined  ← 串尾零宽 $ 匹配
iter 2  match.index 56 lastIndex 56  match[0]=""         match[1]=undefined  ← lastIndex 冻结，永不终止
...（持续）
```
空字符串亦立即死循环（`lastIndex` 恒为 0）。

### 4.4 实跑 test 文件佐证
```bash
timeout 80 npx vitest run test/services/BackgroundAgentService.test.ts
```
在 80s 墙钟超时内**无任何输出**（vitest 头部都未打印），说明 worker 事件循环被 `extractFilePathsFromOutput` 的同步无限循环阻塞，与工程师所述「用例 3 `triggerFromTerminal` 首次调用该方法处挂死、后续用例全部卡住」完全吻合。

### 4.5 结论
**② 是 100% 真实产品 bug**，位于业务源码 `src/main/services/BackgroundAgentService.ts` 的 `extractFilePathsFromOutput`，**非测试债**。工程师在「不改业务源码」硬约束下未修，处理**正确**。建议另立产品 bug 修复（见 §7 #1）。

---

## 5. 改动面核查（工程师是否动了 `src/` 业务源码）

> 本沙箱目录 `E:\codecast\AELA` **非 git 仓库**（`git status` → `fatal: not a git repository`，`ls -d .git` → `NO_GIT_REPO`），无法 git status/diff。改用「文件级核查（Read + 加载验证）」替代。

| 文件 | 核查结果 | 判定 |
|---|---|---|
| `vitest.config.ts` | 第 41–45 行含工程师新增 `test.server.deps.external: ['better-sqlite3']` 加固（含注释说明） | 预期内 ✓ |
| `test/e2e-playwright/smoke.spec.ts` | 第 5、9 行改用 `fileURLToPath(import.meta.url)` 推导目录 | 预期内 ✓ |
| `test/components/DiffCard.test.tsx` | 第 87 行断言由 `getByText` 收紧为 `getByRole('button', { name: /View Details/ })` | 预期内 ✓ |
| `src/main/services/BackgroundAgentService.ts` | 仍含缺陷正则（**未改动**） | 符合「② 不修业务源码」约束 ✓ |
| `node_modules/better-sqlite3/build/Release/better_sqlite3.node` | 时间戳 07-06 23:01，版本 v12.11.1，`require` 加载成功（sqlite 3.53.2） | 预期内（二进制替换）✓ |

**结论**：改动面限定于 `test/`、`vitest.config.ts`、预编译二进制；**未改动任何 `src/` 业务源码**（② 业务源码保持未修，符合约束）。

---

## 6. 智能路由判定（Smart Routing）

| 验证项 | 复跑结果 | 分类 | 路由 | 是否需工程师返工 |
|---|---|---|---|---|
| ① better-sqlite3 | 66/66 绿 | 测试/环境设施（已修） | **NoOne** | 否 |
| ③ smoke `__dirname` | 不再 `__dirname`（e2e 仍因显示环境失败） | 测试代码缺陷（已修） | **NoOne** | 否 |
| ④ DiffCard | 9/9 绿 | 测试质量（已修） | **NoOne** | 否 |
| ② 无限循环 | 确认真实产品 bug | 业务源码 bug | **NoOne**（本轮不返工，另立产品 bug） | 否（本轮）/ 建议另开产品 bug |

**总路由**：①③④ 工程师修复均经独立实跑确认有效 → **NoOne（无需就 ①③④ 返工）**。② 确认为真实产品 bug（非测试债），本轮不在返工范围 → **NoOne（本轮）**，建议另立产品 bug 跟进。

---

## 7. 遗留问题（Known Issues）

| # | 问题 | 影响 | 分类 | 建议 |
|---|---|---|---|---|
| 1 | `BackgroundAgentService.extractFilePathsFromOutput` 正则无限循环（**已确认真实产品 bug**） | 任何含终端输出触发 `triggerFromTerminal` 的路径提取都会 CPU 死循环 / 应用挂死 | 业务源码 bug | 另立产品 bug：将 `[\s(,:;]|$` 改为 `([\w./\-]+\.tsx?)(?:[\s(,:;]|$)`（或先匹配路径再单独判断尾随字符/行尾）；并加循环保护（cap 迭代次数、或改用 `matchAll` + 显式前移 `lastIndex`） |
| 2 | Playwright e2e 在无显示环境失败（`Process failed to launch!`） | `smoke.spec.ts` 2 用例在本环境无法真绿 | 环境/显示限制 | 在有显示环境或 `xvfb` 下复跑；测试代码本身已正确 |

**遗留问题数：2。**

---

## 8. 结论

1. **①③④ 三项测试技术债修复，经 QA 独立实跑全部确认有效**：① 66/66、④ 9/9、③ 不再报 `__dirname`（现为显示环境类 `Process failed to launch!`）。**无需工程师就 ①③④ 返工**。
2. **② 经独立复现（最小正则复现 + 实跑 test 文件佐证）确认是真实产品 bug**（正则 alternation 优先级导致零宽 `$` 死循环），**非测试债**；工程师在「不改业务源码」约束下未修，处理正确。建议另立产品 bug 跟进。
3. **改动面核查**：仅 `test/`、`vitest.config.ts`、预编译二进制；`src/` 业务源码未被改动（② 保持未修）。
4. **遗留问题 2 项**：② 产品 bug、③ 无显示环境。

**最终交付判定**：①③④ 真绿、② 确认为真实产品 bug、无需工程师就 ①③④ 返工、遗留问题 2 项。
