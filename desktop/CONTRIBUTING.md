# 参与贡献

## 问题反馈

请注明操作系统、应用版本、复现步骤和实际结果。保存问题请附上界面错误文字，并说明是否能从草稿恢复。公开 Issue 中请勿上传未脱敏课题资料、完整数据库、私密路径或密钥。

## 开发环境

推荐 Node.js 24、npm、Rust stable。Windows 需要 Visual Studio Build Tools 的「使用 C++ 的桌面开发」、Windows SDK 及 WebView2；macOS 需要 Xcode Command Line Tools。

在仓库根目录执行，使用根目录的 npm lockfile：

```bash
npm ci
npm run dev:desktop
```

这是 npm workspace 项目，`desktop/` 是唯一桌面实现。不要在根目录恢复 Electron 构建，也不要单独生成 pnpm lockfile。

```bash
npm run check
npm run test:e2e:install --workspace desktop
npm run test:e2e
cargo test --manifest-path desktop/src-tauri/Cargo.toml
npm run size
```

`npm run check` 包含 ESLint、Vitest 与前端生产构建。端到端测试使用 Playwright；原生窗口、系统通知、备份和安装升级还需要对应系统上的验证。浏览器预览适配器不能代替 SQLite 或原生测试。

原生构建在目标系统执行：Windows 使用 `npm run dist:win`，macOS 使用 `npm run dist:mac`。构建产物位于 `desktop/src-tauri/target/release/bundle/`。

## 数据与生命周期约定

- **JSON 导出格式版本为 3，SQLite schema 版本为 2**。两者是独立版本序列：前者约束交换格式，后者控制数据库迁移，不应为了数值一致而修改。
- 导入必须经过统一校验、默认值补齐和旧类型迁移；包含附件、回收站时间及活动历史的 JSON 应能往返。
- SQLite 提交成功后才更新状态。记录创建使用稳定 ID，失败重试不得重复创建。
- 编辑草稿防抖并合并写入，关闭或替换编辑会话前等待 `flushPendingDrafts()`；原生退出还须等待数据写队列，失败时保留窗口与错误信息。
- 数据库迁移前创建备份。每日快照保留最近 30 份，回收站保留 30 天，活动历史保留 366 天；可移植 JSON 不代替包含草稿的数据库快照。
- 附件是用户选择的本地路径引用，不复制原文件。打开路径须经过原生平台层校验。

## Pull Request

每次修改聚焦一个问题，沿用现有风格。数据保存、迁移、退出和恢复改动须补充故障回归测试；界面修改附截图。描述实际运行的检查及尚未验证的平台，不把浏览器测试结果表述为原生安装验证。

版本发布使用 `v2.0.0` 形式的语义化标签。发布说明放在 `docs/releases/`，不承诺未经测量的安装包体积或内存下降。
