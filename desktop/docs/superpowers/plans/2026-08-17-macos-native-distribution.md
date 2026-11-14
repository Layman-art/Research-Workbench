# macOS Native Features and Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the personal Apple Silicon Mac application with tray residence, auto-launch, reliable native reminders, Dock badge count, native window treatment, and installable arm64 `.app`/`.dmg` artifacts.

**Architecture:** Rust owns lifecycle-sensitive work: tray behavior, close interception, reminder polling, notification dispatch, deep-link-style record focusing, and Dock badge updates. React exposes settings and navigation through typed Tauri commands while SQLite remains the source of truth.

**Tech Stack:** Tauri 2, Rust stable, SQLite, Tauri notification/autostart plugins, macOS arm64 app bundle and DMG, pnpm, Vitest, Cargo tests, Playwright.

## Global Constraints

- Complete `2026-08-17-research-workflows.md` first.
- Target Apple Silicon arm64 only.
- This is a personal local installation; Developer ID signing and notarization are documented but not required for the first local build.
- Reminder payloads must not expose full research-note contents; use title and due date only.
- Notifications must be deduplicated across polling cycles and application restarts.
- Reminders run while the Tauri process is active, including when the window is hidden in the tray. Fully quitting the tray process stops polling until the next launch; auto-launch restores background operation after login.
- The Dock badge counts overdue, incomplete, non-archived todos only.
- The folder currently has no Git metadata. Run commit checkpoints only after a repository is attached or initialized by the user.

---

## File Structure

- `src-tauri/src/tray.rs`: tray creation, menu events, and close-to-tray behavior.
- `src-tauri/src/reminders.rs`: due query, delivery keys, notifications, and polling.
- `src-tauri/src/badge.rs`: overdue count and macOS Dock badge updates.
- `src-tauri/src/settings.rs`: Rust-side settings cache synchronized from SQLite/UI.
- `src-tauri/src/database.rs`: shared app-data SQLite path created during the Tauri migration.
- `src/platform/tauriDesktopPlatform.ts`: typed commands and events.
- `src/features/notifications/NotificationSettings.tsx`: permission/status UI.
- `src/features/notifications/useNotificationNavigation.ts`: opens a record from notification events.
- `src-tauri/icons/`: generated macOS icon set.
- `docs/macos-installation.md`: local installation, upgrade, backup, and troubleshooting.

### Task 1: Implement tray lifecycle and auto-launch

**Files:**
- Create: `src-tauri/src/tray.rs`
- Create: `src-tauri/src/settings.rs`
- Create: `src-tauri/tests/tray_settings.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/platform/tauriDesktopPlatform.ts`
- Modify: `src/components/SettingsView.tsx`

**Interfaces:**
- Produces Tauri commands: `get_desktop_settings`, `set_close_to_tray`.
- Uses plugin autostart for `getAutoLaunch` and `setAutoLaunch`.

- [ ] **Step 1: Write Rust setting tests**

Test that default `close_to_tray` is true, updates are reflected in the shared settings state, and malformed persisted values fall back to defaults without panic.

Run: `cargo test --manifest-path src-tauri/Cargo.toml tray_settings`

Expected: FAIL because the settings module does not exist.

- [ ] **Step 2: Implement tray menu and lifecycle**

Create one tray icon with menu items `显示科研工作台` and `退出`. Left-click and Show reveal and focus the main window. Exit sets an atomic `is_quitting` flag before exiting. A main-window close request hides instead of destroys only when `close_to_tray` is true and `is_quitting` is false.

- [ ] **Step 3: Connect persisted settings and auto-launch**

On hydration, synchronize SQLite `closeToTray` into Rust with `set_close_to_tray`. Use the autostart plugin for enable/disable and write the returned actual value into SQLite settings. Failed toggles restore the previous UI value and display a message.

- [ ] **Step 4: Verify packaged behavior**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && pnpm build:desktop`.

Open the packaged `.app`, close the window, restore it from the tray, launch the app again to verify single-instance focus, then exit from the tray.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: add macos tray and launch lifecycle`

