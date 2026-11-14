# Research Workbench 桌面实现

从 v2.0.0 起，本目录是 **Windows x64 与 macOS Apple Silicon 共用的 Tauri 2 + SQLite 实现**，原 `macos/` 路径已迁移至此；旧 Electron 版停止迭代。

安装、功能与旧版迁移说明以 [仓库 README](../README.md) 为准。发布文件见 [GitHub Releases](https://github.com/Layman-art/Research-Workbench/releases/latest)。

## 开发入口

在仓库根目录安装依赖并运行：

```bash
npm ci
npm run dev:desktop
npm run check --workspace desktop
npm run test:e2e --workspace desktop
```

浏览器预览：`npm run dev`。原生安装包：在 Windows 上执行 `npm run dist:win`，在 macOS 上执行 `npm run dist:mac`。需要 Node.js 24、Rust 和相应平台编译工具，详见 [贡献指南](./CONTRIBUTING.md)。

- `src/components/`：总览、记录、日程、编辑器及设置。
- `src/features/`：草稿、备份、搜索、Markdown、导出和通知。
- `src/repositories/`：SQLite 数据访问与迁移。
- `src-tauri/`：原生窗口、托盘、文件引用、备份及退出协调。
- `src/test/`：单元测试、组件测试与端到端测试资料。

[更新日志](./CHANGELOG.md) · [隐私说明](./PRIVACY.md) · [第三方许可证](./THIRD_PARTY_NOTICES.md)
