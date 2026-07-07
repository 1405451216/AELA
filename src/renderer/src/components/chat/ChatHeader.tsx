import { useT } from '../../i18n'
import type { FileChangeRecord } from '@shared/types'

export interface ChatHeaderProps {
  sessionTitle?: string
  selectedMode: string
  activeSkillCount: number
  fileChanges: FileChangeRecord[]
  showDiffPanel: boolean
  showTerminal: boolean
  onToggleDiffPanel: () => void
  onToggleTerminal: () => void
}

export default function ChatHeader({
  sessionTitle,
  selectedMode,
  activeSkillCount,
  fileChanges,
  showDiffPanel,
  showTerminal,
  onToggleDiffPanel,
  onToggleTerminal,
}: ChatHeaderProps) {
  const t = useT()

  return (
    <div className="flex items-center justify-between px-6 py-2.5 border-b border-border bg-bg-secondary/30">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-medium text-text-primary truncate">
          {sessionTitle || t('chat.conversation')}
        </span>
        {fileChanges.length > 0 && (
          <button
            onClick={onToggleDiffPanel}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
              showDiffPanel
                ? 'bg-blue-900/40 border-blue-700/50 text-blue-400'
                : 'bg-surface border-border text-text-muted hover:text-text-primary'
            }`}
          >
            <span>📝</span>
            <span>{t('chat.changes', { n: fileChanges.length })}</span>
          </button>
        )}
        <button
          onClick={onToggleTerminal}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border transition-colors ${
            showTerminal
              ? 'bg-green-900/40 border-green-700/50 text-green-400'
              : 'bg-surface border-border text-text-muted hover:text-text-primary'
          }`}
          title={t('chat.terminal')}
        >
          <span>▣</span>
          <span>{t('chat.terminal')}</span>
        </button>
      </div>
      <span className="text-[11px] text-text-muted shrink-0">
        {(selectedMode === 'code' ? t('input.codeDev') : t('input.daily'))}{t('chat.mode')}
        {activeSkillCount > 0 && ` · ${activeSkillCount}${t('chat.skills')}`}
      </span>
    </div>
  )
}
