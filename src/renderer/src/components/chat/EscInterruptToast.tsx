import { useEffect, useRef } from 'react'

interface EscInterruptToastProps {
  /** 是否显示 toast */
  show: boolean
  /** 距离自动隐藏的剩余秒数（0~1） */
  progress: number
}

export default function EscInterruptToast({ show, progress }: EscInterruptToastProps) {
  if (!show) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
    >
      <div className="bg-gray-900/95 border border-gray-600/50 rounded-full px-4 py-2 shadow-xl backdrop-blur-sm flex items-center gap-3">
        <span className="text-gray-200 text-sm whitespace-nowrap">
          {/* 按下 Esc 触发中断提示 */}
          再按一次 <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs font-mono border border-gray-600">Esc</kbd> 停止生成
        </span>
        <div className="w-16 h-1 bg-gray-700/60 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
