# Research Workbench · 科研工作台

<div align="center">

<img src="./src/assets/logo.png" width="104" alt="Research Workbench logo">

**一张桌面，接住科研中的项目、方向、待办与日程。**

A local-first macOS desktop organizer for research projects, directions, tasks, schedules, and notes.

<a href="https://github.com/Zhong0118/Research-Workbench/releases/latest"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/Zhong0118/Research-Workbench?display_name=tag&style=flat-square&color=D9A441"></a>
<a href="https://github.com/Zhong0118/Research-Workbench/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/Zhong0118/Research-Workbench/ci.yml?branch=macos-support&style=flat-square&label=checks"></a>
<img alt="macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-8E8E93?style=flat-square&logo=apple&logoColor=white">
<img alt="Local first" src="https://img.shields.io/badge/data-local--first-6B705C?style=flat-square">
<a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-2F6F6D?style=flat-square"></a>
<a href="https://github.com/Zhong0118/Research-Workbench/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/Zhong0118/Research-Workbench/total?style=flat-square&label=downloads"></a>

<a href="https://github.com/Zhong0118/Research-Workbench/releases/latest"><img alt="下载 macOS arm64 镜像" src="https://img.shields.io/badge/%E4%B8%8B%E8%BD%BD_macOS_arm64-%E7%A7%91%E7%A0%94%E5%B7%A5%E4%BD%9C%E5%8F%B0-D9A441?style=for-the-badge&logo=apple&logoColor=white"></a>

<a href="#快速开始">快速开始</a> ·
<a href="#功能一览">功能一览</a> ·
<a href="#界面预览">界面预览</a> ·
<a href="#数据与隐私">数据与隐私</a> ·
<a href="#本地开发">参与开发</a>

</div>

