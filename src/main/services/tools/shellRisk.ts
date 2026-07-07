// Shell command risk assessment — tokenizer + pipeline chain analyzer
//
// Improvement over the old regex substring matching:
// 1. Correctly parse command chaining (;, &&, ||, |, newline), evaluate each sub-command
// 2. Detect command injection: backticks, $(), # comment truncation, line continuation
// 3. Extract base command name and args per sub-command, match on first token
// 4. If any command in a pipeline chain is dangerous, the whole chain is dangerous

export type CommandRisk = 'safe' | 'moderate' | 'dangerous'

export interface CommandRiskAssessment {
  risk: CommandRisk
  reasons: string[]
  /** Parsed sub-command list (for debugging and audit) */
  subCommands?: string[]
}

// ============================================================
// Command pattern definitions — match base command name, not full regex
// ============================================================

interface CommandPattern {
  risk: CommandRisk
  /** Match base command name (e.g. "rm", "git", "del") */
  cmd: string
  /** Optional: match dangerous flag args (e.g. "-rf", "--force") */
  dangerousFlags?: string[]
  /** Optional: custom reason description */
  reason?: string
}

// Dangerous commands — must confirm
const DANGEROUS_COMMANDS: CommandPattern[] = [
  { risk: 'dangerous', cmd: 'rm', dangerousFlags: ['-rf', '-fr', '-r', '--recursive', '--force'], reason: 'Recursive deletion is irreversible' },
  { risk: 'dangerous', cmd: 'del', dangerousFlags: ['/s', '/f', '/q'], reason: 'Force deletion' },
  { risk: 'dangerous', cmd: 'format', reason: 'Disk formatting is irreversible' },
  { risk: 'dangerous', cmd: 'mkfs', reason: 'Filesystem creation is irreversible' },
  { risk: 'dangerous', cmd: 'fdisk', reason: 'Disk partitioning is irreversible' },
  { risk: 'dangerous', cmd: 'dd', reason: 'Low-level disk write is irreversible' },
  { risk: 'dangerous', cmd: 'chmod', dangerousFlags: ['777', '-R'], reason: 'chmod 777 or recursive chmod is a security risk' },
  { risk: 'dangerous', cmd: 'chown', dangerousFlags: ['-R'], reason: 'Recursive chown is a security risk' },
  { risk: 'dangerous', cmd: 'sudo', reason: 'Privilege escalation' },
  { risk: 'dangerous', cmd: 'su', reason: 'User switch' },
  { risk: 'dangerous', cmd: 'shutdown', reason: 'Shutdown' },
  { risk: 'dangerous', cmd: 'reboot', reason: 'Reboot' },
  { risk: 'dangerous', cmd: 'kill', dangerousFlags: ['-9'], reason: 'Force kill process' },
  { risk: 'dangerous', cmd: 'taskkill', dangerousFlags: ['/f'], reason: 'Force kill process' },
  { risk: 'dangerous', cmd: 'docker', dangerousFlags: ['rmi', 'system prune'], reason: 'Batch Docker resource deletion' },
  { risk: 'dangerous', cmd: 'npm', dangerousFlags: ['unpublish'], reason: 'Unpublishing from npm registry is irreversible' },
  { risk: 'dangerous', cmd: 'reg', dangerousFlags: ['add', 'delete'], reason: 'Modify Windows registry' },
  { risk: 'dangerous', cmd: 'sc', dangerousFlags: ['stop', 'delete'], reason: 'Operate Windows services' },
  { risk: 'dangerous', cmd: 'net', dangerousFlags: ['user', 'localgroup'], reason: 'Operate users/groups' },
]

// Safe command whitelist — read-only operations
const SAFE_COMMANDS = new Set([
  'echo', 'cat', 'type', 'head', 'tail',
  'ls', 'dir', 'tree',
  'wc', 'find', 'which', 'where',
  'pwd', 'env',
  'node', 'python', 'go', 'rustc', 'java',
])

// Commands that need sub-command evaluation
const SUBCOMMAND_COMMANDS = new Set(['git', 'npm', 'yarn', 'pnpm', 'npx'])

