// 安全数学表达式求值器
// 替代不安全的 new Function()，仅支持数学运算
// 支持: + - * / % ^ ( ) , 及 sin/cos/tan/log/ln/sqrt/abs/pow/exp 等函数和 PI/E 常量

type MathToken =
  | { type: 'number'; value: number }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'func'; value: string }
  | { type: 'const'; value: number }
  | { type: 'comma' }

const MATH_FUNCTIONS: Record<string, (x: number, y?: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  pow: (x: number, y?: number) => (y !== undefined ? Math.pow(x, y) : NaN),
}

const MATH_CONSTANTS: Record<string, number> = {
  PI: Math.PI,
  E: Math.E,
}

function tokenizeMath(expr: string): MathToken[] {
  const tokens: MathToken[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (/\s/.test(ch)) { i++; continue }
    if (/[0-9.]/.test(ch)) {
      let num = ''
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++ }
      if (i < expr.length && (expr[i] === 'e' || expr[i] === 'E')) {
        num += expr[i]; i++
        if (i < expr.length && (expr[i] === '+' || expr[i] === '-')) { num += expr[i]; i++ }
        while (i < expr.length && /[0-9]/.test(expr[i])) { num += expr[i]; i++ }
      }
      const val = parseFloat(num)
      if (isNaN(val)) throw new Error(`无效的数字: ${num}`)
      tokens.push({ type: 'number', value: val })
      continue
    }
    if (/[a-zA-Z]/.test(ch)) {
      let name = ''
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { name += expr[i]; i++ }
      if (Object.prototype.hasOwnProperty.call(MATH_CONSTANTS, name)) {
        tokens.push({ type: 'const', value: MATH_CONSTANTS[name] })
      } else if (Object.prototype.hasOwnProperty.call(MATH_FUNCTIONS, name)) {
        tokens.push({ type: 'func', value: name })
      } else {
        throw new Error(`未知的函数或常量: ${name}`)
      }
      continue
    }
    if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue }
    if (ch === ',') { tokens.push({ type: 'comma' }); i++; continue }
    if ('+-*/%^'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue }
    throw new Error(`非法字符: '${ch}'`)
  }
  return tokens
}

// 递归下降解析器
// expr → term (('+' | '-') term)*
// term → factor (('*' | '/' | '%') factor)*
// factor → power ('^' factor)?   (右结合)
// power → number | const | func '(' expr ')' | '(' expr ')' | '-' power
class MathParser {
  private tokens: MathToken[]
  private pos = 0

  constructor(tokens: MathToken[]) {
    this.tokens = tokens
  }

  parse(): number {
    const result = this.parseExpr()
    if (this.pos < this.tokens.length) {
      throw new Error('表达式末尾有未消费的 token')
    }
    return result
  }

  private peek(): MathToken | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null
  }

  private consume(): MathToken {
    return this.tokens[this.pos++]
  }

  private parseExpr(): number {
    let left = this.parseTerm()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const tok = this.peek()
      if (tok && tok.type === 'op' && (tok.value === '+' || tok.value === '-')) {
        this.consume()
        const right = this.parseTerm()
        left = tok.value === '+' ? left + right : left - right
      } else break
    }
    return left
  }

  private parseTerm(): number {
    let left = this.parseFactor()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const tok = this.peek()
      if (tok && tok.type === 'op' && (tok.value === '*' || tok.value === '/' || tok.value === '%')) {
        this.consume()
        const right = this.parseFactor()
        if (tok.value === '*') left *= right
        else if (tok.value === '/') {
          if (right === 0) throw new Error('除零错误')
          left /= right
        } else left %= right
      } else break
    }
    return left
  }

  private parseFactor(): number {
    const base = this.parsePower()
    const tok = this.peek()
    if (tok && tok.type === 'op' && tok.value === '^') {
      this.consume()
      const exp = this.parseFactor() // 右结合 → 递归
      return Math.pow(base, exp)
    }
    return base
  }

  private parsePower(): number {
    const tok = this.peek()
    if (!tok) throw new Error('意外的表达式结束')

    if (tok.type === 'op' && tok.value === '-') {
      this.consume()
      return -this.parsePower()
    }
    if (tok.type === 'op' && tok.value === '+') {
      this.consume()
      return this.parsePower()
    }

    if (tok.type === 'number') {
      this.consume()
      return tok.value
    }
    if (tok.type === 'const') {
      this.consume()
      return tok.value
    }
    if (tok.type === 'func') {
      this.consume()
      const next = this.peek()
      if (!next || next.type !== 'lparen') throw new Error(`函数 ${tok.value} 后需要 '('`)
      this.consume()
      const arg1 = this.parseExpr()
      let arg2: number | undefined
      const maybeComma = this.peek()
      if (maybeComma && maybeComma.type === 'comma') {
        this.consume()
        arg2 = this.parseExpr()
      }
      const close = this.peek()
      if (!close || close.type !== 'rparen') throw new Error(`函数 ${tok.value} 缺少 ')'`)
      this.consume()
      const fn = MATH_FUNCTIONS[tok.value]
      if (!fn) throw new Error(`未知函数: ${tok.value}`)
      return fn(arg1, arg2)
    }
    if (tok.type === 'lparen') {
      this.consume()
      const val = this.parseExpr()
      const close = this.peek()
      if (!close || close.type !== 'rparen') throw new Error("缺少匹配的 ')'")
      this.consume()
      return val
    }

    throw new Error(`意外的 token: ${JSON.stringify(tok)}`)
  }
}

/**
 * 安全求值一个数学表达式
 * @throws Error 解析或求值失败时
 */
export function safeMathEval(expression: string): number {
  const tokens = tokenizeMath(expression)
  if (tokens.length === 0) throw new Error('空表达式')
  const parser = new MathParser(tokens)
  return parser.parse()
}