# Research Workbench Tauri 重构与功能升级设计

**日期：** 2026-08-17  
**状态：** 已确认，实施计划已编写  
**目标用户：** 单一用户、Apple Silicon Mac  
**包管理器：** pnpm  
**运行时基线：** Node.js 22 LTS

## 1. 背景与目标

Research Workbench 当前使用 React、TypeScript、Zustand、Vite 与 Electron。业务源码规模不大，但存在三项基础问题：全部记录同步写入 `localStorage`、大量组件订阅完整 Zustand 状态、字体构建产物过大。与此同时，科研记录缺少 Markdown，项目、待办和提醒尚未形成完整工作流，macOS 也没有可安装发行版。

本次升级先完成工程和性能治理，再迁移到 Tauri 2 与 SQLite，随后分批实现写作体验、科研工作流、macOS 原生能力和安装交付。项目只面向个人 Apple Silicon Mac，不承担 Windows、Linux、Intel Mac、多人协作或云同步需求。

## 2. 总体架构

```text
React 界面
   ↓
Zustand UI 状态与领域操作
   ↓
Repository 数据接口
   ↓
Tauri Commands / Plugins
   ↓
SQLite 数据库
```

架构约束：

- 使用 pnpm，删除 npm 锁文件，固定 Node.js 22 LTS。
- React 页面不直接访问 SQLite、Tauri API 或 `localStorage`。
- Zustand 只负责界面状态、缓存和业务操作，不承担持久化职责。
- 所有持久化通过 Repository 接口完成，以便隔离 Tauri 并支持测试。
- Tauri 负责窗口、托盘、自启、通知、Dock 角标和文件导出。
- SQLite 保存记录、类型、工作区、关联关系、周期规则、设置和通知投递状态。
- 不保留 Electron 与 IndexedDB 双实现；Tauri 迁移完成后删除 Electron。
- 第一版只构建 Apple Silicon arm64 `.app` 与 `.dmg`。
- 不迁移现有 `localStorage` 内容，因为当前没有需要保留的真实数据。

## 3. 工程与性能基线

第一阶段完成以下治理：

- 统一 pnpm 和 `pnpm-lock.yaml`，删除 `package-lock.json`。
- 通过版本文件和 `package.json` engines 固定 Node.js 22 LTS。
- 修复 Vitest 环境，安装并跑通 Playwright 所需浏览器。
- 将无选择器的 `useStore()` 调用改为细粒度 selector。
- 将搜索、统计、过滤和排序提取为稳定的派生 selector。
- 只让记录卡片订阅自身需要的数据和操作，单条更新不刷新无关卡片。
- 减少 Inter、Source Serif 4 与 Noto Serif SC 的字重和字符集；中文优先使用 macOS 系统字体。
- 记录优化前后的字体体积、前端产物体积、冷启动和主要交互表现。

不在此阶段加入列表虚拟化、搜索索引或后台 Worker。个人使用规模按 50 条记录验收，只有实测证明仍有瓶颈时才增加复杂度。

## 4. 数据模型

### 4.1 SQLite 表

- `records`：标题、Markdown 正文、类型、工作区、状态、优先级、日期、排序、归档、星标、创建时间和更新时间。
- `record_fields`：记录的自定义字段，按记录外键关联。
- `types`：内置与自定义记录类型。
- `workspaces`：工作区。
- `settings`：主题、动效、显示名、自启、托盘和提醒设置。
- `notification_deliveries`：已投递提醒的唯一标识和投递时间，用于防止重复通知。
- `literature_details`：文献记录的作者、年份、DOI、链接和阅读状态。
- `drafts`：编辑器按记录或新建会话保存的临时草稿和更新时间，正式保存或主动丢弃后删除。

### 4.2 关联与周期规则

