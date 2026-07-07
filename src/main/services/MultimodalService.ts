// 多模态输入支持服务
// 移植自 AP Go 核心层 internal/agent/multimodal/multimodal.go
// 提供: 多模态消息构造 / ContentPart 处理 / 图片(Base64/URL)/音频/视频 支持

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type { MultimodalContentPart, MultimodalMessage } from '@shared/types'
import { randomUUID } from 'crypto'

// MIME 类型映射
const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
}

export class MultimodalService {
  /**
   * 从文件创建多模态内容
   */
  async fromFile(filePath: string, text?: string): Promise<MultimodalMessage> {
    const ext = extname(filePath).toLowerCase()
    const mime = MIME_MAP[ext] || 'application/octet-stream'

    // 文件大小检查 (50MB 上限)
    const stat = await import('fs/promises').then(fs => fs.stat(filePath))
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    if (stat.size > MAX_FILE_SIZE) {
      throw new Error(`文件过大 (${(stat.size / 1024 / 1024).toFixed(1)}MB)，最大支持 50MB`)
    }

    const data = await readFile(filePath)
    const base64Data = data.toString('base64')

    const parts: MultimodalContentPart[] = []

    if (text) {
      parts.push({ type: 'text', text })
    }

    if (mime.startsWith('image/')) {
      parts.push({
        type: 'image_b64',
        data: base64Data,
        mime,
        detail: 'auto',
      })
    } else if (mime.startsWith('audio/')) {
      parts.push({
        type: 'audio',
        data: base64Data,
        mime,
      })
    } else if (mime.startsWith('video/')) {
      parts.push({
        type: 'video',
        data: base64Data,
        mime,
      })
    } else {
      // 非多媒体文件，作为文本读取
      parts.push({ type: 'text', text: `${text ?? ''}\n\n文件内容:\n${data.toString('utf-8')}` })
    }

    return {
      id: randomUUID(),
      role: 'user',
      contentParts: parts,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * 创建图片 URL 消息
   */
  createImageURLMessage(text: string, imageURL: string, detail: 'low' | 'high' | 'auto' = 'auto'): MultimodalMessage {
    return {
      id: randomUUID(),
      role: 'user',
      contentParts: [
        { type: 'text', text },
        { type: 'image_url', url: imageURL, detail },
      ],
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * 创建 Base64 图片消息
   */
  createImageB64Message(text: string, imageBase64: string, mimeType: string, detail: 'low' | 'high' | 'auto' = 'auto'): MultimodalMessage {
    return {
      id: randomUUID(),
      role: 'user',
      contentParts: [
        { type: 'text', text },
        { type: 'image_b64', data: imageBase64, mime: mimeType, detail },
      ],
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * 创建音频消息
   */
  createAudioMessage(text: string, audioBase64: string, mimeType: string): MultimodalMessage {
    return {
      id: randomUUID(),
      role: 'user',
      contentParts: [
        { type: 'text', text },
        { type: 'audio', data: audioBase64, mime: mimeType },
      ],
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * 创建视频消息
   */
  createVideoMessage(text: string, videoBase64: string, mimeType: string): MultimodalMessage {
    return {
      id: randomUUID(),
      role: 'user',
      contentParts: [
        { type: 'text', text },
        { type: 'video', data: videoBase64, mime: mimeType },
      ],
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * 创建多模态用户消息（自由组合 ContentPart）
   */
  createUserMessage(parts: MultimodalContentPart[]): MultimodalMessage {
    return {
      id: randomUUID(),
      role: 'user',
      contentParts: parts,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * 检查消息是否包含多模态内容
   */
  hasMultimodal(msg: MultimodalMessage): boolean {
    return msg.contentParts.some(p => p.type !== 'text')
  }

  /**
   * 提取消息中的纯文本内容
   */
  extractText(msg: MultimodalMessage): string {
    return msg.contentParts
      .filter(p => p.type === 'text')
      .map(p => p.text || '')
      .join('\n')
  }

  /**
   * 提取消息中的图片
   */
  extractImages(msg: MultimodalMessage): MultimodalContentPart[] {
    return msg.contentParts.filter(p => p.type === 'image_url' || p.type === 'image_b64')
  }

  /**
   * 提取消息中的音频
   */
  extractAudio(msg: MultimodalMessage): MultimodalContentPart[] {
    return msg.contentParts.filter(p => p.type === 'audio')
  }

  /**
   * 提取消息中的视频
   */
  extractVideo(msg: MultimodalMessage): MultimodalContentPart[] {
    return msg.contentParts.filter(p => p.type === 'video')
  }

  /**
   * 将多模态消息转换为 LLM API 格式
   * 返回 OpenAI 兼容的 content 数组
   */
  toLLMContent(msg: MultimodalMessage): Array<Record<string, unknown>> {
    return msg.contentParts.map(p => {
      switch (p.type) {
        case 'text':
          return { type: 'text', text: p.text }
        case 'image_url':
          return {
            type: 'image_url',
            image_url: { url: p.url, detail: p.detail ?? 'auto' },
          }
        case 'image_b64':
          return {
            type: 'image_url',
            image_url: {
              url: `data:${p.mime};base64,${p.data}`,
              detail: p.detail ?? 'auto',
            },
          }
        case 'audio':
          return {
            type: 'input_audio',
            input_audio: { data: p.data, format: p.mime?.split('/')[1] ?? 'wav' },
          }
        case 'video':
          return {
            type: 'video_url',
            video_url: { url: `data:${p.mime};base64,${p.data}` },
          }
        default:
          return { type: 'text', text: p.text ?? '' }
      }
    })
  }

  /**
   * 获取支持的 MIME 类型列表
   */
  getSupportedMimeTypes(): { images: string[]; audio: string[]; video: string[] } {
    return {
      images: Object.entries(MIME_MAP)
        .filter(([_, m]) => m.startsWith('image/'))
        .map(([ext, _]) => ext),
      audio: Object.entries(MIME_MAP)
        .filter(([_, m]) => m.startsWith('audio/'))
        .map(([ext, _]) => ext),
      video: Object.entries(MIME_MAP)
        .filter(([_, m]) => m.startsWith('video/'))
        .map(([ext, _]) => ext),
    }
  }

  /** 生命周期停止方法：无操作 */
  stop(): void { /* no-op */ }
}