### Task 2: Implement notification permission and deduplicated reminders

**Files:**
- Create: `src-tauri/src/reminders.rs`
- Create: `src-tauri/tests/reminders.rs`
- Create: `src/features/notifications/NotificationSettings.tsx`
- Create: `src/features/notifications/useNotificationNavigation.ts`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/platform/DesktopPlatform.ts`
- Modify: `src/platform/tauriDesktopPlatform.ts`
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces delivery key `${recordId}:${dueDate}:due`.
- Produces Tauri command `poll_due_reminders(now_date: String)` returning delivered record IDs.
- Produces event `notification-record-open` carrying `{ recordId: string }`.

- [ ] **Step 1: Write reminder-selection tests**

Use an in-memory SQLite database with one future, one due-today, one overdue, one completed, and one archived todo. Assert only due-today and overdue records are selected. Insert a matching delivery key and assert it is not selected again after a simulated restart.

Run: `cargo test --manifest-path src-tauri/Cargo.toml reminders`

Expected: FAIL because the reminders module does not exist.

Add `rusqlite` for Rust background reads with `cargo add rusqlite --features bundled --manifest-path src-tauri/Cargo.toml`. Open the path returned by the existing `database.rs` helper and enable foreign keys plus WAL-compatible busy timeouts; do not construct a second database location.

- [ ] **Step 2: Implement permission UI**

Settings displays `未请求 / 已允许 / 已拒绝`. Request permission only after the user explicitly enables reminders. If denied, set `notificationsEnabled` false and show instructions to use macOS System Settings; do not request again automatically.

- [ ] **Step 3: Implement polling and delivery transaction**

Poll immediately after app ready and every 15 minutes while the process runs. Query due and overdue incomplete todos. For each, reserve its unique delivery key in a SQLite transaction; only the process that inserts the key sends the notification. Notification body contains due label only, not note content.

- [ ] **Step 4: Navigate from notifications**

Attach the record ID to the notification action. On activation, show/focus the main window and emit `notification-record-open`. The React hook clears filters, navigates to the todo type, and opens that record's editor.

Run: `pnpm test && cargo test --manifest-path src-tauri/Cargo.toml && pnpm build:desktop`.

Expected: permission, due selection, restart dedupe, and navigation tests pass.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: add reliable native todo reminders`

### Task 3: Add Dock badge count

**Files:**
- Create: `src-tauri/src/badge.rs`
- Create: `src-tauri/tests/badge.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/platform/DesktopPlatform.ts`
- Modify: `src/platform/tauriDesktopPlatform.ts`
- Modify: `src/stores/workbenchStore.ts`

**Interfaces:**
- Produces: `overdue_todo_count(records, today): u32` in Rust tests.
- Produces: `DesktopPlatform.setBadgeCount(count: number): Promise<void>`.

- [ ] **Step 1: Write count tests**

Test that overdue incomplete, non-archived todos count; due-today, future, completed, archived, and non-todo records do not. Test zero clears the badge.

- [ ] **Step 2: Implement the platform API**

Expose `setBadgeCount`. In Tauri use the current window/application badge API available on macOS; pass `null`/no count when zero so the Dock badge is removed. Reject negative or non-integer input in TypeScript before invoking the native API.

- [ ] **Step 3: Refresh badge after relevant events**

Update after hydration, todo create/update/delete/complete/archive/import, and at local midnight. Derive count from the committed store state so failed repository writes never change the badge.

- [ ] **Step 4: Verify badge behavior**

Run unit and Cargo tests. In the packaged app create an overdue todo, observe badge `1`, complete it, and verify the badge clears without restarting.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: show overdue todo count in dock badge`

### Task 4: Adopt native macOS window treatment

**Files:**
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src/components/TitleBar.tsx`
- Modify: `src/styles/layout.css`
- Modify: `src/styles/themes.css`
- Test: `src/test/e2e/smoke.spec.ts`

**Interfaces:**
- Produces: macOS traffic-light window controls managed by the operating system.

- [ ] **Step 1: Add an E2E layout assertion**

