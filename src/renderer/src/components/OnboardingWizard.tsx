import { useState, useCallback, type ReactNode } from 'react'
import OnboardingStepModel from './onboarding/OnboardingStepModel'
import OnboardingStepWorkspace from './onboarding/OnboardingStepWorkspace'
import OnboardingStepShortcuts from './onboarding/OnboardingStepShortcuts'
import OnboardingStepPrivacy from './onboarding/OnboardingStepPrivacy'

interface OnboardingWizardProps {
  onComplete: () => void
}

const STEPS = [
  { key: 'model', title: '模型配置', icon: '🤖' },
  { key: 'workspace', title: '工作区', icon: '📁' },
  { key: 'shortcuts', title: '快捷键', icon: '⌨️' },
  { key: 'privacy', title: '隐私声明', icon: '🛡️' },
] as const

const STEPS_CONTENT = [
  <OnboardingStepModel />,
  <OnboardingStepWorkspace />,
  <OnboardingStepShortcuts />,
  <OnboardingStepPrivacy />,
] as const

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const goNext = useCallback(() => {
    setCurrentStep(s => {
      if (s < STEPS.length - 1) return s + 1
      return s
    })
  }, [])

  const goPrev = useCallback(() => {
    setCurrentStep(s => {
      if (s > 0) return s - 1
      return s
    })
  }, [])

  const isLastStep = currentStep === STEPS.length - 1

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg-primary text-text-primary">
      {/* 左侧 Step Indicator */}
      <div className="w-64 bg-bg-secondary border-r border-border flex flex-col">
        <div className="px-6 py-6 border-b border-border">
          <h1 className="text-lg font-bold text-text-primary">欢迎使用 AELA</h1>
          <p className="text-xs text-text-muted mt-1">完成以下步骤即可开始使用</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStep
            const isCompleted = idx < currentStep
            return (
              <div
                key={step.key}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-accent/10 text-accent-light font-medium'
                    : isCompleted
                      ? 'text-text-secondary'
                      : 'text-text-muted'
                }`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isActive
                    ? 'bg-accent text-white'
                    : isCompleted
                      ? 'bg-accent/20 text-accent-light'
                      : 'bg-surface border border-border text-text-muted'
                }`}>
                  {isCompleted ? '✓' : idx + 1}
                </span>
                <span className="text-base">{step.icon}</span>
                <span>{step.title}</span>
              </div>
            )
          })}
        </nav>
        <div className="px-6 py-4 border-t border-border">
          <div className="text-xs text-text-muted">
            步骤 {currentStep + 1} / {STEPS.length}
          </div>
          <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 右侧 Step 内容 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 步骤内容区 */}
        <div className="flex-1 overflow-y-auto">
          {STEPS_CONTENT[currentStep]}
        </div>

        {/* 底部导航按钮 */}
        <div className="shrink-0 border-t border-border bg-bg-secondary/50 px-8 py-4 flex items-center justify-between">
          <button
            onClick={goPrev}
            disabled={currentStep === 0}
            className="px-5 py-2 text-sm text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← 上一步
          </button>
          <div className="flex items-center gap-2">
            {!isLastStep && (
              <button
                onClick={onComplete}
                className="px-4 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                跳过引导
              </button>
            )}
            {!isLastStep ? (
              <button
                onClick={goNext}
                className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
              >
                下一步 →
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="px-5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors"
              >
                开始使用 →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