// Safe sub-command map (cmd -> Set of safe subcommands)
const SAFE_SUBCOMMANDS: Record<string, Set<string>> = {
  git: new Set(['status', 'log', 'diff', 'branch', 'show', 'blame', 'stash', 'remote', 'tag', 'shortlog', 'rev-parse', 'describe']),
  npm: new Set(['list', 'view', 'outdated', 'audit', 'ls', 'root', 'bin', 'prefix', 'config', 'doctor']),
  yarn: new Set(['list', 'info', 'why', 'outdated', 'config', 'dir', 'bin']),
  pnpm: new Set(['list', 'outdated', 'why', 'config', 'bin', 'store']),
  npx: new Set(['--version', '-v']),
}

// Moderate risk — write operations but reversible
const MODERATE_SUBCOMMANDS: Record<string, Set<string>> = {
  git: new Set(['commit', 'push', 'pull', 'merge', 'rebase', 'checkout', 'switch', 'reset', 'clone', 'init', 'add', 'mv', 'rm', 'clean', 'tag', 'fetch', 'remote']),
  npm: new Set(['install', 'i', 'uninstall', 'update', 'ci', 'run', 'test', 'link', 'dedupe', 'rebuild', 'publish', 'pack']),
  yarn: new Set(['add', 'remove', 'install', 'upgrade', 'run', 'test', 'link', 'publish']),
  pnpm: new Set(['add', 'remove', 'install', 'update', 'run', 'test', 'exec', 'publish']),
  pip: new Set(['install', 'uninstall', 'freeze', 'list', 'show']),
  docker: new Set(['build', 'compose', 'run', 'exec', 'start', 'stop', 'restart', 'pull', 'push', 'images', 'ps', 'logs', 'inspect']),
  cargo: new Set(['build', 'run', 'install', 'publish', 'test', 'check', 'fmt', 'clippy', 'doc']),
  go: new Set(['build', 'install', 'get', 'mod', 'test', 'fmt', 'vet', 'run']),
  dotnet: new Set(['build', 'publish', 'run', 'test', 'restore', 'clean']),
  mv: new Set(['*']),
  cp: new Set(['*']),
  mkdir: new Set(['*']),
  curl: new Set(['*']),
  wget: new Set(['*']),
}

// ============================================================
// Tokenizer: parse command chain into independent sub-commands
// ============================================================

// Command chain operators (split on ; && || newline, but keep | inside sub-command)
const CHAIN_SPLIT_RE = /(?:;|\|\||&|\n)/

/**
 * Detect command injection attempts
 * Detects backticks, $(), # comment truncation, etc.
 */
function detectInjection(command: string): string[] {
  const issues: string[] = []
  const bt = String.fromCharCode(96) // backtick char

  // Backtick command substitution
  const backtickPattern = new RegExp(bt + '[^' + bt + ']*' + bt)
  if (backtickPattern.test(command)) {
    issues.push('Backtick command substitution detected')
  }

  // $() command substitution
  if (/\$\([^)]*\)/.test(command)) {
    issues.push('$() command substitution detected')
  }

  // # comment truncation followed by command
  if (/#.*[;&|]/.test(command)) {
    issues.push('Comment truncation followed by command')
  }

  // Line continuation followed by command
  if (/\\\s*[\n\r]/.test(command)) {
    issues.push('Line continuation followed by command')
  }

  return issues
}

/**
 * Split command into independent sub-commands
 */
