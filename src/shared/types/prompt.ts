export interface PromptRegistryEntry {
  name: string
  description: string
}

export interface FewShotExample {
  input: string
  output: string
  metadata?: Record<string, unknown>
}

export interface FewShotConfig {
  baseTemplate?: string
  exampleFormat?: string
  prefix?: string
  suffix?: string
  maxExamples?: number
  selector?: 'similarity' | 'length' | 'random'
}

export interface PromptMessageTemplates {
  system: string
  user: string
  assistant: string
}

export interface FewShotExampleWithWeight extends FewShotExample {
  weight: number
  positiveFeedback: number
  negativeFeedback: number
  lastUsedAt?: string
  useCount: number
}

export interface FewShotWeightConfig {
  initialWeight: number
  positiveBoost: number
  negativePenalty: number
  minWeight: number
  maxWeight: number
  decayFactor: number
}
