import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/app'
import { dialog } from '../stores/dialog'
import type { MCPServerConfig, MCPServerStatus } from '@shared/types'

export default function MCPManagerView() {
  const { setError } = useAppStore()
  const [servers, setServers] = useState<MCPServerConfig[]>([])
  const [statuses, setStatuses] = useState<MCPServerStatus[]>([])
  const [showForm, setShowForm] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    transport: 'stdio' as 'stdio' | 'http',
    command: '',
    args: '',
    url: '',
    autoStart: false,
    enabled: true
  })

  const loadServers = async () => {
    try {
      const [list, statusList] = await Promise.all([
        window.aela.mcp.list(),
        window.aela.mcp.status()
      ])
      setServers(list)
      setStatuses(statusList)
    } catch (err: unknown) {
      setError(`加载 MCP 服务器失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  useEffect(() => {
    loadServers()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) { setError('请填写服务器名称'); return }
    if (formData.transport === 'stdio' && !formData.command) { setError('stdio 模式需要填写命令'); return }
    if (formData.transport === 'http' && !formData.url) { setError('http 模式需要填写 URL'); return }

    try {
      const config: Omit<MCPServerConfig, 'id' | 'createdAt'> = {
        name: formData.name,
        transport: formData.transport,
        command: formData.transport === 'stdio' ? formData.command : undefined,
        args: formData.transport === 'stdio' && formData.args ? formData.args.split(' ') : undefined,
        url: formData.transport === 'http' ? formData.url : undefined,
        autoStart: formData.autoStart,
        enabled: formData.enabled
      }
      await window.aela.mcp.add(config)
      setShowForm(false)
      setFormData({ name: '', transport: 'stdio', command: '', args: '', url: '', autoStart: false, enabled: true })
      loadServers()
    } catch (err: unknown) {
      setError(`添加 MCP 服务器失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleConnect = async (id: string) => {
    setConnecting(id)
    try {
      const status = await window.aela.mcp.connect(id)
      if (!status.connected) {
        setError(`连接失败: ${status.error}`)
      }
      loadServers()
    } catch (err: unknown) {
      setError(`连接失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (id: string) => {
    try {
      await window.aela.mcp.disconnect(id)
      loadServers()
    } catch (err: unknown) {
      setError(`断开失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await dialog.confirm('确定删除这个 MCP 服务器？', { variant: 'danger' })
    if (!confirmed) return
    try {
      await window.aela.mcp.delete(id)
      loadServers()
    } catch (err: unknown) {
      setError(`删除失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const getStatus = (id: string): MCPServerStatus | undefined => {
    return statuses.find(s => s.id === id)
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary">MCP 服务器</h2>
            <p className="text-sm text-text-muted mt-1">Model Context Protocol 服务器管理</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium"
          >
            + 添加服务器
          </button>
        </div>

        {/* 添加表单 */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 bg-surface border border-border rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">服务器名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="如: filesystem"
                className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">传输方式</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.transport === 'stdio'}
                    onChange={() => setFormData({ ...formData, transport: 'stdio' })}
                  />
                  stdio (子进程)
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.transport === 'http'}
                    onChange={() => setFormData({ ...formData, transport: 'http' })}
                  />
                  http (远程)
                </label>
              </div>
            </div>

            {formData.transport === 'stdio' ? (
              <>
                <div>
                  <label className="block text-xs text-text-muted mb-1">命令 *</label>
                  <input
                    type="text"
                    value={formData.command}
                    onChange={(e) => setFormData({ ...formData, command: e.target.value })}
                    placeholder="npx"
                    className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">参数 (空格分隔)</label>
                  <input
                    type="text"
                    value={formData.args}
                    onChange={(e) => setFormData({ ...formData, args: e.target.value })}
                    placeholder="@modelcontextprotocol/server-filesystem /tmp"
                    className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none font-mono"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs text-text-muted mb-1">URL *</label>
                <input
                  type="text"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="http://localhost:3001/mcp"
                  className="w-full bg-bg-primary text-text-primary rounded-lg px-3 py-2 text-sm border border-border focus:border-accent focus:outline-none font-mono"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoStart}
                  onChange={(e) => setFormData({ ...formData, autoStart: e.target.checked })}
                />
                自动启动
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium">添加</button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-surface-hover hover:bg-surface-active text-text-secondary rounded-lg text-sm"
              >
                取消
              </button>
            </div>
          </form>
        )}

        {/* 服务器列表 */}
        <div className="space-y-3">
          {servers.map((server) => {
            const status = getStatus(server.id)
            const connected = status?.connected || false
            return (
              <div key={server.id} className="p-4 bg-surface border border-border rounded-xl">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-500'}`} />
                      <span className="text-sm font-medium text-text-primary">{server.name}</span>
                      <span className="text-xs text-text-muted bg-bg-primary px-2 py-0.5 rounded">
                        {server.transport}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted mt-1 font-mono truncate">
                      {server.transport === 'stdio'
                        ? `${server.command} ${(server.args || []).join(' ')}`
                        : server.url}
                    </div>
                    {connected && status && status.toolCount > 0 && (
                      <div className="mt-2">
                        <div className="text-xs text-text-muted mb-1">{status.toolCount} 个工具:</div>
                        <div className="flex flex-wrap gap-1">
                          {status.tools.slice(0, 5).map((tool) => (
                            <span key={tool.name} className="text-xs bg-bg-primary text-text-secondary px-2 py-0.5 rounded font-mono">
                              {tool.name}
                            </span>
                          ))}
                          {status.tools.length > 5 && (
                            <span className="text-xs text-text-muted">+{status.tools.length - 5}</span>
                          )}
                        </div>
                      </div>
                    )}
                    {status?.error && (
                      <div className="text-xs text-red-400 mt-2">⚠ {status.error}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {connected ? (
                      <button
                        onClick={() => handleDisconnect(server.id)}
                        className="text-xs px-3 py-1.5 bg-surface-hover hover:bg-surface-active rounded-lg text-text-secondary"
                      >
                        断开
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(server.id)}
                        disabled={connecting === server.id}
                        className="text-xs px-3 py-1.5 bg-accent/20 hover:bg-accent/30 rounded-lg text-accent-light disabled:opacity-50"
                      >
                        {connecting === server.id ? '连接中...' : '连接'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(server.id)}
                      className="text-xs px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 rounded-lg text-red-400"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {servers.length === 0 && !showForm && (
            <div className="text-center text-text-muted py-12">
              <div className="text-4xl mb-3">🔌</div>
              <p>暂未配置 MCP 服务器</p>
              <p className="text-xs mt-1">MCP 协议允许接入外部工具服务</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
