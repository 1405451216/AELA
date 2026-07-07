import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/app'
import { dialog } from '../stores/dialog'
import type { Workspace, FileTreeNode } from '@shared/types'
import { formatTime } from '../utils'

export default function WorkspaceView() {
  const { setCurrentWorkspace, setError } = useAppStore()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ path: string; line: number; content: string }>>([])

  const loadWorkspaces = async () => {
    try {
      const list = await window.aela.workspace.list()
      setWorkspaces(list)
    } catch (err: unknown) {
      setError(`加载工作区失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadWorkspaces()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddWorkspace = async () => {
    try {
      const ws = await window.aela.workspace.add()
      if (ws) {
        loadWorkspaces()
        handleSelectWorkspace(ws)
      }
    } catch (err: unknown) {
      setError(`添加工作区失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSelectWorkspace = async (ws: Workspace) => {
    setCurrentWorkspace(ws)
    try {
      await window.aela.workspace.open(ws.path)
      const tree = await window.aela.workspace.fileTree(ws.path)
      setFileTree(tree)
    } catch (err: unknown) {
      setError(`打开工作区失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleRemoveWorkspace = async (id: string) => {
    const confirmed = await dialog.confirm('确定移除这个工作区？（不会删除文件）', { variant: 'warning' })
    if (!confirmed) return
    try {
      await window.aela.workspace.remove(id)
      const current = useAppStore.getState().currentWorkspace
      if (current?.id === id) {
        setCurrentWorkspace(null)
        setFileTree(null)
      }
      loadWorkspaces()
    } catch (err: unknown) {
      setError(`移除工作区失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleFileClick = async (node: FileTreeNode) => {
    if (node.type === 'directory') return
    const ws = useAppStore.getState().currentWorkspace
    if (!ws) return
    const fullPath = node.path === '.' ? ws.path : `${ws.path}/${node.path}`
    try {
      const content = await window.aela.workspace.readFile(fullPath)
      setFileContent(content)
      setSelectedPath(node.path)
    } catch (err: unknown) {
      setError(`读取文件失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    const ws = useAppStore.getState().currentWorkspace
    if (!ws) return
    try {
      const results = await window.aela.workspace.search(ws.path, searchQuery)
      setSearchResults(results)
    } catch (err: unknown) {
      setError(`搜索失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 文件树渲染最大深度 — 防止超深嵌套目录导致性能问题和栈溢出
  const MAX_TREE_DEPTH = 20

  const renderFileTree = (node: FileTreeNode | null, depth: number = 0): React.ReactNode => {
    if (!node || depth >= MAX_TREE_DEPTH) return null
    return (
      <div key={node.path}>
        <div
          onClick={() => handleFileClick(node)}
          className={`flex items-center gap-1 px-2 py-0.5 text-xs cursor-pointer hover:bg-surface-hover rounded ${
            selectedPath === node.path ? 'bg-surface-active text-accent-light' : 'text-text-secondary'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span>{node.type === 'directory' ? '📁' : '📄'}</span>
          <span className="truncate">{node.name}</span>
        </div>
        {node.children?.map((child: FileTreeNode) => renderFileTree(child, depth + 1))}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-bold text-text-primary">工作区</h2>
          <p className="text-xs text-text-muted">管理项目目录和文件</p>
        </div>
        <button
          onClick={handleAddWorkspace}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
        >
          + 添加工作区
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：工作区列表 + 文件树 */}
        <div className="w-80 border-r border-border flex flex-col overflow-hidden">
          {/* 工作区列表 */}
          <div className="p-3 border-b border-border">
            <div className="text-xs text-text-muted uppercase mb-2">项目列表</div>
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                onClick={() => handleSelectWorkspace(ws)}
                className={`group flex items-center justify-between p-2 rounded cursor-pointer text-sm mb-1 ${
                  useAppStore.getState().currentWorkspace?.id === ws.id
                    ? 'bg-surface-active text-text-primary'
                    : 'hover:bg-surface-hover text-text-secondary'
                }`}
              >
                <div className="truncate flex-1">
                  <span>📂 {ws.name}</span>
                  <div className="text-xs text-text-muted">{formatTime(ws.lastOpenedAt)}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveWorkspace(ws.id) }}
                  className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 text-xs ml-2"
                >
                  ✕
                </button>
              </div>
            ))}
            {workspaces.length === 0 && (
              <div className="text-center text-text-muted text-xs py-4">暂无工作区</div>
            )}
          </div>

          {/* 搜索框 */}
          {useAppStore.getState().currentWorkspace && (
            <div className="p-3 border-b border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="搜索代码..."
                  className="flex-1 bg-bg-primary text-text-primary text-xs rounded px-2 py-1.5 border border-border focus:border-accent focus:outline-none"
                />
                <button
                  onClick={handleSearch}
                  className="px-3 py-1.5 bg-surface-hover hover:bg-surface-active text-text-secondary text-xs rounded"
                >
                  搜索
                </button>
              </div>
            </div>
          )}

          {/* 文件树 / 搜索结果 */}
          <div className="flex-1 overflow-y-auto py-2">
            {searchResults.length > 0 ? (
              <div className="px-2">
                <div className="text-xs text-text-muted mb-1">搜索结果 ({searchResults.length})</div>
                {searchResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="text-xs text-text-secondary px-2 py-1 hover:bg-surface-hover rounded cursor-pointer"
                    onClick={() => {
                      setSelectedPath(result.path)
                      const ws = useAppStore.getState().currentWorkspace
                      if (ws) window.aela.workspace.readFile(`${ws.path}/${result.path}`).then(setFileContent)
                    }}
                  >
                    <span className="text-accent-light font-mono">{result.path}:{result.line}</span>
                    <div className="text-text-muted truncate">{result.content}</div>
                  </div>
                ))}
              </div>
            ) : (
              fileTree && renderFileTree(fileTree)
            )}
          </div>
        </div>

        {/* 右侧：文件内容预览 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedPath ? (
            <>
              <div className="px-4 py-2 border-b border-border text-xs text-text-muted font-mono">
                {selectedPath}
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-xs text-text-primary font-mono whitespace-pre-wrap selectable">
                  {fileContent}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <div className="text-center">
                <div className="text-4xl mb-3">📁</div>
                <p className="text-sm">选择一个文件查看内容</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