- 待办通过可空的 `project_id` 关联项目。
- 删除项目时使用 `ON DELETE SET NULL`，保留待办并解除关联。
- 周期频率限定为无、每天、每周、每月，并保存正整数间隔。
- 完成周期待办时，在同一数据库事务中完成当前实例并生成下一实例。
- 月度重复采用目标日规则；若目标月份没有该日期，则使用该月最后一天。
- 不回补完成前错过的多期实例，只生成下一次未来实例。

### 4.3 Markdown 与导出

- 正文只保存原始 Markdown，不保存渲染后的 HTML。
- Markdown 预览禁止原始 HTML、脚本与危险 URL。
- JSON 是完整备份格式；Markdown、CSV 和 HTML 是便携导出格式。
- 导出读取数据库一致性快照，不受当前页面筛选状态影响。

## 5. 功能分期

### 5.1 Tauri 与 SQLite 基础

- 创建 Tauri 2 应用壳并复用现有 React 前端。
- 建立 Repository、SQLite schema migration 和初始示例数据。
- 将窗口控制、托盘、自启和外部链接能力迁移到 Tauri 平台适配层。
- 删除 Electron 主进程、预加载桥和 Electron 构建配置。

### 5.2 核心写作与视觉体验

- 正文支持 Markdown“编辑 / 预览”切换。
- 支持标题、粗体、列表、链接、表格、代码块和任务列表。
- 列表摘要从 Markdown 提取纯文本，不直接显示标记字符。
- 外部链接交给系统浏览器打开。
- 编辑器存在未保存内容时，关闭、按 Escape 或点击遮罩均需要确认。
- 自动保存临时草稿，崩溃重启后提供恢复选择。
- 提供浅色、深色“月夜模式”和跟随系统三种主题。
- 支持 `prefers-reduced-motion` 与应用内动效开关。
- 漂浮音符默认更慢、更淡；关闭动效时完全静止。
- 中文正文行高设为 1.75，优化长标题断行、等宽日期数字和中西文间距。
- 增加 Markdown、CSV、HTML 导出，保留 JSON 完整备份与恢复。

### 5.3 科研工作流

- 科研项目支持列表与看板两种视图。
- 看板按待开始、进行中、已搁置和已完成分列。
- 项目卡片跨列拖拽时直接更新状态。
- 待办可以选择所属项目。
- 项目卡片显示未完成的“下一步行动”。
- 待办支持每天、每周和每月重复。
- 记录支持多选，并可批量归档、删除、移动工作区或关联项目。
- 增加轻量“文献”记录类型，包含作者、年份、DOI、链接和待读/在读/已读状态。
- DOI 和文献链接通过系统浏览器打开，不尝试替代 Zotero 或管理文献附件。

### 5.4 macOS 原生体验

- 使用 Tauri 托盘驻留和开机启动。
- 到期和过期待办发送系统原生通知。
- 通知具备去重、重启恢复和权限状态提示。
- 点击通知后打开应用并定位对应待办。
- Dock 角标显示过期且未完成的待办数量。
- 月相图悬停显示类型和数量，点击扇区跳转对应记录类型。
- 待办完成时淡出并平滑收起。
- 看板和列表拖拽时使用卡片让位动画。
- 所有持续动画和交互动画遵守减少动态效果设置。

### 5.5 macOS 安装交付

- 使用符合 macOS 规范的窗口标题栏和交通灯按钮。
- 提供 `.icns` 图标。
- 构建 Apple Silicon arm64 `.app` 与 `.dmg`。
- 第一版支持个人本机安装；保留未来配置 Developer ID 签名和 Apple notarization 的入口。
- 文档说明安装、升级、备份、恢复和 SQLite 数据目录。

## 6. 组件边界

- `domain/`：记录、项目、待办、周期和文献的纯业务类型与规则。
- `repositories/`：定义数据读取、写入、事务和导出接口。
- `stores/`：按记录、筛选和设置拆分 Zustand 状态与操作。
- `features/markdown/`：Markdown 编辑、预览、摘要和安全链接。
- `features/projects/`：项目列表、看板和下一步行动。
- `features/todos/`：待办、周期生成和批量操作。
- `features/literature/`：文献字段、阅读状态和外部链接。
- `features/export/`：JSON、Markdown、CSV 和 HTML 导出。
- `platform/`：Tauri 窗口、托盘、通知、角标、自启和文件对话框适配。
- `src-tauri/`：SQLite commands、通知调度和 macOS 打包配置。

