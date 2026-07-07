// AELA — 本地 Hash Embedding 实现
// 基于 token hash 的轻量级文本向量化
// 无需外部 API，完全离线，适用于降级场景
//
// 算法：
// 1. 分词（按空格和标点）
// 2. 每个 token 做 hash 映射到向量维度
// 3. 累加并 L2 归一化

export class HashEmbedding {
  private dimensions: number

  constructor(dimensions: number = 128) {
    this.dimensions = dimensions
  }

  /**
   * 将文本转换为固定维度的向量
   */
  embed(text: string): number[] {
    const vector = new Array(this.dimensions).fill(0)
    const tokens = text.toLowerCase().split(/[\s\p{P}]+/u).filter(t => t.length > 0)

    if (tokens.length === 0) {
      // 空文本返回零向量（避免 NaN）
      return vector
    }

    for (const token of tokens) {
      // 简单 hash：字符编码加权求和
      let hash = 0
      for (let i = 0; i < token.length; i++) {
        hash = ((hash << 5) - hash + token.charCodeAt(i)) | 0
      }
      const idx = Math.abs(hash) % this.dimensions
      vector[idx] += 1
    }

    // L2 归一化
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vector[i] /= norm
      }
    }

    return vector
  }

  /**
   * 获取向量维度
   */
  getDimensions(): number {
    return this.dimensions
  }
}
