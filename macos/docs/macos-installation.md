# macOS 安装、升级与数据说明

Research Workbench 当前面向 Apple Silicon Mac（M1/M2/M3/M4 系列），使用 Tauri 2 构建。应用本身不需要联网，也不要求安装 Node.js。

## 使用 DMG 安装

1. 双击 `Research Workbench_1.0.11_aarch64.dmg`。
2. 将 `Research Workbench.app` 拖到映像中的 `Applications` 文件夹。
3. 推出磁盘映像。
4. 第一次打开时，在 Finder 的“应用程序”中右键应用并选择“打开”。
5. 如果 macOS 仍然阻止启动，前往“系统设置 → 隐私与安全性”，确认应用来源后选择“仍要打开”。

本地个人构建没有 Developer ID 签名和 Apple 公证，因此不要绕过安全提示运行来源不明的副本。正式分发给其他人前应完成签名与公证。

## 从源码构建

需要：

- Apple Silicon Mac
- Xcode Command Line Tools：`xcode-select --install`
- Rust stable
- Node.js 22.12–22.x
- pnpm 11

```bash
pnpm install
pnpm check
pnpm dist
```

生成的应用位于：

```text
src-tauri/target/release/bundle/macos/Research Workbench.app
src-tauri/target/release/bundle/dmg/Research Workbench_1.0.11_aarch64.dmg
```

## 数据位置与备份

SQLite 数据库通常位于：

```text
~/Library/Application Support/com.researchworkbench.desktop/research-workbench.db
```

以“设置与数据 → 数据管理”导出的 JSON 作为主要备份方式。Markdown、CSV 和 HTML 用于阅读、归档或迁移，不建议代替完整 JSON 备份。

退出应用后再复制原始 SQLite 文件；应用运行时直接复制数据库可能遗漏尚未完成的 WAL 写入。

## 升级

1. 先导出 JSON 备份。
2. 完全退出旧版（包括菜单栏托盘进程）。
3. 用新版 `.app` 替换 `/Applications/Research Workbench.app`。
4. 重新打开。数据目录不会因替换应用而删除。

## 卸载

将 `/Applications/Research Workbench.app` 移到废纸篓即可卸载程序。数据会保留，便于以后恢复。

若确定不再需要数据，可在已经导出备份并退出应用后，手动删除：

```text
~/Library/Application Support/com.researchworkbench.desktop/
```

## 常见问题

- 没有通知：在应用设置中启用提醒，再检查“系统设置 → 通知 → Research Workbench”。
- 关闭窗口后仍在运行：这是“关闭窗口时后台运行”设置；从菜单栏图标选择退出可彻底结束。
- Dock 没有数字：只有截止日期早于今天、尚未完成且未归档的待办才计入角标。
- 无法导出文件：重新选择一个当前用户有写入权限的位置。