Assert the custom minimize/maximize/close buttons are absent in Tauri/macOS mode while the brand area remains visible. Browser preview may render the brand header without window controls.

- [ ] **Step 2: Configure the Tauri window**

Set the main window to `decorations: true`, `hiddenTitle: true`, and `titleBarStyle: "Overlay"`; preserve minimum dimensions and reserve left padding for traffic lights. Do not recreate traffic lights with HTML buttons.

- [ ] **Step 3: Simplify TitleBar**

Remove custom window-control buttons and Electron-era double-click handling. Keep logo, title, drag region, theme-aware colors, and no-drag regions for interactive controls.

- [ ] **Step 4: Verify resizing and themes**

At 960×640 and 1280×820, verify traffic lights do not overlap the brand, draggable areas work, double-click follows macOS behavior, and both themes paint behind the titlebar without flashes.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: adopt native macos window chrome`

### Task 5: Generate arm64 app and DMG artifacts

**Files:**
- Create: `src-tauri/icons/icon.icns`
- Create: `src-tauri/icons/32x32.png`
- Create: `src-tauri/icons/128x128.png`
- Create: `src-tauri/icons/128x128@2x.png`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: `pnpm dist:mac`.
- Produces: arm64 `.app` and `.dmg` under the Tauri bundle directory.

- [ ] **Step 1: Generate the icon set from the existing source logo**

Use Tauri's icon command against `src/assets/logo.png`:

`pnpm tauri icon src/assets/logo.png`

The repository source logo is 256×256. Use it unchanged for this personal build and inspect the generated `.icns` at normal and Retina display sizes; record visible softness as a non-blocking asset-quality limitation rather than changing the logo during this engineering plan.

- [ ] **Step 2: Configure local personal signing and bundles**

Set bundle targets to `app` and `dmg`, category to `Productivity`, minimum system version to the user's supported macOS baseline, and macOS signing identity to `-` for ad-hoc local signing. Do not add Apple credentials to files or environment examples.

- [ ] **Step 3: Add the distribution command**

Add:

```json
"dist:mac": "tauri build --bundles app,dmg --target aarch64-apple-darwin"
```

Ensure the Rust target exists with `rustup target add aarch64-apple-darwin`, then run `pnpm dist:mac`.

- [ ] **Step 4: Verify artifacts**

Run `file` on the app executable and assert `arm64`. Mount the DMG, drag the app to a temporary Applications test directory, launch it, create/edit/restart a record, and verify the same SQLite data returns. Record app, DMG, cold-start, and idle-memory measurements in `CHANGELOG.md`.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `build: produce apple silicon app and dmg`

### Task 6: Write installation, data, backup, and release documentation

**Files:**
- Create: `docs/macos-installation.md`
- Modify: `README.md`
- Modify: `PRIVACY.md`
- Modify: `SECURITY.md`

**Interfaces:**
- Documents: local install, first launch, data directory, JSON backup, upgrade, uninstall, unsigned/ad-hoc limitations, and future notarized distribution.

- [ ] **Step 1: Document prerequisites and local installation**

State that the delivered build is Apple Silicon arm64. Explain mounting the DMG, dragging the app to Applications, first launch, and how ad-hoc local signing differs from Developer ID signing/notarization. Do not advise disabling Gatekeeper globally.

- [ ] **Step 2: Document data and backups**

Use the actual Tauri application data path discovered from the packaged app, identify the SQLite filename, and explain that users should create a JSON backup from Settings before replacing or deleting the database.

- [ ] **Step 3: Document upgrades and removal**

Explain that replacing the `.app` preserves data in Application Support, while removing the app does not automatically remove the database. Provide explicit Finder paths and warn before manual deletion.

- [ ] **Step 4: Run the complete release gate**

Run:

```bash
pnpm check
pnpm test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
pnpm size
pnpm dist:mac
```

Expected: all automated checks pass, artifacts are arm64, and the macOS manual checklist for tray, auto-launch, notification click, badge, theme, Markdown, export, persistence, and DMG installation is complete.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `docs: add macos installation and data guide`
