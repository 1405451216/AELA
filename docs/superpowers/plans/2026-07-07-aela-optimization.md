# AELA 优化实施计划

> 日期: 2026-07-07
> 设计文档: `docs/superpowers/specs/2026-07-07-*.md` (9 份)

## 执行顺序（按依赖与价值）

```
Phase 1: 基础体验 (无依赖, 强感知)
  T1: Onboarding 四步引导
  T2: Esc 双重中断

Phase 2: 核心能力 (依赖主线程/渲染)
  T3: 上下文窗口动态阈值 + @file 行范围
  T4: 成本仪表盘

Phase 3: 可观测与扩展
  T5: 开发者面板
  T6: Skill 市场

Phase 4: 高级功能 (投入大)
  T7: 本地模型混合推理
  T8: 多模态截图粘贴
  T9: 安全沙箱可验证
```

每项独立交付、独立测试、独立提交。

---

## T1: Onboarding 四步引导

**Goal**: 添加首次启动引导，可跳过，完成后进入 ChatView
**Files**: 见下

### Files

- Create: `src/renderer/src/components/OnboardingWizard.tsx`
- Create: `src/renderer/src/components/onboarding/OnboardingStepModel.tsx`
- Create: `src/renderer/src/components/onboarding/OnboardingStepWorkspace.tsx`
- Create: `src/renderer/src/components/onboarding/OnboardingStepShortcuts.tsx`
- Create: `src/renderer/src/components/onboarding/OnboardingStepPrivacy.tsx`
- Modify: `src/renderer/src/App.tsx` — 入口增加 completedOnboarding 判断
- Modify: `src/renderer/src/stores/configStore.ts` — DEFAULT_CONFIG 加 `completedOnboarding: false`
- Modify: `src/renderer/src/components/settings/SettingsView.tsx` — 加"复位引导"按钮
- Test: `test/components/onboarding.test.tsx`

### Steps

1. [ ] 在 configStore.ts 的 DEFAULT_CONFIG 加 `completedOnboarding: false`
2. [ ] 创建 OnboardingWizard 容器，左侧 step indicator，右侧 step 内容
3. [ ] 实现 OnboardingStepModel（复用 ModelConfigView 表单）
4. [ ] 实现 OnboardingStepWorkspace（调 showOpenDialog）
5. [ ] 实现 OnboardingStepShortcuts（只读卡片）
6. [ ] 实现 OnboardingStepPrivacy + 完成回调
7. [ ] App.tsx 读 config.completedOnboarding 判断渲染
8. [ ] 通过 npm run typecheck 验证

---

## T2: Esc 双重中断

**Goal**: 生成中首次 Esc 提示，2s 内第二次中断
**Files**:

- Create: `src/renderer/src/components/chat/EscInterruptToast.tsx`
- Modify: `src/renderer/src/components/ChatView.tsx`
- Test: `test/components/esc-interrupt.test.tsx`

### Steps

1. [ ] 创建 EscInterruptToast 浮层组件
2. [ ] ChatView 新增 escCount ref + 2s 定时器
3. [ ] keydown listener：面板未打开 + isStreaming 时拦截 Esc
4. [ ] 第一次 Esc 渲染 toast，第二次 2s 内调用 handleStop，超时清零
5. [ ] 卸载时清除定时器
6. [ ] 通过 eslint --max-warnings=0 验证

---

## T3: 上下文窗口动态阈值 + @file 行范围

**Goal**: 阈值按模型 contextSize 计算；支持 @file path:10-20
**Files**:

- Modify: `src/renderer/src/stores/configStore.ts` — ModelConfig 加 `contextSize: number`（默认 8192）
- Modify: `src/main/services/ContextWindowService.ts` — 动态阈值公式 + safetyMargin
- Modify: `src/shared/utils/mentions.ts` — extractMentions 返回 `{ path, startLine?, endLine? }`
- Modify: `src/renderer/src/components/chat/MentionDropdown.tsx` — 行范围预览
- Modify: `src/renderer/src/components/ModelConfigView.tsx` — contextSize 输入框
- Test: `test/services/contextWindow.test.ts`

### Steps

1. [ ] ModelConfig 加 contextSize 字段，默认 8192
2. [ ] ContextWindowService 加 `getModelContextSize()` 计算阈值
3. [ ] mentions.ts 正则扩展为 `/^@file:([^:]+)(?::(\d+)-(\d+))?$/`
4. [ ] AgentService 摄取文件时按 startLine/endLine 截取片段
5. [ ] MentionDropdown 高亮行范围
6. [ ] 类型检查通过

---

## T4: 成本仪表盘

**Goal**: 设置页 Tab 显示 Token 成本按日/月/模型/会话
**Files**:

