declare module 'node-llama-cpp' {
  export class Llama {
    constructor(options: { modelPath: string; contextSize: number; gpuLayers: number })

    static load(options: { modelPath: string; contextSize: number; gpuLayers: number }): Promise<Llama>

    createContext(options: { threads: number }): Promise<{
      dispose: () => void
    }>

    dispose(): void
  }

  export class LlamaChatSession {
    constructor(options: { context: { dispose: () => void } })

    static create(options: { context: { dispose: () => void } }): Promise<LlamaChatSession>

    prompt(text: string, options: {
      systemPrompt?: string
      onChunk?: (chunk: string) => void
    }): Promise<string>

    dispose(): void
  }
}
