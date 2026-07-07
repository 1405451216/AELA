/**
 * ToolRecommender 单元测试
 *
 * 覆盖: 工具索引 / 推荐算法 / 评分因子 / 工具链协同
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ToolRecommender } from '../../src/main/services/ToolRecommender'
import { TaskRouter } from '../../src/main/services/TaskRouter'
import type { ToolLearningService } from '../../src/main/services/ToolLearningService'

// Mock 工具列表
const MOCK_TOOLS = [
  { name: 'read_file', description: '读取指定路径的文件内容。支持文本文件、代码文件等。' },
  { name: 'write_file', description: '写入内容到指定文件。如果文件不存在则创建，如果存在则覆盖。' },
  { name: 'search_code', description: '在工作区中搜索代码内容。支持正则表达式和文件扩展名过滤。' },
  { name: 'review_code', description: '对指定的源代码文件进行自动化代码审查。结合 16 条静态规则（安全/性能/风格/Bug）和 LLM 增强 review，生成结构化审查报告含评分和建议。' },
  { name: 'generate_test', description: '为指定的源代码文件自动生成单元测试。分析函数和类，使用 LLM 生成测试代码。支持 Jest、Vitest、Mocha 等框架。' },
  { name: 'generate_wiki', description: '扫描代码仓库结构，自动生成项目文档 Wiki。提取目录树、README、package.json 等信息，生成结构化文档。' },
  { name: 'execute_command', description: '在工作区目录下执行 Shell 命令。支持所有 Shell 命令，自动处理工作目录和环境变量。' },
  { name: 'http_fetch', description: '发起 HTTP/HTTPS 请求，获取网页内容或 API 响应。支持 GET/POST/PUT/DELETE 方法。' },
]

// Mock ToolLearningService
function createMockToolLearningService(): ToolLearningService {
  return {
    getToolStats: vi.fn((toolName?: string) => {
      if (toolName === 'review_code') {
        return [{ toolName: 'review_code', totalCalls: 10, successCount: 9, failureCount: 1, successRate: 0.9, avgResultLength: 500 }]
      }
      if (toolName === 'read_file') {
        return [{ toolName: 'read_file', totalCalls: 50, successCount: 48, failureCount: 2, successRate: 0.96, avgResultLength: 1000 }]
      }
      return []
    }),
  } as unknown as ToolLearningService
}

describe('ToolRecommender', () => {
  let taskRouter: TaskRouter
  let recommender: ToolRecommender

  beforeEach(() => {
    taskRouter = new TaskRouter()
    recommender = new ToolRecommender(taskRouter)
    recommender.indexTools(MOCK_TOOLS)
  })

  // ===== 工具索引 =====

  describe('工具索引', () => {
    it('正确索引所有工具', () => {
      expect(recommender.getIndexedCount()).toBe(MOCK_TOOLS.length)
    })

    it('空索引时计数为 0', () => {
      const emptyRecommender = new ToolRecommender(new TaskRouter())
      expect(emptyRecommender.getIndexedCount()).toBe(0)
    })
  })

  // ===== 基本推荐 =====

  describe('基本推荐', () => {
    it('返回推荐结果', () => {
      const recs = recommender.recommendTools('帮我审查代码')
      expect(recs.length).toBeGreaterThan(0)
    })

    it('按分数降序排列', () => {
      const recs = recommender.recommendTools('写测试')
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1].score).toBeGreaterThanOrEqual(recs[i].score)
      }
    })

    it('每个推荐都有原因', () => {
      const recs = recommender.recommendTools('review code')
      for (const rec of recs) {
        expect(rec.reason).toBeTruthy()
        expect(rec.reason.length).toBeGreaterThan(0)
      }
    })
  })

  // ===== 任务类型匹配 =====

  describe('任务类型匹配', () => {
    it('代码审查任务推荐 review_code', () => {
      const recs = recommender.recommendTools('review my code')
      const reviewRec = recs.find(r => r.toolName === 'review_code')
      expect(reviewRec).toBeDefined()
      expect(reviewRec!.score).toBeGreaterThan(0.5)
    })

    it('测试任务推荐 generate_test', () => {
      const recs = recommender.recommendTools('generate unit tests')
      const testRec = recs.find(r => r.toolName === 'generate_test')
      expect(testRec).toBeDefined()
    })

    it('文档任务推荐 generate_wiki', () => {
      const recs = recommender.recommendTools('generate documentation')
      const docRec = recs.find(r => r.toolName === 'generate_wiki')
      expect(docRec).toBeDefined()
    })
  })

  // ===== Top-K 限制 =====

  describe('Top-K 限制', () => {
    it('返回结果不超过 topK', () => {
      const recs = recommender.recommendTools('code', 3)
      expect(recs.length).toBeLessThanOrEqual(3)
    })

    it('默认 topK 为 5', () => {
      const recs = recommender.recommendTools('code review testing documentation')
      expect(recs.length).toBeLessThanOrEqual(5)
    })
  })

  // ===== 历史学习 =====

  describe('历史学习', () => {
    it('设置 ToolLearningService', () => {
      const mockService = createMockToolLearningService()
      recommender.setToolLearningService(mockService)
      // 验证设置成功（内部状态，通过行为验证）
    })

    it('历史高成功率工具获得更高分', () => {
      const mockService = createMockToolLearningService()
      recommender.setToolLearningService(mockService)

      const recs = recommender.recommendTools('review code quality')
      const reviewRec = recs.find(r => r.toolName === 'review_code')
      // review_code 有 90% 成功率，应该获得历史加分
      expect(reviewRec).toBeDefined()
      expect(reviewRec!.metadata.historyScore).toBeGreaterThan(0.8)
    })
  })

  // ===== 评分元数据 =====

  describe('评分元数据', () => {
    it('包含所有评分维度', () => {
      const recs = recommender.recommendTools('code review')
      for (const rec of recs) {
        expect(rec.metadata).toHaveProperty('semanticScore')
        expect(rec.metadata).toHaveProperty('taskTypeScore')
        expect(rec.metadata).toHaveProperty('historyScore')
        expect(rec.metadata).toHaveProperty('chainScore')
      }
    })

    it('分数在 0-1 范围内', () => {
      const recs = recommender.recommendTools('code review testing')
      for (const rec of recs) {
        expect(rec.score).toBeGreaterThanOrEqual(0)
        expect(rec.score).toBeLessThanOrEqual(1)
      }
    })
  })

  // ===== 综合场景 =====

  describe('综合场景', () => {
    it('debug 任务推荐 execute_command', () => {
      const recs = recommender.recommendTools('fix the bug in production')
      const execRec = recs.find(r => r.toolName === 'execute_command')
      expect(execRec).toBeDefined()
    })

    it('git 任务推荐 execute_command', () => {
      const recs = recommender.recommendTools('git commit and push')
      const execRec = recs.find(r => r.toolName === 'execute_command')
      expect(execRec).toBeDefined()
    })

    it('research 任务推荐 http_fetch', () => {
      const recs = recommender.recommendTools('search for React patterns')
      const fetchRec = recs.find(r => r.toolName === 'http_fetch')
      expect(fetchRec).toBeDefined()
    })
  })
})
