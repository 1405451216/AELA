// 模型配置 API
import { invoke, IPC_CHANNELS } from './_shared'
import type { ModelConfig } from '@shared/types'

export const modelApi = {
  list: (): Promise<ModelConfig[]> => invoke(IPC_CHANNELS.MODEL_LIST),
  add: (model: Omit<ModelConfig, 'id' | 'createdAt'>): Promise<ModelConfig> =>
    invoke(IPC_CHANNELS.MODEL_ADD, model),
  update: (id: string, partial: Partial<ModelConfig>): Promise<ModelConfig | undefined> =>
    invoke(IPC_CHANNELS.MODEL_UPDATE, id, partial),
  delete: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.MODEL_DELETE, id),
  setDefault: (id: string): Promise<boolean> => invoke(IPC_CHANNELS.MODEL_SET_DEFAULT, id),
  test: (config: ModelConfig): Promise<{ success: boolean; message: string }> =>
    invoke(IPC_CHANNELS.AGENT_TEST_MODEL, config),
}
