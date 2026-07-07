/**
 * TaskRouter 单元测试
 *
 * 覆盖: 任务类型检测 / 关键词匹配 / 置信度 / 工具映射
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TaskRouter, TASK_TYPE_LABELS, type TaskType } from '../../src/main/services/TaskRouter'

describe('TaskRouter', () => {
  let router: TaskRouter

  beforeEach(() => {
    router = new TaskRouter()
  })

  // ===== 关键词精确匹配 =====

  describe('关键词精确匹配', () => {
    it('识别代码审查任务', () => {
      const result = router.detectTask('帮我 review 代码')
      expect(result.taskType).toBe('code_review')
      expect(result.confidence).toBeGreaterThanOrEqual(0.9)
      expect(result.recommendedTools).toContain('review_code')
    })

    it('识别测试生成任务', () => {
      const result = router.detectTask('帮我写个测试')
      expect(result.taskType).toBe('testing')
      expect(result.recommendedTools).toContain('generate_test')
    })

    it('识别文档生成任务', () => {
      const result = router.detectTask('生成 API 文档')
      expect(result.taskType).toBe('documentation')
      expect(result.recommendedTools).toContain('generate_wiki')
    })

    it('识别 Git 任务', () => {
      const result = router.detectTask('提交代码到 git')
      expect(result.taskType).toBe('git')
      expect(result.recommendedTools).toContain('execute_command')
    })

    it('识别调试任务', () => {
      const result = router.detectTask('程序报错了，帮我调试')
      expect(result.taskType).toBe('debugging')
      expect(result.recommendedTools).toContain('execute_command')
    })

    it('识别搜索调研任务', () => {
      const result = router.detectTask('帮我搜索一下 React 最佳实践')
      expect(result.taskType).toBe('research')
      expect(result.recommendedTools).toContain('http_fetch')
    })

    it('英文关键词匹配', () => {
      const result = router.detectTask('please review my code')
      expect(result.taskType).toBe('code_review')
      expect(result.recommendedTools).toContain('read_file')
    })
  })

  // ===== 未识别任务类型 =====

  describe('未识别任务', () => {
    it('返回 general 类型', () => {
      const result = router.detectTask('今天天气怎么样')
      expect(result.taskType).toBe('general')
      expect(result.confidence).toBeLessThan(0.6)
    })

    it('返回通用工具', () => {
      const result = router.detectTask('随便说点什么')
      expect(result.recommendedTools.length).toBeGreaterThan(0)
    })
  })

  // ===== 任务类型标签 =====

  describe('任务类型标签', () => {
    it('返回中文标签', () => {
      expect(TASK_TYPE_LABELS.code_review).toBe('代码审查')
      expect(TASK_TYPE_LABELS.testing).toBe('测试生成')
      expect(TASK_TYPE_LABELS.documentation).toBe('文档生成')
      expect(TASK_TYPE_LABELS.refactoring).toBe('代码重构')
      expect(TASK_TYPE_LABELS.debugging).toBe('调试排错')
      expect(TASK_TYPE_LABELS.git).toBe('Git 操作')
      expect(TASK_TYPE_LABELS.research).toBe('搜索调研')
      expect(TASK_TYPE_LABELS.general).toBe('通用任务')
    })

    it('getLabel 返回正确标签', () => {
      expect(router.getLabel('code_review')).toBe('代码审查')
      expect(router.getLabel('testing')).toBe('测试生成')
    })
  })

  // ===== 支持的任务类型 =====

  describe('支持的任务类型', () => {
    it('返回所有预定义类型', () => {
      const types = router.getSupportedTaskTypes()
      expect(types.length).toBeGreaterThanOrEqual(7)
      expect(types).toContain('code_review')
      expect(types).toContain('testing')
      expect(types).toContain('documentation')
    })
  })

  // ===== 工具推荐 =====

  describe('工具推荐', () => {
    it('code_review 推荐 review_code', () => {
      const result = router.detectTask('审查代码')
      expect(result.recommendedTools).toContain('review_code')
    })

    it('testing 推荐 generate_test', () => {
      const result = router.detectTask('生成测试')
      expect(result.recommendedTools).toContain('generate_test')
    })

    it('每个任务类型都有推荐工具', () => {
      const inputs = [
        'review code',
        'write test',
        'generate docs',
        'refactor this',
        'debug error',
        'git commit',
        'search for',
      ]
      for (const input of inputs) {
        const result = router.detectTask(input)
        expect(result.recommendedTools.length).toBeGreaterThan(0)
      }
    })
  })
})
