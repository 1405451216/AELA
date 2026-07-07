# 上下文窗口智能管理设计文档

> 日期: 2026-07-07 | 状态: 已批准待实现

## 问题

原 ContextWindowService 用固定 70% 阈值，不感知模型实际窗口大小；@file 行范围引用不存在。

## 方案

### 动态阈值

根据模型 context 窗口自动计算触发点：

```
ThresholdPct = clamp(1 - safetyMargin / modelContextSize, 0.5, 0.85)
safetyMargin = min(contextSize * 0.1, 4096)
```

| 模型窗口 | 触发阈值 |
|----------|----------|
| 8K  | 75% |
| 32K | 85% |
| 128K | 85% (clamp) |
| 200K | 85% (clamp) |

**实现**: `ModelConfigStore` 加 `contextSize: number` 字段（默认 8192），`ContextWindowService` 读该字段计算阈值。

### @file 行范围

正则 `/^@file:([^:]+)(?::(\d+)-(\d+))?$/`

- 原逻辑：`path`
- 新逻辑：`{ path, startLine?, endLine? }`，extractMentions 返回三元组
- 渲染进程 MentionDropdown 预览选中片段（高亮显示行范围）

### 压缩升级

- 保留现有 `compressWithLLM()` + 30s 超时
- 新增"部分压缩"模式：仅压缩最早 50% 消息，保留后半（对话结构更稳）
- 压缩后历史滚动位置不变（用索引锚定）

## 文件变化

| 文件 | 变化 |
|------|------|
| `src/renderer/src/stores/configStore.ts` | `ModelConfig` 加 `contextSize: number` 字段，默认 8192 |
| `src/main/services/ContextWindowService.ts` | `getModelContextSize()` + 动态阈值，替换固定 70% |
| `src/shared/utils/mentions.ts` | `extractMentions()` 返回 `{ path, startLine?, endLine? }` 三元组 |
| `src/renderer/src/components/chat/MentionDropdown.tsx` | 行范围预览（高亮 + 字符数统计） |
| `src/renderer/src/components/ModelConfigView.tsx` | 新增 contextSize 输入框（数字，最小 1024，最大 1000K） |

## 测试策略

1. 不同 contextSize 字段下阈值计算正确
2. 老 ModelConfig 无 contextSize 字段 → 回退默认 8192
3. @file path:10-20 正确解析 startLine/endLine
4. @file path:10-（缺 end）→ 报错提示格式
5. 压缩后历史消息索引引用不变

## 风险

- SDK 层 token 估算偏差 → 阈值可能不准 → 后续迭代按模型调优
- 老版本 ModelConfig 无字段 → 默认 8192 兜底
