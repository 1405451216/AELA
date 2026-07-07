/**
 * CheckpointService 单元测试
 *
 * 覆盖: 创建检查点 / 回滚 / 会话管理 / 自动清理 / 统计
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CheckpointService } from '../../src/main/services/CheckpointService'

// mock electron app.getPath
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => join(tmpdir(), 'aela-test-checkpoints')),
  },
}))

describe('CheckpointService', () => {
  let service: CheckpointService
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'aela-cp-'))
    service = new CheckpointService(tempDir)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  // ===== 创建检查点 =====

  describe('创建检查点', () => {
    it('应为存在的文件创建检查点', async () => {
      const filePath = join(tempDir, 'test.txt')
      await writeFile(filePath, 'original content', 'utf8')

      const id = await service.createCheckpoint('session-1', ['test.txt'], '测试检查点')
      expect(id).toBeDefined()
      expect(typeof id).toBe('string')

      const cp = service.getCheckpoint(id)
      expect(cp).not.toBeNull()
      expect(cp!.files.length).toBe(1)
      expect(cp!.files[0].relativePath).toBe('test.txt')
      expect(cp!.files[0].beforeContent).toBe('original content')
    })

    it('应为新文件创建检查点（beforeContent = null）', async () => {
      const id = await service.createCheckpoint('session-1', ['new-file.ts'], '新文件')
      const cp = service.getCheckpoint(id)
      expect(cp).not.toBeNull()
      expect(cp!.files[0].beforeContent).toBeNull()
    })

    it('应支持多个文件', async () => {
      const f1 = join(tempDir, 'a.txt')
      const f2 = join(tempDir, 'b.txt')
      await writeFile(f1, 'content A', 'utf8')
      await writeFile(f2, 'content B', 'utf8')

      const id = await service.createCheckpoint('session-1', ['a.txt', 'b.txt'])
      const cp = service.getCheckpoint(id)
      expect(cp!.files.length).toBe(2)
    })

    it('默认描述应为 AI 修改前快照', async () => {
      const id = await service.createCheckpoint('session-1', [])
      const cp = service.getCheckpoint(id)
      expect(cp!.description).toBe('AI 修改前快照')
    })
  })

  // ===== 回滚 =====

  describe('回滚检查点', () => {
    it('应恢复文件到修改前内容', async () => {
      const filePath = join(tempDir, 'modifiable.txt')
      await writeFile(filePath, 'original', 'utf8')

      const id = await service.createCheckpoint('session-1', ['modifiable.txt'])

      // 修改文件
      await writeFile(filePath, 'modified content', 'utf8')
      expect(await readFile(filePath, 'utf8')).toBe('modified content')

      // 回滚
      const restored = await service.restoreCheckpoint(id)
      expect(restored).toBe(1)
      expect(await readFile(filePath, 'utf8')).toBe('original')
    })

    it('应删除新建的文件（beforeContent = null）', async () => {
      const filePath = join(tempDir, 'created.txt')

      // 创建检查点（文件不存在）
      const id = await service.createCheckpoint('session-1', ['created.txt'])

      // 创建文件（模拟 AI 创建）
      await writeFile(filePath, 'AI created this', 'utf8')
      expect(await readFile(filePath, 'utf8')).toBe('AI created this')

      // 回滚应删除文件
      const restored = await service.restoreCheckpoint(id)
      expect(restored).toBe(1)

      // 文件应不存在
      try {
        await readFile(filePath, 'utf8')
        // 如果成功读取，说明文件没被删除
        expect(true).toBe(false) // 应该走到 catch
      } catch {
        // 文件不存在 — 符合预期
        expect(true).toBe(true)
      }
    })

    it('不存在的检查点应抛出错误', async () => {
      await expect(service.restoreCheckpoint('nonexistent-id')).rejects.toThrow('Checkpoint not found')
    })

    it('应支持多个文件回滚', async () => {
      const f1 = join(tempDir, 'multi-a.txt')
      const f2 = join(tempDir, 'multi-b.txt')
      await writeFile(f1, 'A-original', 'utf8')
      await writeFile(f2, 'B-original', 'utf8')

      const id = await service.createCheckpoint('session-1', ['multi-a.txt', 'multi-b.txt'])

      await writeFile(f1, 'A-modified', 'utf8')
      await writeFile(f2, 'B-modified', 'utf8')

      const restored = await service.restoreCheckpoint(id)
      expect(restored).toBe(2)
      expect(await readFile(f1, 'utf8')).toBe('A-original')
      expect(await readFile(f2, 'utf8')).toBe('B-original')
    })
  })

  // ===== 会话管理 =====

  describe('会话管理', () => {
    it('应按会话分组获取检查点', async () => {
      await service.createCheckpoint('session-a', [], 'A1')
      await service.createCheckpoint('session-a', [], 'A2')
      await service.createCheckpoint('session-b', [], 'B1')

      const checkpointsA = service.getSessionCheckpoints('session-a')
      const checkpointsB = service.getSessionCheckpoints('session-b')

      expect(checkpointsA.length).toBe(2)
      expect(checkpointsB.length).toBe(1)
    })

    it('空会话应返回空数组', () => {
      expect(service.getSessionCheckpoints('nonexistent')).toEqual([])
    })

    it('检查点摘要应包含正确信息', async () => {
      const id = await service.createCheckpoint('session-1', [], '摘要测试')
      const snapshots = service.getSessionCheckpoints('session-1')
      expect(snapshots.length).toBe(1)
      expect(snapshots[0].id).toBe(id)
      expect(snapshots[0].description).toBe('摘要测试')
      expect(snapshots[0].sessionId).toBe('session-1')
    })
  })

  // ===== 删除检查点 =====

  describe('删除检查点', () => {
    it('应成功删除存在的检查点', async () => {
      const id = await service.createCheckpoint('session-1', [])
      expect(service.deleteCheckpoint(id)).toBe(true)
      expect(service.getCheckpoint(id)).toBeNull()
    })

    it('删除不存在的检查点应返回 false', () => {
      expect(service.deleteCheckpoint('nonexistent')).toBe(false)
    })

    it('删除后应从会话列表中移除', async () => {
      const id = await service.createCheckpoint('session-1', [])
      expect(service.getSessionCheckpoints('session-1').length).toBe(1)

      service.deleteCheckpoint(id)
      expect(service.getSessionCheckpoints('session-1').length).toBe(0)
    })
  })

  // ===== 清除会话 =====

  describe('清除会话检查点', () => {
    it('应清除会话的所有检查点', async () => {
      await service.createCheckpoint('session-1', [], 'A')
      await service.createCheckpoint('session-1', [], 'B')
      await service.createCheckpoint('session-2', [], 'C')

      service.clearSessionCheckpoints('session-1')

      expect(service.getSessionCheckpoints('session-1').length).toBe(0)
      expect(service.getSessionCheckpoints('session-2').length).toBe(1)
    })
  })

  // ===== 自动清理 =====

  describe('自动清理', () => {
    it('超出限制时应移除最旧的检查点', async () => {
      const ids: string[] = []
      for (let i = 0; i < 25; i++) {
        const id = await service.createCheckpoint('session-1', [], `CP-${i}`)
        ids.push(id)
      }

      // 默认限制 20，应只保留最新的 20
      const remaining = service.getSessionCheckpoints('session-1')
      expect(remaining.length).toBeLessThanOrEqual(20)

      // 最旧的几个应已被移除
      for (let i = 0; i < 5; i++) {
        expect(service.getCheckpoint(ids[i])).toBeNull()
      }
    })
  })

  // ===== 统计 =====

  describe('统计信息', () => {
    it('应返回正确的统计信息', async () => {
      await service.createCheckpoint('s1', ['f1.txt', 'f2.txt'])
      await service.createCheckpoint('s1', ['f3.txt'])
      await service.createCheckpoint('s2', ['f4.txt'])

      const stats = service.getStats()
      expect(stats.totalCheckpoints).toBe(3)
      expect(stats.totalSessions).toBe(2)
      expect(stats.totalFiles).toBe(4)
    })

    it('空服务应返回零统计', () => {
      const stats = service.getStats()
      expect(stats.totalCheckpoints).toBe(0)
      expect(stats.totalSessions).toBe(0)
      expect(stats.totalFiles).toBe(0)
    })
  })

  // ===== 设置根目录 =====

  describe('设置根目录', () => {
    it('setRootDir 应更新根目录', async () => {
      const newDir = await mkdtemp(join(tmpdir(), 'aela-cp-new-'))
      service.setRootDir(newDir)

      const filePath = join(newDir, 'new-root.txt')
      await writeFile(filePath, 'new root content', 'utf8')

      const id = await service.createCheckpoint('session-1', ['new-root.txt'])
      const cp = service.getCheckpoint(id)
      expect(cp!.files[0].beforeContent).toBe('new root content')

      await rm(newDir, { recursive: true, force: true })
    })
  })

  // ===== 生命周期 =====

  describe('生命周期', () => {
    it('stop 不应抛出异常', () => {
      expect(() => service.stop()).not.toThrow()
    })
  })
})
