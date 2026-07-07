# Onboarding 设计文档

> 日期: 2026-07-07 | 状态: 已批准待实现

## 问题

首次启动无引导，用户直入空 ChatView，模型为空无法对话。

## 方案

四步引导,可跳过，触发条件 `ConfigStore.completedOnboarding === false`。
完成后置 true；设置页保留"复位引导"。

| 步骤 | 内容 | 操作 |
|------|------|------|
| 0 | 模型配置 | 复用 ModelConfigView 核心表单 + 连通性测试 |
| 1 | 工作区 | `showOpenDialog` 选文件夹 |
| 2 | 快捷键 | 只读卡片 |
| 3 | 隐私 | 本地存储确认 → 开始使用 |

## 入口

`App.tsx`: `completedOnboarding ? <ChatView /> : <OnboardingWizard />`

## 视觉

深色圆角，左侧 step 圆点指示器，底部"跳过"+"下一步"。

## 文件

- `OnboardingWizard.tsx` — 容器
- `onboarding/OnboardingStepModel.tsx`
- `onboarding/OnboardingStepWorkspace.tsx`
- `onboarding/OnboardingStepShortcuts.tsx`
- `onboarding/OnboardingStepPrivacy.tsx`

## 风险

- 连通性测试超时 → 降级"稍后测试"
- 复位逻辑走 ConfigStore 原子写