> 这是 [Zhong0118](https://github.com/Zhong0118) 对 [Layman-art/Research-Workbench](https://github.com/Layman-art/Research-Workbench) 的 **macOS 适配 fork**：将原项目的 Electron/Windows 实现迁移至 Tauri 2，面向 Apple Silicon 构建原生 macOS 应用，并完善了科研方向、项目、待办、日程、文献等研究工作流。预构建安装包见 [Releases](https://github.com/Zhong0118/Research-Workbench/releases/latest)。

<p align="center">
  <img src="./docs/assets/dashboard.png" width="100%" alt="Research Workbench 工作台总览">
</p>

## 为什么做 Research Workbench？

科研信息很容易散落在项目表、日历、待办软件和零碎笔记中：项目进行到哪一步、当前主攻什么方向、下一个截止日期是什么，往往需要在多个地方反复查找。

Research Workbench 不试图替代文献管理器、实验平台或文件系统。它更像一张始终放在桌面的科研控制台，把每条研究线索的当前状态、背景记录和下一步行动放回同一个上下文中。

| 常见的碎片化状态 | Research Workbench 中 |
| --- | --- |
| 纵向、横向项目分散在不同表格 | 在「科研项目」中按纵向 / 横向统一分组 |
| 研究方向只有标题，缺少过程记录 | 用正文、自定义字段和主次方向持续维护 |
| 待办、截止日期和日程彼此割裂 | 待办分组、周日程和总览提醒集中呈现 |
| 数据位置、心得与复盘散落 | 用可定制的记录类型统一登记 |
| 不希望科研数据默认上云 | 本机存储，并支持手动导出 JSON 备份 |

## 功能一览

### 🧭 项目与研究方向

- 科研项目按纵向 / 横向分类展示，支持列表与四状态看板切换
- 待开始、进行中、已搁置、已完成等状态
- 主要方向标记、正文记录和自定义字段（字段名带语义图标、正文折叠到固定高度）
- 卡片拖拽排序，以及记录编辑、复制、归档与恢复

### ✅ 待办与日程

- 快速创建待办，支持「我的一天 / 重要 / 全部 / 已完成」分组
- 优先级、截止日期和过期提示
- 周视图、起止时间与后续日程清单
- 总览直接显示本周安排与到期提醒

### 🗂️ 灵活的科研记录

- 内置心得笔记、数据记录、文件资料和复盘总结
- 轻量文献笔记：作者、年份、DOI、链接与阅读状态
- 搜索标题、正文与自定义字段
- 自定义通用类型或待办类型，用工作区区分课题组、个人等不同环境

### 🔒 本地优先

- 无需账号，核心功能可离线使用
- 数据自动保存在本机 SQLite 数据库
- JSON 备份导出与恢复
- macOS 菜单栏托盘驻留与开机自启

## 界面预览

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/assets/projects.png" alt="科研项目">
      <br><sub>科研项目：纵向 / 横向分类、状态与自定义字段</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/assets/directions.png" alt="科研方向">
      <br><sub>科研方向：主次方向、字段图标与正文折叠</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/assets/todo.png" alt="待办事项">
      <br><sub>待办事项：分组、优先级与截止日期</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/assets/schedule.png" alt="日程安排">
      <br><sub>日程安排：周视图与起止时间</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/assets/literature.png" alt="文献笔记">
      <br><sub>文献笔记：作者、DOI 与阅读状态</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/assets/settings.png" alt="设置与数据">
      <br><sub>内容类型、工作区、JSON 备份与桌面启动设置</sub>
    </td>
  </tr>
</table>

## 快速开始

1. 从 [GitHub Releases](https://github.com/Zhong0118/Research-Workbench/releases/latest) 下载 `Research Workbench_1.0.11_aarch64.dmg`。
2. 双击打开磁盘映像，把 `Research Workbench.app` 拖入「应用程序」文件夹。普通用户无需安装 Node.js。
3. 首次启动会载入一组可编辑的科研示例数据，可以先用它熟悉项目、待办与日程。
4. 正式使用后，建议定期在「设置与数据 → 数据管理」中导出 JSON 备份。

默认情况下，关闭主窗口后应用仍会驻留菜单栏托盘。需要彻底退出时，可点击菜单栏托盘图标选择「退出」，也可以在设置中关闭后台运行。

> [!IMPORTANT]
> 当前 macOS 安装包为个人本地构建，尚未进行 Developer ID 签名与公证，首次打开可能被 Gatekeeper 拦截。请只从本仓库的 Releases 页面下载，并在安装前核对发布说明中的 SHA-256。首次启动时，在 Finder 中右键应用选择「打开」，或在「系统设置 → 隐私与安全性」中选择「仍要打开」。

在终端中校验安装包：

```bash
shasum -a 256 Research\ Workbench_1.0.11_aarch64.dmg
```

## 数据与隐私

Research Workbench 当前没有账号系统或云同步。项目、记录、内容类型、工作区和显示名保存在本机 SQLite 数据库中；开机自启与托盘设置保存在 Tauri 应用数据目录。

JSON 备份需要手动导出。当前版本不提供自动备份、跨设备同步或应用层加密，因此换机、重装或处理重要数据前，请先导出备份。

<details>
<summary><strong>当前版本的能力边界</strong></summary>

- 仅提供 macOS（Apple Silicon）发行版。
- 面向单机、单用户场景，不含云同步和实时协作。
- 「文件资料」用于记录文件位置和说明，不托管文件本体。
- 暂无自动备份、自动更新和应用层数据加密。

</details>

## 本地开发

环境要求：Apple Silicon Mac、Node.js 22.12–22.x、pnpm 11、Rust stable 与 Xcode Command Line Tools。

```bash
git clone https://github.com/Zhong0118/Research-Workbench.git
cd Research-Workbench
pnpm install
pnpm dev:desktop
```

浏览器预览：

```bash
pnpm dev
```

质量检查：

```bash
pnpm run lint
pnpm test
pnpm run test:e2e
pnpm build
```

构建 macOS 应用与 DMG：

```bash
pnpm dist
```

## 技术栈

- Tauri 2 + Rust
- React 19 + TypeScript + Vite
- Zustand
- SQLite
- Vitest + Playwright

## 项目结构

```text
src-tauri/         Tauri 主进程、SQL 事务桥与 macOS 桌面集成
src/               React + TypeScript 应用源码
src/components/    总览、记录、待办、日程、编辑器与设置
src/test/          单元测试与端到端测试
scripts/           应用图标与截图脚本
docs/assets/       README 展示图片
licenses/          随发行版分发的第三方许可证文本
```

## 参与贡献

欢迎提交 Issue 或 Pull Request。本项目是 [Layman-art/Research-Workbench](https://github.com/Layman-art/Research-Workbench) 的 macOS 适配 fork，开始之前请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。隐私与安全说明见 [PRIVACY.md](./PRIVACY.md) 和 [SECURITY.md](./SECURITY.md)。

## 开源许可证

Research Workbench 采用 [MIT License](./LICENSE) 开源。第三方组件的许可证与版权说明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## 更新日志

版本变化见 [CHANGELOG.md](./CHANGELOG.md)，可安装文件与校验值见 [Releases](https://github.com/Zhong0118/Research-Workbench/releases)。

与上游 [Layman-art/Research-Workbench](https://github.com/Layman-art/Research-Workbench) 的差异见 [PR #1](https://github.com/Layman-art/Research-Workbench/pull/1)。
