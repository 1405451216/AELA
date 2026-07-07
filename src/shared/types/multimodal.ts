export interface MultimodalContentPart {
  type: 'text' | 'image_url' | 'image_b64' | 'audio' | 'video'
  text?: string
  url?: string
  data?: string
  mime?: string
  detail?: 'low' | 'high' | 'auto'
}

export interface MultimodalMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  contentParts: MultimodalContentPart[]
  createdAt: string
}
