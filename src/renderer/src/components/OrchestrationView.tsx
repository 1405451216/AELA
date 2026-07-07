// 多 Agent 编排视图 — Tab 容器
// 基础编排 / DAG 调度 / 协作模式 / 监督者池 / 动态拓扑
import { useState } from 'react'
import { useT } from '../i18n'
import BasicOrchestrationTab from './orchestration/BasicOrchestrationTab'
import DAGSchedulerTab from './orchestration/DAGSchedulerTab'
import CollaborationTab from './orchestration/CollaborationTab'
import SupervisorTab from './orchestration/SupervisorTab'
import DynamicDAGTab from './orchestration/DynamicDAGTab'

type OrchTab = 'basic' | 'dag' | 'collab' | 'supervisor' | 'ddag'

const TAB_INFO: Record<OrchTab, { label: string; icon: string }> = {
  basic: { label: '基础编排', icon: '🔀' },
  dag: { label: 'DAG 调度', icon: '📊' },
  collab: { label: '协作模式', icon: '💬' },
  supervisor: { label: '监督者池', icon: '👷' },
  ddag: { label: '动态拓扑', icon: '🕸️' },
}

export default function OrchestrationView() {
  const t = useT()
  const [activeTab, setActiveTab] = useState<OrchTab>('basic')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部工具栏 */}
      <div className="px-6 py-3 border-b border-border bg-bg-secondary/50">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-text-primary">{t('orch.title')}</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-500 border border-yellow-500/20 font-medium">Beta</span>
        </div>
        <p className="text-xs text-text-muted mt-0.5">{t('orch.description')}</p>
      </div>

      {/* Tab 栏 */}
      <div className="flex items-center gap-1 px-6 py-2 border-b border-border bg-bg-secondary/30">
        {(Object.keys(TAB_INFO) as OrchTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-accent/10 text-accent-light border border-accent/30'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent'
            }`}
          >
            <span>{TAB_INFO[tab].icon}</span>
            <span>{TAB_INFO[tab].label}</span>
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {activeTab === 'basic' && <BasicOrchestrationTab />}
      {activeTab === 'dag' && <DAGSchedulerTab />}
      {activeTab === 'collab' && <CollaborationTab />}
      {activeTab === 'supervisor' && <SupervisorTab />}
      {activeTab === 'ddag' && <DynamicDAGTab />}
    </div>
  )
}
