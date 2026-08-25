# 第三方软件声明

Research Workbench 使用以下主要开源组件。完整依赖版本记录在 `package-lock.json` 中；直接运行组件的原始许可证文本保存在 [`licenses/`](./licenses/) 中，并随桌面发行版分发。

| 组件 | 版本 | 用途 | 许可证文本 |
| --- | --- | --- | --- |
| React | 19.2.8 | 用户界面 | [MIT](./licenses/react.txt) |
| React DOM | 19.2.8 | 用户界面 | [MIT](./licenses/react-dom.txt) |
| Zustand | 5.0.15 | 本地状态管理 | [MIT](./licenses/zustand.txt) |
| clsx | 2.1.1 | CSS 类名组合 | [MIT](./licenses/clsx.txt) |
| Lucide React | 0.468.0 | 界面图标 | [ISC](./licenses/lucide-react.txt) |
| Inter | 5.3.0 | 西文字体 | [SIL Open Font License 1.1](./licenses/inter-OFL.txt) |
| Source Serif 4 | 5.3.0 | 西文衬线字体 | [SIL Open Font License 1.1](./licenses/source-serif-4-OFL.txt) |
| Noto Serif SC | 5.3.0 | 简体中文衬线字体 | [SIL Open Font License 1.1](./licenses/noto-serif-sc-OFL.txt) |
| Electron | 43.4.0 | Windows 桌面运行时 | [MIT](./licenses/electron.txt)，并包含 Chromium、Node.js 等第三方组件 |

Electron 构建产物还自带 `LICENSE.electron.txt` 和 `LICENSES.chromium.html`。构建与测试使用 TypeScript、Vite、Vitest、Playwright、ESLint 和 electron-builder；它们适用各自的软件许可证。

本项目的许可证不改变上述第三方组件各自的许可证和版权归属。
