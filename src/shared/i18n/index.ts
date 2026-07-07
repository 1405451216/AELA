// 共享 i18n 核心模块入口（桶文件）
// 对外导出与旧版 i18n.ts 完全一致的 8 个符号，调用方无需改动

export { Lang, dict } from './dict'
export { setLang, getLang, subscribeLang, getLangSnapshot } from './lang'
export { translate, translateF } from './translate'