function splitSubCommands(command: string): string[] {
  return command
    .split(CHAIN_SPLIT_RE)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * Parse a single command: extract base command name and sub-command
 */
function parseCommand(cmd: string): { base: string; subCmd: string; args: string[]; hasSudo: boolean } {
  // For pipelines: take the first command before |
  const beforePipe = cmd.split('|')[0].trim()
  const tokens = beforePipe.split(/\s+/).filter(t => t.length > 0)

  if (tokens.length === 0) return { base: '', subCmd: '', args: [], hasSudo: false }

  // Handle sudo prefix
  let startIdx = 0
  const hasSudo = tokens[0] === 'sudo' && tokens.length > 1
  if (hasSudo) {
    startIdx = 1
  }

  const base = tokens[startIdx] || ''
  const subCmd = tokens[startIdx + 1] || ''
  const args = tokens.slice(startIdx + 2)

  return { base, subCmd, args, hasSudo }
}

/**
 * Assess risk of a single command
 */
function assessSingleCommand(cmd: string): CommandRiskAssessment {
  const { base, subCmd, args, hasSudo } = parseCommand(cmd)

  if (!base) {
    return { risk: 'safe', reasons: ['Empty command'] }
  }

  // 0. sudo 前缀：任何通过 sudo 执行的命令都视为危险（权限提升）
  if (hasSudo) {
    return { risk: 'dangerous', reasons: ['sudo 前缀命令提升权限，视为危险'] }
  }

  // 1. Check dangerous commands
  for (const pattern of DANGEROUS_COMMANDS) {
    if (base === pattern.cmd) {
      if (pattern.dangerousFlags && subCmd) {
        const fullArgs = [subCmd, ...args].join(' ')
        if (pattern.dangerousFlags.some(f => fullArgs.includes(f))) {
          const reason = pattern.reason || ('Dangerous command: ' + base + ' ' + fullArgs)
          return { risk: 'dangerous', reasons: [reason] }
        }
      } else if (!pattern.dangerousFlags) {
        const reason = pattern.reason || ('Dangerous command: ' + base)
        return { risk: 'dangerous', reasons: [reason] }
      }
    }
  }

  // 2. Check safe subcommands
  if (subCmd && SAFE_SUBCOMMANDS[base]) {
    if (SAFE_SUBCOMMANDS[base].has(subCmd)) {
      return { risk: 'safe', reasons: [base + ' ' + subCmd + ' is a safe read-only operation'] }
    }
  }

  // 3. Check moderate subcommands
  if (subCmd && MODERATE_SUBCOMMANDS[base]) {
    if (MODERATE_SUBCOMMANDS[base].has(subCmd) || MODERATE_SUBCOMMANDS[base].has('*')) {
      return { risk: 'moderate', reasons: [base + ' ' + subCmd + ' requires confirmation'] }
    }
  }

  // 4. Safe commands without sub-command (echo, cat, ls, ...)
  if (SAFE_COMMANDS.has(base)) {
    return { risk: 'safe', reasons: [base + ' is a safe operation'] }
  }

  // 5. Sub-command commands where the sub-command is unknown: check if base is known
  if (SUBCOMMAND_COMMANDS.has(base)) {
    return { risk: 'moderate', reasons: [base + ' ' + subCmd + ' is an unknown sub-command, confirmation recommended'] }
  }

  // 6. Redirect to dangerous device
  if (cmd.includes('/dev/')) {
    return { risk: 'dangerous', reasons: ['Writing to /dev/ device node is a security risk'] }
  }

  // 7. curl/wget pipe to shell
  if (/\b(curl|wget)\b/.test(cmd) && /\|\s*(ba)?sh/.test(cmd)) {
    return { risk: 'dangerous', reasons: ['Downloading and executing shell directly is a security risk'] }
  }

  // 8. PowerShell execution policy modification
  if (/Set-ExecutionPolicy|Invoke-Expression|iex\s+\(/i.test(cmd)) {
    return { risk: 'dangerous', reasons: ['Modifying PowerShell execution policy or executing code directly'] }
  }

  // 9. Default
  return { risk: 'moderate', reasons: ['Unknown command "' + base + '", confirmation recommended'] }
}

// ============================================================
// Main export function
// ============================================================

export function assessCommandRisk(command: string): CommandRiskAssessment {
  const trimmed = command.trim()
  if (!trimmed) {
    return { risk: 'safe', reasons: ['Empty command'] }
  }

  const allReasons: string[] = []
  const subCommands: string[] = []

  // 1. Detect command injection
  const injectionIssues = detectInjection(trimmed)
  if (injectionIssues.length > 0) {
    allReasons.push(...injectionIssues)
    return { risk: 'dangerous', reasons: allReasons, subCommands: [trimmed] }
  }

  // 2. Split command chain
  const parts = splitSubCommands(trimmed)
  subCommands.push(...parts)

  // 3. Evaluate each sub-command, take the highest risk level
  let maxRisk: CommandRisk = 'safe'
  const riskPriority: Record<CommandRisk, number> = { safe: 0, moderate: 1, dangerous: 2 }

  for (const part of parts) {
    const result = assessSingleCommand(part)
    if (riskPriority[result.risk] > riskPriority[maxRisk]) {
      maxRisk = result.risk
    }
    allReasons.push(...result.reasons)
  }

  // Deduplicate reasons
  const uniqueReasons = [...new Set(allReasons)]

  return { risk: maxRisk, reasons: uniqueReasons, subCommands }
}
