// 初始数据加载编排器：按依赖顺序从主进程拉取并写入各 slice
import { useConfigStore } from './configStore'
import { useSkillStore } from './skillStore'
import { useAutomationStore } from './automationStore'
import { useViewStore } from './viewStore'
import type { SkillScanResult } from '@shared/types'
import type { Lang } from '../i18n'

export async function loadInitialData(): Promise<void> {
  const configStore = useConfigStore.getState()
  const skillStore = useSkillStore.getState()
  const automationStore = useAutomationStore.getState()
  const viewStore = useViewStore.getState()

  try {
    const config = await window.aela?.config?.get?.()
    if (!config) {
      console.error('[loadInitialData] config.get() returned null/undefined')
      return
    }
    configStore.setAppConfig(config)

    // 应用主题 / 语言 / 字体大小（持久化由 setter 内部完成）
    configStore.setTheme(config.theme || 'dark')
    configStore.setLanguage((config.language as Lang) || 'zh')
    configStore.setFontSize(config.fontSize || 14)

    // 加载模型列表
    const models = await window.aela.model.list()
    configStore.setModelList(models)

    // 加载默认模型
    if (config.defaultModelId) {
      const defaultModel = models.find((m) => m.id === config.defaultModelId)
      if (defaultModel) configStore.setCurrentModelConfig(defaultModel)
    } else if (models.length > 0) {
      configStore.setCurrentModelConfig(models[0])
    }

    // 加载 Skills（用 reload 确保扫描完成，避免初始 fire-and-forget 尚未完成时拿到空数组）
    try {
      const skillData: SkillScanResult = await window.aela.skill.reload()
      skillStore.setSkills({
        skills: skillData.skills,
        scanPaths: skillData.scanPaths,
        scanLog: skillData.scanLog,
        dedupConflicts: skillData.dedupConflicts,
      })
    } catch (err) {
      console.error('Failed to load skills:', err)
    }

    // 加载自动化任务
    try {
      const tasks = await window.aela.automation.list()
      automationStore.setAutomations(tasks)
    } catch (err) {
      console.error('Failed to load automations:', err)
    }
  } catch (err) {
    console.error('Failed to load initial data:', err)
    // 即使出错也应用默认深色主题
    const root = document.documentElement
    root.classList.remove('dark', 'light')
    root.classList.add('dark')
    // 触发 UI 错误条
    viewStore.setError(err instanceof Error ? err.message : String(err))
  }
}