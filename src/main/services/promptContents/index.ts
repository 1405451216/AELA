// 提示词内容常量桶文件（T6 拆分）
// 对外导出与旧版 promptContents.ts 完全一致的 13 个常量，PromptBuilder 等消费者无需改动

export { promptBase } from './base'
export {
  promptCodingDefault,
  promptCodingConcise,
  promptCodingSafetyFirst,
  promptCodeReviewer,
  promptCodingPairProgrammer,
  promptCodingMentorCoach,
} from './coding'
export {
  promptDailyDefault,
  promptDailyConcise,
  promptDailySafetyFirst,
  promptDailyCodeReviewer,
  promptDailyPairProgrammer,
  promptDailyMentorCoach,
} from './daily'