当前较大的 `store.ts` 与 `styles.css` 随相关功能逐步拆分，不进行与上述目标无关的大规模重构。

## 7. 数据流

1. 应用启动时执行 SQLite schema migration。
2. Repository 加载初始数据，并将界面所需数据写入细粒度 store。
3. 编辑器在组件内部维护草稿，保存时通过 Repository 执行一次数据库事务。
4. 数据库成功写入后更新 store；失败时保留草稿并显示可操作的错误信息。
5. 完成周期待办时，在同一事务中完成当前实例并生成下一实例。
6. 后台调度器查询到期事项，并通过 `notification_deliveries` 防止重复发送。
7. 导出服务读取数据库一致性快照并写入用户选择的位置。

## 8. 异常处理与数据保护

- SQLite 写入失败时不得关闭编辑器或丢弃草稿。
- 草稿恢复成功后，由用户决定继续编辑或丢弃。
- 删除项目不会删除关联待办。
- 批量删除显示准确条数并要求二次确认。
- JSON 导入采用完整校验、单事务写入和成功后替换流程。
- 数据库 schema 升级前自动创建本地备份。
- 通知权限被拒绝时只显示状态和手动开启指引，不反复请求。
- Markdown 预览不执行用户输入的 HTML 或脚本。
- 数据库无法打开时进入只读错误页，并提供打开数据目录和导出诊断信息的入口。

## 9. 性能验收

使用包含 50 条记录、长 Markdown、自定义字段、项目关联和周期待办的固定测试数据：

- 搜索逐键输入没有可感知卡顿。
- 切换普通列表、看板和总览不阻塞交互。
- 更新单条记录不重渲染全部无关卡片。
- 字体资源显著低于当前约 23 MB，并记录最终数字。
- 记录 Tauri arm64 应用体积、DMG 体积、冷启动时间和常驻内存。
- 不把主观“感觉更快”作为唯一验收依据。

## 10. 测试与质量门槛

- 领域单元测试覆盖周期日期、项目关联、Markdown 摘要和导出格式。
- Repository 集成测试覆盖事务、外键、schema migration 和导入回滚。
- React 组件测试覆盖编辑/预览、主题、批量选择和未保存保护。
- Playwright 覆盖新建 Markdown 笔记、看板拖拽、项目关联待办和导出。
- Rust 测试覆盖 SQLite commands、通知去重和角标计数。
- macOS 人工验收覆盖托盘、自启、通知点击、Dock 角标和 DMG 安装。
- 每个阶段完成后运行 lint、单元测试、E2E、前端生产构建和 Tauri 构建。
- 未通过当前阶段质量门槛时，不开始下一阶段。

## 11. 非目标

- 云同步、账号和多人协作。
- Windows、Linux 和 Intel Mac 发行版。
- 完整富文本编辑器或所见即所得编辑器。
- Zotero 替代品、PDF 管理和引文格式化系统。
- 任意复杂 iCalendar RRULE 周期规则。
- 在 50 条个人数据规模下提前引入虚拟列表、全文检索服务或后台 Worker。

## 12. 实施顺序

1. pnpm、Node 22、测试、Zustand selector 和字体优化。
2. Repository 边界、领域模型和 SQLite schema。
3. Tauri 2 应用壳、SQLite 接入和 Electron 删除。
4. Markdown、草稿保护、主题、动效控制和多格式导出。
5. 看板、项目下一步行动、周期待办、批量操作和文献记录。
6. 通知、Dock 角标、月相交互和列表动画。
7. arm64 `.app`、`.dmg`、安装文档和最终验收。
