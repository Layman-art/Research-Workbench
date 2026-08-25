# 第三方软件声明

Research Workbench macOS 版使用以下主要开源组件。前端与 Rust 的完整依赖版本分别记录在 `pnpm-lock.yaml` 和 `src-tauri/Cargo.lock` 中；主要运行时组件的许可证文本保存在 [`licenses/`](./licenses/) 中，并随桌面发行版分发。

| 组件 | 版本 | 用途 | 许可证文本 |
| --- | --- | --- | --- |
| React | 19.2.8 | 用户界面 | [MIT](./licenses/react.txt) |
| React DOM | 19.2.8 | 用户界面 | [MIT](./licenses/react-dom.txt) |
| Zustand | 5.0.15 | 本地状态管理 | [MIT](./licenses/zustand.txt) |
| clsx | 2.1.1 | CSS 类名组合 | [MIT](./licenses/clsx.txt) |
| Lucide React | 0.468.0 | 界面图标 | [ISC](./licenses/lucide-react.txt) |
| Inter | 5.3.0 | 西文字体 | [SIL Open Font License 1.1](./licenses/inter-OFL.txt) |
| Source Serif 4 | 5.3.0 | 西文衬线字体 | [SIL Open Font License 1.1](./licenses/source-serif-4-OFL.txt) |
| Tauri 2 与官方插件 | 2.x | macOS 桌面运行时、窗口与系统集成 | [MIT](./licenses/tauri-and-plugins.txt) |
| SQLx | 0.8.x | SQLite 数据访问 | [MIT](./licenses/sqlx.txt) |

其他直接与间接依赖包括 Tauri plugins、React Markdown、Remark/Rehype、dnd-kit、TypeScript、Vite、Vitest、Playwright 与 ESLint；其精确版本和依赖关系以锁文件为准，并适用各自的开源许可证。

本项目的许可证不改变上述第三方组件各自的许可证和版权归属。
