interface ToolCallCardProps {
  toolName: string
  status?: 'pending' | 'running' | 'success' | 'error'
  duration?: number
  args?: string
  result?: string
}

export default function ToolCallCard({ toolName, status = 'success', duration, args, result }: ToolCallCardProps) {
  const statusIcon = {
    pending: '⏳',
    running: '🔄',
    success: '✅',
    error: '❌',
  }[status]

  const statusColor = {
    pending: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5',
    running: 'text-blue-500 border-blue-500/30 bg-blue-500/5',
    success: 'text-green-500 border-green-500/30 bg-green-500/5',
    error: 'text-red-500 border-red-500/30 bg-red-500/5',
  }[status]

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${statusColor}`}>
      <span className={status === 'running' ? 'animate-spin inline-block' : ''}>{statusIcon}</span>
      <span className="font-mono font-medium">{toolName}</span>
      {duration !== undefined && (
        <span className="text-xs opacity-60">{duration}ms</span>
      )}
    </div>
  )
}
