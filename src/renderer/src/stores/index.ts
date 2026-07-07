// 全局应用状态 - 切片架构
// 单一 store 拆分为多个语义相关的 slice,各自独立订阅以减少不必要重渲染。
// 通过 ./index.ts 的 facade 提供向后兼容的 useAppStore() 入口。

export { useViewStore } from './viewStore'
export { useConfigStore } from './configStore'
export { useSkillStore } from './skillStore'
export { useAutomationStore } from './automationStore'
export { useMessagesStore } from './messagesStore'
export { loadInitialData } from './loadInitial'