export default function OnboardingStepPrivacy() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">隐私声明</h2>
        <p className="text-sm text-text-muted mt-1">
          在使用 AELA 之前，请阅读以下隐私声明。
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div className="space-y-3 text-sm text-text-secondary leading-relaxed">
          <h3 className="text-base font-medium text-text-primary">数据收集与使用</h3>
          <p>
            AELA 是一款本地运行的 AI 编码助手。您的代码文件和对话内容 <b className="text-text-primary">始终保存在本地设备</b>，
            不会发送到 AELA 开发者的服务器。
          </p>

          <h3 className="text-base font-medium text-text-primary pt-2">API 通信</h3>
          <p>
            当您配置并使用 AI 模型时，您的对话数据将直接发送到您选择的 AI 服务提供商
            （如 OpenAI、Anthropic、DeepSeek 等）。该通信绕过 AELA 开发者，
            受其各自隐私政策约束。
          </p>

          <h3 className="text-base font-medium text-text-primary pt-2">遥测与诊断</h3>
          <p>
            AELA 可能会收集匿名的使用统计数据和崩溃报告以帮助改进应用。
            您可以在设置中随时禁用遥测。
          </p>

          <h3 className="text-base font-medium text-text-primary pt-2">本地存储</h3>
          <p>
            所有配置、会话历史和 API 密钥（如适用）存储在您的本地设备上。
            API 密钥使用操作系统密钥链进行加密存储（如可用）。
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-sm text-text-secondary">
            点击下方"开始使用"按钮即表示您已阅读并理解上述隐私声明。
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center text-xs text-text-muted">
        <span className="flex items-center gap-1">
          🎉 最后一步！点击"开始使用"启动 AELA
        </span>
      </div>
    </div>
  )
}