- Modify: `src/main/services/CostTrackerService.ts` — UsageRecord + 聚合查询
- Create: `src/renderer/src/components/settings/UsageCostTab.tsx`
- Modify: `src/renderer/src/components/settings/SettingsView.tsx` — Tab 入口
- Create: `resources/data/pricing.json` — 默认价格表
- Test: `test/services/costTracker.test.ts`

### Steps

1. [ ] 创建 pricing.json（gpt-4o/claude-3.5/ollama 等）
2. [ ] CostTrackerService 扩 UsageRecord 持久化到 SQLite
3. [ ] 添加聚合查询（按日/周/月/模型）
4. [ ] UsageCostTab 渲染折线图 + 环形图 + 表格
5. [ ] 超限告警 banner（默认 $5）
6. [ ] CSV 导出

---

## T5: 开发者面板

**Goal**: Ctrl+Shift+D 浮层显示 IPC/运行/性能/诊断
**Files**:

- Create: `src/main/services/IpcMonitorService.ts`
- Modify: `src/main/ipc/index.ts` — 注册 IPC 拦截 proxy
- Create: `src/renderer/src/components/DeveloperPanel.tsx`
- Create: `src/renderer/src/components/developer/IpcLogTab.tsx`
- Create: `src/renderer/src/components/developer/AgentRunsTab.tsx`
- Create: `src/renderer/src/components/developer/PerformanceTab.tsx`
- Create: `src/renderer/src/components/developer/DiagnosticTab.tsx`
- Modify: `src/renderer/src/App.tsx` — 快捷键监听
- Test: `test/services/ipcMonitor.test.ts`

### Steps

1. [ ] IpcMonitorService 实现 IPC 拦截 + 100 条缓存
2. [ ] ipc/index.ts 注册拦截器
3. [ ] DeveloperPanel 容器 + Tab 切换
4. [ ] 4 个 Tab 实现
5. [ ] App.tsx 加 Ctrl+Shift+D 监听
6. [ ] 仅 `!app.isPackaged` 模式启用

---

## T6: Skill 市场

**Goal**: 远程注册表 + 本地扫描 + 一键安装
**Files**:

- Create: `src/main/services/SkillRegistry.ts`
- Modify: `src/renderer/src/components/SkillMarketView.tsx`（**新建 View**）
- Create: `src/renderer/src/components/skill/SkillCard.tsx`
- Create: `src/renderer/src/components/skill/PermissionDialog.tsx`
- Modify: `src/main/ipc/handlers/skill.ts` — 扩 IPC 通道
- Modify: `src/renderer/src/views.ts` — 注册 view
- Modify: `src/shared/types/skill.ts` — 加 permissions
- Test: `test/services/skillRegistry.test.ts`

---

## T7: 本地模型混合推理

**Goal**: Ollama + llama.cpp 双引擎，L0-L3 路由
**Files**:

- Create: `src/main/services/LocalEngine.ts`
- Create: `src/main/services/engines/OllamaEngine.ts`
- Create: `src/main/services/engines/LlamaCppEngine.ts`
- Modify: `src/main/services/ModelRouter.ts` — 扩展本地/云端调度
- Create: `src/renderer/src/components/settings/LocalModelsTab.tsx`
- Modify: `src/shared/types/model.ts` — 加 engine 字段

---

## T8: 多模态截图粘贴

**Goal**: InputBox 拦截 paste，读取图片 base64
**Files**:

- Modify: `src/renderer/src/components/InputBox.tsx`
- Modify: `src/shared/types/chat.ts` — ChatMessage.image
- Modify: `src/renderer/src/components/chat/MessageBubble.tsx`
- Modify: `src/main/services/AgentService.ts` — vision 能力校验
- Test: `test/components/multimodal.test.tsx`

---

## T9: 安全沙箱可验证

**Goal**: 操作录像 + 渐进式权限 + 回滚
**Files**:

- Create: `src/main/services/SandboxRecorder.ts`
- Create: `src/main/services/PermissionManager.ts`
- Create: `src/renderer/src/components/SandboxReplayView.tsx`
- Create: `src/renderer/src/components/sandbox/PermissionDialog.tsx`
- Create: `src/renderer/src/components/sandbox/ReplayTimeline.tsx`
- Create: `src/main/ipc/handlers/sandbox.ts`
- Modify: `src/main/services/AgentService.ts` — 调用 recorder
- Modify: `src/main/services/tools/CommandGuard.ts`

---

## 测试与验证

每项实施后：
```bash
npm run typecheck      # 0 error
npx eslint src --max-warnings=0   # 新增文件无警告
npx vitest run test/...  # 对应单测通过
```

## 交付节奏

- Phase 1 (T1+T2): 1 周内可交付
- Phase 2 (T3+T4): 2 周
- Phase 3 (T5+T6): 2 周
- Phase 4 (T7-T9): 3-4 周

总投入约 8-10 周可全部完成。
