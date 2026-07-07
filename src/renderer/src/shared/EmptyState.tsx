// 通用空状态组件 — 引导用户下一步操作

export interface EmptyStateProps {
  icon?: string
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in-up">
      <span className="text-4xl mb-3" aria-hidden="true">{icon}</span>
      <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-text-muted max-w-xs mb-4">{description}</p>
      )}
      {action && (
        <button onClick={action.onClick} className="btn-primary text-xs">
          {action.label}
        </button>
      )}
    </div>
  )
}
