# 本地模型混合推理设计文档

> 日期: 2026-07-07 | 状态: 已批准待实现

## 问题

完全依赖云端 API，隐私和成本是瓶颈，弱网/断网不可用。

## 方案

**Ollama 优先 + llama.cpp fallback** 的双引擎本地推理，与云端模型统一由 `ModelRouter` 调度。

## 架构

```
ModelRouter（扩展）
  ├── 路由决策层
  │     ├── 简单任务（补全/lint/重命名）→ 本地小模型
  │     ├── 中等任务（单文件问答）→ 本地大模型（≥7B）
  │     └── 复杂任务（多文件架构/推理）→ 云端 API
  │
  └── 本地引擎抽象层 LocalEngine
        ├── OllamaEngine（优先）
        │     ├── 检测：GET http://localhost:11434/api/tags
        │     ├── 拉取：POST /api/pull（按需下载模型）
        │     └── 推理：POST /api/chat（OpenAI 兼容格式）
        │
        └── LlamaCppEngine（fallback）
              ├── 加载：node-llama-cpp 加载本地 GGUF
              ├── 上下文：session 复用，避免重复加载
              └── 推理：completion（同步/流式）
```

## 模型分级

| 级别 | 模型示例 | 用途 | 引擎 |
|------|----------|------|------|
| L0 极轻 | qwen2.5:0.5b | 补全、关键词提取 | Ollama |
| L1 轻量 | qwen2.5:7b / llama3.1:8b | 单文件问答、重命名 | Ollama |
| L2 中等 | qwen2.5:14b / llama3.1:70b | 多文件推理 | Ollama / llama.cpp |
| L3 云端 | gpt-4o / claude-3.5-sonnet | 复杂架构、长上下文推理 | API |

**路由规则**（可在设置中调整）：

```ts
interface RoutingConfig {
  completion: 'local-l0'         // 行内补全
  singleFile: 'local-l1'         // 单文件问答
  multiFile: 'local-l2'          // 多文件推理
  complex: 'cloud'               // 复杂任务
  fallback: 'cloud'              // 本地失败时回退
}
```

## 离线检测

- 启动时探测 Ollama 可达性（1s 超时）
- 不可达时尝试加载本地 GGUF（`~/.aela/models/*.gguf`）
- 两者都不可用时，显示"离线模式"徽章，所有任务走云端（若网络也断，则提示"无可用模型"）

## 模型管理 UI

设置页 **"本地模型" Tab**：

- 已安装模型列表（名称 / 大小 / 状态）
- 一键安装推荐模型（qwen2.5:7b / llama3.1:8b）
- 下载进度条
- 删除模型按钮

## 文件变化

| 文件 | 变化 |
|------|------|
| `src/main/services/LocalEngine.ts` | **新建**：本地引擎抽象层 |
| `src/main/services/engines/OllamaEngine.ts` | **新建**：Ollama 客户端 |
| `src/main/services/engines/LlamaCppEngine.ts` | **新建**：llama.cpp 加载器 |
| `src/main/services/ModelRouter.ts` | 扩展：路由决策 + 本地/云端调度 |
| `src/renderer/src/components/settings/LocalModelsTab.tsx` | **新建**：模型管理 UI |
| `src/shared/types/model.ts` | 扩展 `ModelConfig.engine: 'api' \| 'ollama' \| 'llamacpp'` |

## 依赖

- `node-llama-cpp`（llama.cpp 绑定，按需动态 import）
- Ollama 无需 npm 包，直接 HTTP 调用

## 风险

- llama.cpp 原生模块编译问题 → 仅当 Ollama 不可用时动态 import，编译失败降级纯云端
- 本地模型推理慢 → 设置页显示推理速度基准，用户可手动调路由
- GGUF 文件体积大（4-8GB）→ 下载前确认磁盘空间

## 测试策略

1. 验证 Ollama 检测 + 模型列表拉取
2. 验证 llama.cpp 加载 GGUF + 推理
3. 验证路由决策（简单任务走本地，复杂走云端）
4. 验证离线模式降级
5. 验证模型安装/卸载 UI
