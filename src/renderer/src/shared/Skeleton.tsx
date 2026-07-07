// 骨架屏组件 — 加载占位

interface SkeletonProps {
  lines?: number
  className?: string
}

/** 文本行骨架屏 */
export function Skeleton({ lines = 3, className = '' }: SkeletonProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4"
          style={{ width: `${70 + Math.random() * 30}%` }}
        />
      ))}
    </div>
  )
}

/** 块状骨架屏（卡片/列表项） */
export function SkeletonBlock({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-block h-16 w-full" />
      ))}
    </div>
  )
}

/** 会话列表骨架屏 */
export function SkeletonSessionList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--surface)' }}>
          <div className="skeleton h-3 w-3/4 mb-2" />
          <div className="skeleton h-2 w-1/2" />
        </div>
      ))}
    </div>
  )
}
