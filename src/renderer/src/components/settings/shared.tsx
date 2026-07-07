// 共享 UI 工具组件与常量
// 供 settings 子面板统一使用，保持视觉风格一致

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-accent' : 'bg-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

export function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div>
        <label className="text-sm font-medium text-text-primary">{title}</label>
        {desc && <p className="text-xs text-text-muted mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

export const inputCls = 'w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none'
export const btnCls = 'px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors'
