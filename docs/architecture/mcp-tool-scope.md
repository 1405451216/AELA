// MCP 工具调用范围限制说明
// MCP 工具调用走 MCP 客户端 RPC（stdio/http），不经过 SecurityService Sandbox
//
// 调用链：Agent → ToolManager.execute() → MCPToolAdapter.execute()
//                                      → mcpClient.callTool()
//
// 安全依赖：
// 1. MCP 服务器由用户显式配置（信任源）
// 2. MCP 工具 scope 限定为配置的工具集合
// 3. stdio 模式：工具执行在子进程/宿主，不受渲染进程沙箱约束
//
// 与 shell 命令的区别：
// - shell 命令（execute_command）：走 SecurityService + CommandGuard + HITL 确认
// - MCP 工具：无 ACL 检查，信任配置的 MCP 服务器
//
// 风险：恶意 MCP 服务器可能返回恶意工具定义
// 缓解：仅允许用户显式添加的 MCP 服务器（非自动发现）
