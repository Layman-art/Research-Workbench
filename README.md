<div align="center">
  <img src="./desktop/src/assets/logo.png" width="104" alt="Research Workbench logo">
  <h1>Research Workbench · 科研工作台</h1>
  <p><strong>一张桌面，接住科研中的项目、方向、待办与日程。</strong></p>
  <p>Windows x64 · macOS Apple Silicon · 本地优先</p>
</div>

## v2.0.0：统一桌面版

Windows 与 macOS 现在共用 `desktop/` 下的 **Tauri 2 + SQLite** 实现，后续功能在两个平台同步维护。旧 Electron 版停止迭代，原 macOS 实现已迁入 `desktop/`。感谢 [Zhong0118 的 macOS 适配贡献](https://github.com/Layman-art/Research-Workbench/pull/1)，为这次统一提供了基础。

- **写完有保障**：保存中、成功与失败反馈；失败保留正文并可重试；自动保存草稿，支持恢复未命名笔记和展开长文编辑。
- **数据可恢复**：每日自动数据库备份，保留最近 30 份；删除进入回收站，保留 30 天；提供导入预览、手动备份与恢复。
- **常驻更稳定**：跨午夜自动更新日期，睡眠唤醒或切回窗口后重新校准；修复工作区新建、计数与清空已完成的作用范围。
- **减少无谓开销**：SQLite 事务持久化、细粒度状态订阅、草稿防抖合并写入、轻量字体与渐进加载列表。
- **科研信息连起来**：Markdown 编辑预览、全局搜索、项目看板、记录关联项目、本地文件及文件夹引用、周报和月报 Markdown 导出。
- 支持循环待办、系统通知、批量操作、文献 DOI、深色主题、减少动效、托盘驻留与开机自启。

具体变化见 [更新日志](./CHANGELOG.md)。安装包体积以实际发布资产为准，尚不宣称实测内存降幅。

## 安装与升级

从 [GitHub Releases](https://github.com/Layman-art/Research-Workbench/releases/latest) 下载对应版本：Windows x64 安装程序 `.exe`，或 macOS Apple Silicon 镜像 `.dmg`。普通用户无需安装 Node.js 或 Rust。macOS 打开镜像后将应用拖入「应用程序」。

安装包尚未完成 Windows 代码签名或 macOS Developer ID 签名与公证，系统可能显示安全提示。请只从官方 Releases 下载，并核对发布资产的 SHA-256。

### 从旧 Windows 版迁移

1. 先打开旧版，在「设置与数据」中导出 JSON 备份，另存一份。
2. 安装并打开 v2.0.0，在数据管理中选择导入该 JSON。
3. 查看导入预览，确认记录和工作区后再执行导入。导入会替换新版当前数据，请先备份已有内容。
4. 核对笔记、待办及日程后再决定是否卸载旧版。新版不会删除旧 Electron 数据目录，也不会直接读取其 localStorage。

### 从旧 macOS 版升级

保留相同应用标识，继续使用原数据目录；升级前自动创建数据库备份，再迁移已有数据。仍建议先手动导出 JSON，升级后核对内容。

## 数据与隐私

无需账号，核心功能离线可用。数据保存在本机 SQLite 中；每日快照包含记录、草稿与回收站。活动历史保留 366 天。文件引用只记录路径，不复制原文件；换机后可能需要重新选择路径。

JSON 用于跨版本迁移与可移植备份，草稿恢复请使用数据库快照。备份和数据库均未作应用层加密，也不提供云同步。自动备份与原库在同一设备上，重要数据还应另存到其他存储介质。详见 [隐私说明](./desktop/PRIVACY.md)。

## 本地开发

推荐 **Node.js 24、npm 与 Rust stable**。Windows 原生构建需要 Visual Studio Build Tools 的 C++ 桌面开发组件、Windows SDK 和 WebView2；macOS 需要 Xcode Command Line Tools。

在仓库根目录执行：

```bash
npm ci
npm run dev:desktop
```

浏览器预览使用 `npm run dev`，仅供界面开发，不具备原生备份、系统通知及文件引用能力。

```bash
npm run check
npm run test:e2e
npm run dist:win
# 在 macOS 上构建：
npm run dist:mac
```

这是 npm workspace 项目；例如单独检查桌面包可运行 `npm run check --workspace desktop`。完整开发与数据格式说明见 [desktop/CONTRIBUTING.md](./desktop/CONTRIBUTING.md)。

## 项目结构

```text
desktop/src/        两个平台共用的 React + TypeScript 界面与业务逻辑
desktop/src-tauri/  Tauri 原生集成、SQLite、备份与托盘
desktop/src/test/   单元测试与组件回归测试
docs/releases/     公开版本说明
docs/assets/       历史界面截图
```

旧链接中的 `macos/` 开发资料现位于 [`desktop/`](./desktop/README.md)。历史 Electron 源码可从旧版本 Git 标签查看，不再作为当前构建入口。

欢迎提交 [Issue](https://github.com/Layman-art/Research-Workbench/issues) 或 Pull Request，请勿附上未脱敏科研数据。项目采用 [MIT License](./LICENSE)，第三方许可证见 [desktop/THIRD_PARTY_NOTICES.md](./desktop/THIRD_PARTY_NOTICES.md)。
