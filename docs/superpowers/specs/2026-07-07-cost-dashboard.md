# Token 成本仪表盘设计文档

> 日期: 2026-07-07 | 状态: 已批准待实现

## 问题

用户无感知地消耗 token，月底账单吓一跳。

## 方案

在设置面板加 **"用量 / 成本" Tab**，数据源 `CostTrackerService` 扩展聚合能力。

## 指标维度

| 维度 | 展示 | 说明 |
|------|------|------|
| 今日花费 | 数字 + 折线图（按小时） | $/¥ 单价基于模型 |
| 本月累计 | 数字 + 对比上月 | 从 persisted store 聚合 |
| 按模型分 | 环形图 | GPT-4o/Claude/Ollama 各花多少 |
| 按会话分 | 表格 Top 10 | 哪个会话最贵 |
| Token 数 | input/output 分计 | 模型计费基准 |

## 价格模型

- **API 模型**：按官方定价表（可更新 `pricing.json` 远程拉取）
- **本地模型**（Ollama / 自建）：标注"本地"，不计费，仅报 token 数

## 交互

- 时间切换：日 / 周 / 月
- 告警：日花费超过阈值（用户可设，默认 $5）时黄色 banner 提示
- 数据导出：按钮导出近 90 天 CSV

## 存储

服务：`CostTrackerService` 已有基础统计，新增：

- `UsageRecord { date, modelConfigId, inputTokens, outputTokens, cost }` 持久化到 SQLite
- 聚合查询按日/周/月
- 设置页 store 保留 90 天滚动

## 文件变化

| 文件 | 变化 |
|------|------|
| `src/main/services/CostTrackerService.ts` | 扩展：UsageRecord + 聚合查询 + 告警阈值读 |
| `src/renderer/src/components/settings/UsageCostTab.tsx` | **新建**：设置 Tab 内容（图表 + 表格） |
| `src/renderer/src/components/settings/SettingsView.tsx` | 加 Tab 入口 |
| `src/shared/types/cost.ts` | 扩展 `UsageRecord / CostAggregation` |
| `resources/data/pricing.json` | **新建**：默认价格表 |

## 可视化

- 日折线：recharts line chart，mock 趋势
- 模型环形图：recharts pie
- 表格：top 会话按花费降序，点击跳转

## 风险

- 价格表过时 → 远程校验 + 手动更新
- 采样开销过大 → 仅在有会话变化时写入
- 本地模型无 cost → 显示 "local" 标识，不计入合计

## 测试策略

1. 验证每日聚合正确
2. 验证本地模型不算费
3. 验证超限告警 banner
4. 验证 CSV 导出

