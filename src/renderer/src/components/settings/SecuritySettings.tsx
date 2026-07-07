// 6. 安全与护栏 (Security Sandbox + Guardrail Rules)

import { useEffect, useState, useCallback } from 'react'
import { useT } from '../../i18n'
import type { SandboxConfig, AccessLevel, GuardrailRuleConfig, GuardrailCheckPoint } from '@shared/types'
import { Card, Toggle, inputCls, btnCls } from './shared'

export function SecuritySettings() {
  const t = useT()
  const [sandbox, setSandbox] = useState<SandboxConfig | null>(null)
  const [rules, setRules] = useState<GuardrailRuleConfig[]>([])
  const [newAllowedCmd, setNewAllowedCmd] = useState('')
  const [newBlockedCmd, setNewBlockedCmd] = useState('')
  const [newAclAgent, setNewAclAgent] = useState('')
  const [newAclResource, setNewAclResource] = useState('')
  const [newAclLevel, setNewAclLevel] = useState<AccessLevel>('read')

  const loadData = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([
        window.aela.security.getConfig(),
        window.aela.guardrail.getRules(),
      ])
      setSandbox(s); setRules(r)
    } catch (err) { console.error('Failed to load security config:', err) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleSaveSandbox = async () => {
    if (!sandbox) return
    await window.aela.security.setConfig(sandbox)
    loadData()
  }

  // ACL 规则操作
  const addAclRule = () => {
    if (!sandbox || !newAclAgent.trim() || !newAclResource.trim()) return
    setSandbox({
      ...sandbox,
      aclRules: [...sandbox.aclRules, {
        agentId: newAclAgent.trim(),
        resource: newAclResource.trim(),
        level: newAclLevel,
        denied: false,
      }],
    })
    setNewAclAgent(''); setNewAclResource(''); setNewAclLevel('read')
  }
  const removeAclRule = (idx: number) => {
    if (!sandbox) return
    setSandbox({ ...sandbox, aclRules: sandbox.aclRules.filter((_, i) => i !== idx) })
  }
  const toggleAclDenied = (idx: number) => {
    if (!sandbox) return
    const u = [...sandbox.aclRules]; u[idx] = { ...u[idx], denied: !u[idx].denied }
    setSandbox({ ...sandbox, aclRules: u })
  }

  // 命令白名单/黑名单
  const addAllowedCmd = () => {
    if (!sandbox || !newAllowedCmd.trim()) return
    if (!sandbox.allowedCommands.includes(newAllowedCmd.trim())) {
      setSandbox({ ...sandbox, allowedCommands: [...sandbox.allowedCommands, newAllowedCmd.trim()] })
    }
    setNewAllowedCmd('')
  }
  const addBlockedCmd = () => {
    if (!sandbox || !newBlockedCmd.trim()) return
    if (!sandbox.blockedCommands.includes(newBlockedCmd.trim())) {
      setSandbox({ ...sandbox, blockedCommands: [...sandbox.blockedCommands, newBlockedCmd.trim()] })
    }
    setNewBlockedCmd('')
  }

  // 护栏规则操作
  const handleSaveRules = async () => {
    await window.aela.guardrail.setRules(rules)
    loadData()
  }
  const addGuardrailRule = () => {
    setRules([...rules, {
      id: `rule_${Date.now()}`,
      name: '新规则',
      type: 'keyword',
      enabled: true,
      checkPoint: 'input',
      config: {},
    }])
  }
  const updateRule = (idx: number, patch: Partial<GuardrailRuleConfig>) => {
    const u = [...rules]; u[idx] = { ...u[idx], ...patch }
    setRules(u)
  }
  const removeRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx))
  }

  if (!sandbox) return <div className="p-6 text-text-muted">{t('common.loading')}</div>

  const accessLevels: AccessLevel[] = ['none', 'read', 'write', 'execute', 'all']
  const ruleTypes: Array<{ val: GuardrailRuleConfig['type']; label: string }> = [
    { val: 'injection', label: t('ap.security.injectionDetect') },
    { val: 'pii', label: t('ap.security.piiMasking') },
    { val: 'topic', label: t('ap.security.topicLimit') },
    { val: 'keyword', label: t('ap.security.keywordFilter') },
  ]
  const checkPoints: Array<{ val: GuardrailCheckPoint; label: string }> = [
    { val: 'input', label: t('ap.security.input') },
    { val: 'output', label: t('ap.security.output') },
  ]

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">{t('ap.security.title')}</h3>
        <p className="text-xs text-text-muted mt-1">{t('ap.security.desc')}</p>
      </div>

      {/* ACL 规则 */}
      <Card title={t('ap.security.aclRules')} desc={t('ap.security.aclDesc')}>
        <div className="space-y-2">
          {sandbox.aclRules.map((rule, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-bg-primary/50 rounded-lg border border-border">
              <span className="text-xs font-mono text-text-secondary shrink-0">{rule.agentId}</span>
              <span className="text-text-muted text-xs">→</span>
              <span className="text-xs font-mono text-text-secondary flex-1 truncate">{rule.resource}</span>
              <select
                value={rule.level}
                onChange={(e) => { const u = [...sandbox.aclRules]; u[idx] = { ...rule, level: e.target.value as AccessLevel }; setSandbox({ ...sandbox, aclRules: u }) }}
                className="bg-bg-primary text-text-primary rounded px-2 py-1 text-xs border border-border focus:outline-none"
              >
                {accessLevels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <button
                onClick={() => toggleAclDenied(idx)}
                className={`px-2 py-1 rounded text-xs font-mono shrink-0 ${rule.denied ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}
              >
                {rule.denied ? 'DENY' : 'ALLOW'}
              </button>
              <button onClick={() => removeAclRule(idx)} className="text-text-muted hover:text-red-400 text-sm shrink-0 px-1">✕</button>
            </div>
          ))}
          {sandbox.aclRules.length === 0 && <div className="text-center text-text-muted text-sm py-3">{t('ap.security.noAclRules')}</div>}
        </div>
        {/* 添加 ACL 规则 */}
        <div className="flex items-center gap-2 mt-2">
          <input value={newAclAgent} onChange={(e) => setNewAclAgent(e.target.value)} placeholder="Agent ID" className={inputCls + ' text-xs flex-1'} />
          <input value={newAclResource} onChange={(e) => setNewAclResource(e.target.value)} placeholder="/path/to/resource" className={inputCls + ' text-xs flex-1'} />
          <select value={newAclLevel} onChange={(e) => setNewAclLevel(e.target.value as AccessLevel)} className="bg-bg-primary text-text-primary rounded px-2 py-2 text-xs border border-border focus:outline-none">
            {accessLevels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button onClick={addAclRule} disabled={!newAclAgent.trim() || !newAclResource.trim()} className={btnCls + ' text-xs whitespace-nowrap'}>{t('ap.security.addBtn')}</button>
        </div>
      </Card>

      {/* 命令白名单 / 黑名单 */}
      <Card title={t('ap.security.cmdWhitelistBlacklist')} desc={t('ap.security.cmdDesc')}>
        <div className="space-y-3">
          {/* 白名单 */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">{t('ap.security.allowedCmds')}</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sandbox.allowedCommands.map(cmd => (
                <span key={cmd} className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded-md text-xs border border-green-500/20">
                  <span className="text-green-400 font-mono">{cmd}</span>
                  <button onClick={() => setSandbox({ ...sandbox, allowedCommands: sandbox.allowedCommands.filter(c => c !== cmd) })} className="text-text-muted hover:text-red-400 ml-0.5">✕</button>
                </span>
              ))}
              {sandbox.allowedCommands.length === 0 && <span className="text-xs text-text-muted">{t('ap.security.none')}</span>}
            </div>
            <div className="flex gap-2">
              <input value={newAllowedCmd} onChange={(e) => setNewAllowedCmd(e.target.value)} placeholder="如: git status" className={inputCls + ' text-xs'} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllowedCmd() } }} />
              <button onClick={addAllowedCmd} disabled={!newAllowedCmd.trim()} className={btnCls + ' text-xs whitespace-nowrap'}>{t('ap.security.addBtn')}</button>
            </div>
          </div>
          {/* 黑名单 */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">{t('ap.security.blockedCmds')}</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sandbox.blockedCommands.map(cmd => (
                <span key={cmd} className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 rounded-md text-xs border border-red-500/20">
                  <span className="text-red-400 font-mono">{cmd}</span>
                  <button onClick={() => setSandbox({ ...sandbox, blockedCommands: sandbox.blockedCommands.filter(c => c !== cmd) })} className="text-text-muted hover:text-red-400 ml-0.5">✕</button>
                </span>
              ))}
              {sandbox.blockedCommands.length === 0 && <span className="text-xs text-text-muted">{t('ap.security.none')}</span>}
            </div>
            <div className="flex gap-2">
              <input value={newBlockedCmd} onChange={(e) => setNewBlockedCmd(e.target.value)} placeholder="如: rm -rf" className={inputCls + ' text-xs'} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBlockedCmd() } }} />
              <button onClick={addBlockedCmd} disabled={!newBlockedCmd.trim()} className={btnCls + ' text-xs whitespace-nowrap'}>{t('ap.security.addBtn')}</button>
            </div>
          </div>
        </div>
        <button onClick={handleSaveSandbox} className={btnCls + ' mt-3'}>{t('ap.security.saveSandbox')}</button>
      </Card>

      {/* 护栏规则 */}
      <Card title={t('ap.security.guardrailRules')} desc={t('ap.security.guardrailDesc')}>
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <div key={rule.id} className="p-2.5 bg-bg-primary/50 rounded-lg border border-border space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={rule.name}
                  onChange={(e) => updateRule(idx, { name: e.target.value })}
                  className={inputCls + ' text-xs flex-1'}
                  placeholder={t('ap.security.ruleName')}
                />
                <select
                  value={rule.type}
                  onChange={(e) => updateRule(idx, { type: e.target.value as GuardrailRuleConfig['type'] })}
                  className="bg-bg-primary text-text-primary rounded px-2 py-1.5 text-xs border border-border focus:outline-none"
                >
                  {ruleTypes.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                </select>
                <select
                  value={rule.checkPoint}
                  onChange={(e) => updateRule(idx, { checkPoint: e.target.value as GuardrailCheckPoint })}
                  className="bg-bg-primary text-text-primary rounded px-2 py-1.5 text-xs border border-border focus:outline-none"
                >
                  {checkPoints.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
                </select>
                <Toggle checked={rule.enabled} onChange={(v) => updateRule(idx, { enabled: v })} />
                <button onClick={() => removeRule(idx)} className="text-text-muted hover:text-red-400 text-sm shrink-0 px-1">✕</button>
              </div>
              {/* 关键词/话题类型的额外配置 */}
              {(rule.type === 'keyword' || rule.type === 'topic') && (
                <input
                  value={(rule.config.keywords as string)?.toString() ?? ''}
                  onChange={(e) => updateRule(idx, { config: { ...rule.config, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                  placeholder={rule.type === 'keyword' ? t('ap.security.keywordPlaceholder') : t('ap.security.topicPlaceholder')}
                  className={inputCls + ' text-xs'}
                />
              )}
            </div>
          ))}
          {rules.length === 0 && <div className="text-center text-text-muted text-sm py-3">{t('ap.security.noRules')}</div>}
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={addGuardrailRule} className="text-xs text-accent-light hover:text-accent transition-colors">{t('ap.security.addRule')}</button>
          <button onClick={handleSaveRules} className={btnCls + ' text-xs ml-auto'}>{t('ap.security.saveRules')}</button>
        </div>
      </Card>
    </div>
  )
}
