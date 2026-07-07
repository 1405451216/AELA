# Skill 市场设计文档

> 日期: 2026-07-07 | 状态: 已批准待实现

## 问题

Skill 安装全靠手动，无统一入口，用户不知道有哪些可用 skill。

## 方案

**远程注册表 + 本地扫描**：从远程 JSON 索引拉取 skill 列表，联动本地已安装 skill，支持一键安装/卸载/更新。

## 架构

```
SkillMarketView（新 View）
  ┌─────────────────────────────────────────┐
  │  左侧：分类标签（全部/已安裝/可更新/推荐）    │
  │  右侧：卡片网格                            │
  │    ┌─────────┐ ┌─────────┐              │
  │    │ Skill A │ │ Skill B │              │
  │    │ 已安裝   │ │ 安装    │              │
  │    └─────────┘ └─────────┘              │
  └─────────────────────────────────────────┘

SkillCard:
  - 名称 / 描述 / 作者 / 版本
  - 安装量 / 评分（简单星级）
  - 按钮：安装 / 卸载 / 更新
  - 权限声明图标（读取文件 / 执行命令 / 网络）
```

## 数据来源

### 远程注册表

```
GET https://registry.aela.dev/api/v1/skills
→ { skills: [{ id, name, description, author, version, tarballUrl, permissions, downloads, rating }] }
```

- **AELA_REGISTRY_URL** 环境变量可覆盖（企业私有注册表）
- 支持 `file:///path/to/registry.json` 本地注册表（离线场景）

### 本地已安装

```
~/.aela/skills/
  ├── code-review/
  │   ├── SKILL.md
  │   └── skill.json
  └── summarize/
      ├── SKILL.md
      └── skill.json
```

扫描本地目录，与远程列表对比显示状态。

## 安装流程

1. 点击"安装" → 根据 `tarballUrl` 下载 tgz 到临时目录
2. 解压到 `~/.aela/skills/<skill-id>/`
3. 读取 `SKILL.md` + `skill.json`，校验 schema
4. 调用 `SkillScanner.scan()` 重新扫描，通知 SkillService 更新
5. 按钮切换为"已安装"

**版本检查**：已安装的 `skill.json.version` 与远程 `version` 对比，有新版本时显示"更新"按钮。

## 权限声明

`skill.json` 中声明：

```json
{
  "permissions": {
    "files": "read",
    "terminal": "none",
    "network": "registry.aela.dev"
  }
}
```

安装前弹窗显示权限摘要，用户确认后才安装。

## 文件变化

| 文件 | 变化 |
|------|------|
| `src/renderer/src/components/SkillMarketView.tsx` | **新 View** |
| `src/renderer/src/components/skill/SkillCard.tsx` | **新建** |
| `src/renderer/src/components/skill/PermissionDialog.tsx` | **新建** |
| `src/main/services/SkillRegistry.ts` | **新建**：下载/安装/卸载/扫描 skill |
| `src/main/ipc/handlers/skill.ts` | 扩展：新增 `SKILL_MARKET_LIST` / `SKILL_INSTALL` / `SKILL_UNINSTALL` IPC |
| `src/shared/types/skill.ts` | `SkillManifest` 扩展 `permissions` 字段 |
| `views.ts` | 注册 `skillMarket` view |

## 离线模式

- 远程请求失败时自动切换本地列表
- 显示"离线模式"徽章
- 已安装的 skill 仍可正常管理

## 风险

- 远程注册表不可用 → 降级本地 + 错误提示
- skill 安全性 → 安装前显示权限 + 仅支持 tarball 签名校验（v1 简化：仅提示）
- `~/.aela/skills/` 目录不存在 → 首次使用时自动创建

## 测试策略

1. 验证远程 skill 列表展示
2. 验证安装流程（下载 → 解压 → 扫描 → IPC 通知）
3. 验证版本对比逻辑（已安装 vs 远程）
4. 验证离线模式降级
5. 验证权限弹窗显示
