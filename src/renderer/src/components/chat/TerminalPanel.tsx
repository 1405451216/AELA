import TerminalView from '../TerminalView'

export interface TerminalPanelProps {
  cwd?: string
  onClose: () => void
}

export default function TerminalPanel({ cwd, onClose }: TerminalPanelProps) {
  return (
    <div className="h-[300px] border-t border-border">
      <TerminalView
        embedded
        cwd={cwd}
        onClose={onClose}
      />
    </div>
  )
}
