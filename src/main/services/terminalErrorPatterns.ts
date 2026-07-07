export interface TerminalErrorPattern {
  type: string
  description: string
  regex: RegExp
}

export const TERMINAL_ERROR_PATTERNS: TerminalErrorPattern[] = [
  {
    type: 'TypeScript',
    description: 'TypeScript 编译错误',
    regex: /\w+\.tsx?\(\d+,\d+\):\s+error\s+TS\d+/i,
  },
  {
    type: 'ESLint',
    description: 'ESLint 错误',
    regex: /error\s+.{1,50}\s+(?:is not defined|is assigned a value but never used|Unexpected|Expected|Missing|no-|prefer-|import\/)/i,
  },
  {
    type: 'Python',
    description: 'Python 运行时错误',
    regex: /(?:Traceback|SyntaxError|NameError|TypeError|ValueError|AttributeError|ImportError|ModuleNotFoundError|IndentationError|KeyIndexError)/i,
  },
  {
    type: 'Go',
    description: 'Go 编译错误',
    regex: /\w+\.go:\d+:\d+:.+?:\s*.+/,
  },
  {
    type: 'Rust',
    description: 'Rust 编译错误',
    regex: /error\[?E\d{4}\]?:/i,
  },
  {
    type: 'Java',
    description: 'Java 编译错误',
    regex: /\w+\.java:\d+:\s*(?:error|warning):/i,
  },
  {
    type: 'BuildError',
    description: '构建工具错误',
    regex: /(?:npm ERR!|ERR!|BUILD FAILED|gradle.*FAILED|FATAL|fatal:|Could not find|Cannot resolve|package not found)/i,
  },
  {
    type: 'ModuleNotFound',
    description: '模块未找到',
    regex: /(?:Cannot find module|ModuleNotFoundError|No module named|Unable to resolve|failed to resolve import)/i,
  },
  {
    type: 'SyntaxError',
    description: '语法错误',
    regex: /(?:SyntaxError|syntax error|unexpected token|unexpected end|parse error)/i,
  },
  {
    type: 'RuntimeError',
    description: '运行时异常',
    regex: /(?:Uncaught|Unhandled|RuntimeError|ReferenceError|RangeError|Internal server error)/i,
  },
  {
    type: 'ViteError',
    description: 'Vite 编译错误',
    regex: /(?:\[vite\]\s*error|Internal server error.*vite|Failed to|\.[tj]sx?.*transform failed|Pre-transform error)/i,
  },
  {
    type: 'TestFailure',
    description: '测试失败',
    regex: /(?:FAIL|FAILED|AssertionError|expect.*received|✗|×|not ok\s)/i,
  },
]
