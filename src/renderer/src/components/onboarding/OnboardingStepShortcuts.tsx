const SHORTCUTS = [
  { category: '通用', items: [
    { keys: ['Ctrl', 'K'], desc: '打开命令面板' },
    { keys: ['Ctrl', 'N'], desc: '新建会话' },
    { keys: ['Ctrl', 'Shift', 'P'], desc: '快速打开文件' },
    { keys: ['Ctrl', ','], desc: '打开设置' },
  ]},
  { category: '聊天', items: [
    { keys: ['Enter'], desc: '发送消息' },
    { keys: ['Shift', 'Enter'], desc: '换行' },
    { keys: ['Ctrl', 'L'], desc: '聚焦输入框' },
    { keys: ['↑'], desc: '编辑上一条消息' },
  ]},
  { category: '工作台', items: [
    { keys: ['Ctrl', 'B'], desc: '切换侧边栏' },
    { keys: ['Ctrl', 'J'], desc: '切换终端' },
    { keys: ['Ctrl', 'Shift', 'M'], desc: '切换工作台面板' },
  ]},
  { category: '编辑器', items: [
    { keys: ['Ctrl', 'S'], desc: '保存文件' },
    { keys: ['Ctrl', 'Z'], desc: '撤销' },
    { keys: ['Ctrl', 'F'], desc: '查找' },
    { keys: ['Ctrl', 'H'], desc: '替换' },
  ]},
]

export default function OnboardingStepShortcuts() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">快捷键速览</h2>
        <p className="text-sm text-text-muted mt-1">
          以下是 AELA 常用的键盘快捷键，帮助您更高效地使用应用。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {SHORTCUTS.map((group) => (
          <div key={group.category} className="bg-surface border border-border rounded-xl p-4">
            <h3 className="text-sm font-medium text-text-primary mb-3">{group.category}</h3>
            <div className="space-y-2.5">
              {group.items.map((item) => (
                <div key={item.desc} className="flex items-center justify-between">
                  <span className="text-xs text-text-secondary">{item.desc}</span>
                  <div className="flex items-center gap-1">
                    {item.keys.map((key, idx) => (
                      <span key={idx} className="flex items-center gap-1">
                        {idx > 0 && <span className="text-text-muted text-[10px]">+</span>}
                        <kbd className="px-1.5 py-0.5 bg-bg-primary border border-border rounded text-[10px] text-text-primary font-mono min-w-[20px] text-center">
                          {key}
                        </kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 px-4 py-3 bg-surface/50 border border-border rounded-lg">
        <p className="text-xs text-text-muted">
          💡 提示：您可以在"设置 → 快捷键"中查看所有可用的快捷键并自定义绑定。
        </p>
      </div>
    </div>
  )
}
