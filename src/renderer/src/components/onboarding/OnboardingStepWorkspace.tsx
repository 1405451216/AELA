import { useState } from 'react'
import { useConfigStore } from '../../stores/configStore'

export default function OnboardingStepWorkspace() {
  const currentWorkspace = useConfigStore((s) => s.currentWorkspace)
  const setCurrentWorkspace = useConfigStore((s) => s.setCurrentWorkspace)
  const [status, setStatus] = useState<string | null>(null)

  const handleSelectFolder = async () => {
    try {
      const result = await window.aela.dialog.showOpenDialog({
        properties: ['openDirectory'],
        title: '选择工作区文件夹',
      })
      if (result && result.length > 0) {
        const folderPath = result[0]
        setCurrentWorkspace({
          id: folderPath,
          name: folderPath.split(/[\\/]/).pop() || folderPath,
          path: folderPath,
          createdAt: new Date().toISOString(),
          lastOpenedAt: new Date().toISOString(),
        })
        setStatus(`✓ 已选择: ${folderPath}`)
      }
    } catch {
      setStatus('✗ 选择文件夹失败')
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">选择工作区</h2>
        <p className="text-sm text-text-muted mt-1">
          选择一个项目文件夹作为您的工作区，AELA 将在此目录下读写文件。
        </p>
      </div>

      {status && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm ${
          status.startsWith('✓')
            ? 'bg-green-900/20 text-green-400 border border-green-500/30'
            : 'bg-amber-900/20 text-amber-400 border border-amber-500/30'
        }`}>
          {status}
        </div>
      )}

      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-text-primary">当前工作区</div>
            <div className="text-xs text-text-muted mt-0.5">
              {currentWorkspace ? currentWorkspace.path : '未选择'}
            </div>
          </div>
          <button
            onClick={handleSelectFolder}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            浏览...
          </button>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-text-muted leading-relaxed">
            工作区是 AELA 执行文件操作（读取、创建、编辑）的根目录。
            您可以随时在设置中更改工作区。这一步是可选的，您可以稍后配置。
          </p>
        </div>
      </div>
    </div>
  )
}
