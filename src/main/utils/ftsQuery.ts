/**
 * FTS5 全文搜索查询预处理与转义工具
 *
 * 共享给 SessionStore 和 SqliteMemoryStore 使用，
 * 确保 FTS5 MATCH 表达式安全且支持 CJK 分词。
 */

/**
 * 预处理文本以支持 CJK 分词
 *
 * unicode61 分词器默认将连续的 CJK 字符视为一个 token。
 * 通过在 CJK 字符之间插入空格，使每个中文字符成为独立 token。
 */
export function preprocessForFTS(text: string): string {
  if (!text) return ''
  return text.replace(/([\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af])/g, ' $1 ')
}

/**
 * 将用户查询转义为安全的 FTS5 MATCH 表达式
 *
 * FTS5 MATCH 语法中，双引号包裹的是「字符串字面量」(phrase)，
 * 不会被解释为 FTS5 操作符（AND, OR, NOT, NEAR, *, ^, : 等）。
 * 将每个 token 用双引号包裹，并将 token 内部的双引号替换为空格。
 */
export function sanitizeFTSQuery(preprocessedQuery: string): string {
  const tokens = preprocessedQuery
    .split(/[\s]+/)
    .filter(t => t.length > 0)
    .map(t => '"' + t.replace(/"/g, ' ') + '"')
  return tokens.join(' ')
}

/**
 * 将原始用户查询转换为安全的 FTS5 MATCH 表达式（一站式）
 *
 * 步骤: 预处理 CJK → 转义特殊字符
 * 如果结果为空则返回 null，调用方可据此跳过查询。
 */
export function buildSafeFTSMatch(query: string): string | null {
  const preprocessed = preprocessForFTS(query).trim()
  if (!preprocessed) return null
  const safe = sanitizeFTSQuery(preprocessed)
  return safe || null
}

/**
 * 转义 SQL LIKE 查询中的通配符（% 和 _）
 *
 * 在参数化查询中使用: WHERE content LIKE ? ESCAPE '\'
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&')
}
