// AELA — @-mention 上下文引用系统
// 类型定义和上下文收集器
// 用户在 InputBox 中输入 @file @memory @web 引用上下文
// 引用内容在发送时附加到用户消息中

// ===== 引用类型 =====

export type MentionType = 'file' | 'memory' | 'web'

export interface MentionItem {
  type: MentionType
  /** 显示标签 */
  label: string
  /** 引用标识（文件路径 / 记忆 ID / URL） */
  ref: string
  /** 上下文内容（发送时附加到消息） */
  content: string
  /** 来源图标 */
  icon: string
}

export interface MentionContext {
  /** 所有引用项的汇总上下文文本 */
  contextText: string
  /** 引用项列表（用于 UI 展示） */
  items: MentionItem[]
}

// ===== 引用解析器 =====

/**
 * 从输入文本中提取已完成的 @-mention 引用
 * 支持格式：@file:path/to/file @memory:keyword @web:https://...
 */
export function extractMentions(text: string): string[] {
  const mentions: string[] = []
  // 匹配 @file: @memory: @web: 前缀后跟非空白字符
  const regex = /@(file|memory|web):(\S+)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    mentions.push(`@${match[1]}:${match[2]}`)
  }
  return mentions
}

/**
 * 检测当前光标位置是否在 @-mention 输入中
 * 返回 mention 类型前缀（如 "file"、"memory"、"web"）或 null
 */
export function detectMentionInput(text: string, cursorPos: number): { type: string; query: string } | null {
  // 从光标位置向前找 @ 字符
  const beforeCursor = text.substring(0, cursorPos)
  const atMatch = beforeCursor.match(/@(\w*)$/)
  if (!atMatch) return null

  const query = atMatch[1] // @ 后面的文本

  // 判断 mention 类型
  if (query.startsWith('file')) return { type: 'file', query: query.slice(4) }
  if (query.startsWith('memory')) return { type: 'memory', query: query.slice(6) }
  if (query.startsWith('web')) return { type: 'web', query: query.slice(3) }

  // 只输入了 @，还未指定类型
  if (query === '') return { type: '', query: '' }

  return null
}

/**
 * 将引用项列表构建为上下文文本
 * 附加到用户消息前面，供 Agent 使用
 */
export function buildContextText(items: MentionItem[]): string {
  if (items.length === 0) return ''

  const sections: string[] = []
  for (const item of items) {
    const typeLabel = {
      file: '文件',
      memory: '记忆',
      web: '网页',
    }[item.type]
    sections.push(`【${typeLabel}引用: ${item.label}】\n${item.content}`)
  }

  return `\n\n--- 上下文引用 ---\n${sections.join('\n\n')}\n--- 引用结束 ---\n`
}

/**
 * 从输入文本中移除 @-mention 标记，保留纯净的用户消息
 */
export function stripMentionTags(text: string): string {
  return text.replace(/@(file|memory|web):\S+/g, '').trim()
}
