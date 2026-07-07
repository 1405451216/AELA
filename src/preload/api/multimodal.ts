// 多模态与截图 API（multimodal, screenshot）
import { invoke, IPC_CHANNELS } from './_shared'
import type {
  MultimodalMessage,
  ScreenshotAnalysis,
  ScreenshotAnalysisRequest,
} from '@shared/types'

export const multimodalApi = {
  fromFile: (filePath: string, text?: string): Promise<MultimodalMessage> => invoke(IPC_CHANNELS.MULTIMODAL_FROM_FILE, filePath, text),
  createImageURL: (text: string, imageURL: string, detail?: 'low' | 'high' | 'auto'): Promise<MultimodalMessage> => invoke(IPC_CHANNELS.MULTIMODAL_CREATE_IMAGE_URL, text, imageURL, detail),
  createImageB64: (text: string, imageBase64: string, mimeType: string, detail?: 'low' | 'high' | 'auto'): Promise<MultimodalMessage> => invoke(IPC_CHANNELS.MULTIMODAL_CREATE_IMAGE_B64, text, imageBase64, mimeType, detail),
  createAudio: (text: string, audioBase64: string, mimeType: string): Promise<MultimodalMessage> => invoke(IPC_CHANNELS.MULTIMODAL_CREATE_AUDIO, text, audioBase64, mimeType),
  createVideo: (text: string, videoBase64: string, mimeType: string): Promise<MultimodalMessage> => invoke(IPC_CHANNELS.MULTIMODAL_CREATE_VIDEO, text, videoBase64, mimeType),
  toLLMContent: (msg: MultimodalMessage): Promise<Array<Record<string, unknown>>> => invoke(IPC_CHANNELS.MULTIMODAL_TO_LLM_CONTENT, msg),
  supportedMime: (): Promise<{ images: string[]; audio: string[]; video: string[] }> => invoke(IPC_CHANNELS.MULTIMODAL_SUPPORTED_MIME),
}

export const screenshotApi = {
  analyze: (request: ScreenshotAnalysisRequest): Promise<ScreenshotAnalysis> => invoke(IPC_CHANNELS.SCREENSHOT_ANALYZE, request),
  getResult: (id: string): Promise<ScreenshotAnalysis | null> => invoke(IPC_CHANNELS.SCREENSHOT_GET_RESULT, id),
  listResults: (): Promise<ScreenshotAnalysis[]> => invoke(IPC_CHANNELS.SCREENSHOT_LIST_RESULTS),
}
