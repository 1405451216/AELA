# 多模态截图输入设计文档

> 日期: 2026-07-07 | 状态: 已批准待实现

## 问题

InputBox 无 paste 事件，用户无法直接粘贴截图提问。

## 方案

在 InputBox 拦截 `paste` 事件，检测图片类型，读取为 base64 dataURL，与文本消息一起发送。

## 行为

| 操作 | 行为 |
|------|------|
| 粘贴图片到 InputBox | 图片进入"待发送"状态，显示缩略图预览 |
| 粘贴图片 + 输入文字 | 文字 + 图片一起发送 |
| 仅粘贴文字 | 原有行为不变 |
| 模型不支持 vision | Agent 响应提示"当前模型不支持视觉，请切换到 GPT-4o/Claude 3.5 Sonnet" |

## 消息类型扩展

`ChatMessage` 新增可选字段：

```ts
interface ChatMessage {
  // ... 现有字段
  image?: string; // base64 dataURL，仅 image/* 类型
}
```

## 视觉

- InputBox 上方显示待发送图片缩略图（64x64，圆角 8px）
- 缩略图右侧"×"按钮可移除
- 发送后图片显示在 MessageBubble 中（最大宽度 320px，保持比例）

## 文件变化

| 文件 | 变化 |
|------|------|
| `src/renderer/src/components/InputBox.tsx` | 拦截 paste 事件，读取图片为 base64，管理 pendingImages state |
| `src/shared/types/chat.ts` | `ChatMessage` 加 `image?: string` |
| `src/renderer/src/components/chat/MessageBubble.tsx` | 渲染消息中的图片（img 标签，dataURL） |
| `src/main/services/AgentService.ts` | 检测 message.image 存在时，校验 provider 是否支持 vision，不支持则返回友好错误 |

## 模型能力检测

`ProviderManager` 新增 `supportsVision(modelConfigId: boolean)`：

- 基于模型名称启发式判断（gpt-4o, claude-3-5-sonnet, gemini-pro-vision 等）
- 用户可在 ModelConfig 中手动覆盖（checkbox "强制启用视觉"）

## 风险

- 大图 base64 导致消息体积膨胀 → 前端压缩到最大 1024px 宽、JPEG 0.7 质量
- 模型不支持 vision 时用户体验差 → 在 ModelConfigView 中显示视觉能力标签

## 测试策略

1. 验证粘贴图片后 InputBox 显示缩略图
2. 验证发送后 MessageBubble 渲染图片
3. 验证模型不支持 vision 时 Agent 返回提示
4. 验证图片压缩后体积合理（< 500KB）
