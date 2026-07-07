import { DiffList } from '../DiffView'
import type { FileChangeRecord } from '@shared/types'

export interface DiffPanelProps {
  fileChanges: FileChangeRecord[]
  onAccept: (id: string) => void
  onReject: (id: string) => void
  onClose: () => void
}

export default function DiffPanel({ fileChanges, onAccept, onReject }: DiffPanelProps) {
  return (
    <div className="border-b border-border bg-bg-secondary/20 max-h-[40vh] overflow-y-auto px-6 py-3">
      <div className="max-w-4xl mx-auto">
        <DiffList
          changes={fileChanges}
          onAccept={onAccept}
          onReject={onReject}
        />
      </div>
    </div>
  )
}
