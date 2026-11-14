# Tauri and SQLite Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Electron and `localStorage` with a Tauri 2 Apple Silicon application backed by SQLite while preserving existing user-visible behavior.

**Architecture:** React communicates with a `WorkbenchRepository` and a small `DesktopPlatform` interface. The production adapters use Tauri plugins; tests use in-memory adapters. Zustand hydrates from the repository and updates its cache only after successful writes.

**Tech Stack:** Tauri 2, Rust stable, React 19, TypeScript 5.8, Zustand 5, `@tauri-apps/plugin-sql` with SQLite, Vitest, Playwright, pnpm.

## Global Constraints

- Complete `2026-08-17-foundation-performance.md` first.
- Target a single user on Apple Silicon Mac; build arm64 only.
- Use pnpm and Node.js 22 LTS.
- Do not create an IndexedDB or Electron SQLite implementation.
- There is no real user data to migrate from `localStorage`; seed example data only when the database is empty.
- React components must not import Tauri APIs or execute SQL directly.
- Every multi-table write must use a SQLite transaction.
- The folder currently has no Git metadata. Run commit checkpoints only after a repository is attached or initialized by the user.

---

## File Structure

- `src/domain/models.ts`: canonical domain types and enums.
- `src/repositories/WorkbenchRepository.ts`: persistence interface.
- `src/repositories/SqliteWorkbenchRepository.ts`: Tauri SQLite implementation.
- `src/repositories/InMemoryWorkbenchRepository.ts`: test implementation.
- `src/repositories/schema.ts`: versioned SQL migration text.
- `src-tauri/src/database.rs`: resolves the single application-data SQLite path shared by frontend repository and Rust background services.
- `src/stores/workbenchStore.ts`: asynchronous hydration and persisted mutations.
- `src/platform/DesktopPlatform.ts`: desktop capability interface.
- `src/platform/tauriDesktopPlatform.ts`: Tauri implementation.
- `src/platform/browserDesktopPlatform.ts`: test/browser fallback.
- `src-tauri/`: Rust application, capabilities, icons, and Tauri configuration.

### Task 1: Scaffold the Tauri application and permissions

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm tauri dev` and `pnpm tauri build --bundles app`.
- Produces: Tauri plugins `sql`, `shell`, `dialog`, `fs`, `notification`, and `autostart` registered in Rust.
- Produces: Tauri command `get_database_url` returning the app-private SQLite URL.

- [x] **Step 1: Install the exact Tauri JavaScript packages**

Run:

```bash
pnpm add @tauri-apps/api@^2 @tauri-apps/plugin-autostart@^2 @tauri-apps/plugin-dialog@^2 @tauri-apps/plugin-fs@^2 @tauri-apps/plugin-notification@^2 @tauri-apps/plugin-shell@^2 @tauri-apps/plugin-sql@^2
pnpm add -D @tauri-apps/cli@^2
```

Add scripts:

```json
"tauri": "tauri",
"dev:desktop": "tauri dev",
"build:desktop": "tauri build --bundles app"
```

- [x] **Step 2: Create a minimal Rust entry point**

Register plugins in `src-tauri/src/lib.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("failed to run Research Workbench");
}
```

`main.rs` calls `research_workbench_lib::run()`. Add `src-tauri/src/database.rs`; resolve `app.path().app_data_dir()`, create the directory, append `research-workbench.db`, and expose only a `sqlite:` URL for that path through `get_database_url`. Register the command with `invoke_handler`.

- [x] **Step 3: Configure the app and capabilities**

Set `identifier` to `com.researchworkbench.app`, `beforeDevCommand` to `pnpm dev`, `beforeBuildCommand` to `pnpm build`, `devUrl` to `http://localhost:1430`, and `frontendDist` to `../dist`. Configure one 1280×820 window with minimum 960×640.

In `capabilities/default.json`, grant only the default window and the permissions needed by the registered plugins. Do not grant shell execution; grant only `shell:allow-open` for safe external URLs.

- [x] **Step 4: Verify Tauri boot**

Run: `cargo test --manifest-path src-tauri/Cargo.toml && pnpm build && pnpm tauri build --bundles app`

Expected: an arm64 `.app` is created under `src-tauri/target/release/bundle/macos/` and opens the existing React UI.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `build: scaffold tauri 2 desktop shell`

### Task 2: Define domain and repository contracts

**Files:**
- Create: `src/domain/models.ts`
- Create: `src/repositories/WorkbenchRepository.ts`
- Create: `src/repositories/InMemoryWorkbenchRepository.ts`
- Create: `src/test/repository.contract.test.ts`
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `WorkbenchSnapshot`, `AppSettings`, `Draft`, `LiteratureDetails`, `RecurrenceRule`.
- Produces: `WorkbenchRepository` with `initialize`, `loadSnapshot`, record/type/workspace/settings/draft operations.

- [x] **Step 1: Write a repository contract test**

Create a shared test function that accepts `() => Promise<WorkbenchRepository>` and verifies this sequence:

```ts
const repository = await factory();
await repository.initialize();
const initial = await repository.loadSnapshot();
const record = { ...initial.records[0], id: 'contract-record', title: '事务测试' };
await repository.saveRecord(record);
expect((await repository.loadSnapshot()).records).toContainEqual(record);
await repository.deleteRecord(record.id);
expect((await repository.loadSnapshot()).records.some((item) => item.id === record.id)).toBe(false);
```

Run: `pnpm vitest run src/test/repository.contract.test.ts`

Expected: FAIL because the repository types do not exist.

- [x] **Step 2: Define canonical types**

Move the current record/type/workspace definitions into `src/domain/models.ts` and add:

```ts
export type ThemeMode = 'system' | 'light' | 'dark';
export type MotionMode = 'system' | 'reduce' | 'full';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';
export type ReadingStatus = 'unread' | 'reading' | 'read';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
}

export interface AppSettings {
  displayName: string;
  theme: ThemeMode;
  motion: MotionMode;
  projectViewMode: 'list' | 'board';
  closeToTray: boolean;
  autoLaunch: boolean;
  notificationsEnabled: boolean;
}

export interface Draft {
  id: string;
  recordId: string | null;
  payload: string;
  updatedAt: number;
}
```

Extend `RecordItem` with `projectId: string | null`, `recurrence: RecurrenceRule | null`, and optional `literature: LiteratureDetails | null`. Keep temporary re-exports from `src/types.ts` so existing imports compile during migration.

- [x] **Step 3: Define the repository interface and memory adapter**

The interface must include exact methods:

```ts
export interface WorkbenchRepository {
  initialize(): Promise<void>;
  loadSnapshot(): Promise<WorkbenchSnapshot>;
  saveRecord(record: RecordItem): Promise<void>;
  deleteRecord(id: string): Promise<void>;
  replaceAll(snapshot: WorkbenchSnapshot): Promise<void>;
  saveType(type: TypeDef): Promise<void>;
  deleteType(id: string): Promise<void>;
  saveWorkspace(workspace: Workspace): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  saveSettings(settings: AppSettings): Promise<void>;
  saveDraft(draft: Draft): Promise<void>;
  loadDraft(id: string): Promise<Draft | null>;
  deleteDraft(id: string): Promise<void>;
}
```

Implement `InMemoryWorkbenchRepository` with cloned values so tests cannot mutate stored state by reference.

- [x] **Step 4: Run contract and type checks**

Run: `pnpm vitest run src/test/repository.contract.test.ts && pnpm build`

Expected: the in-memory adapter passes the shared contract and existing UI compiles through temporary re-exports.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `refactor: define workbench domain and repository contracts`

### Task 3: Implement the SQLite schema and adapter

**Files:**
- Create: `src/repositories/schema.ts`
- Create: `src/repositories/SqliteWorkbenchRepository.ts`
- Create: `src/test/sqlite-mapping.test.ts`
- Modify: `src/sample.ts`

**Interfaces:**
- Consumes: `WorkbenchRepository` and domain models from Task 2.
- Produces: `createSqliteWorkbenchRepository(): Promise<WorkbenchRepository>`.
- Produces: schema version `1` stored in `schema_migrations`.

- [x] **Step 1: Test row/domain mapping and constraints**

Export pure `recordToRow` and `rowToRecord` functions and test that a record with Markdown, custom fields, project ID, recurrence, and literature metadata round-trips without loss. Test `interval: 0` rejection and `ON DELETE SET NULL` in the integration database.

Run: `pnpm vitest run src/test/sqlite-mapping.test.ts`

Expected: FAIL because mapping functions do not exist.

- [x] **Step 2: Define schema version 1**

Create SQL for `schema_migrations`, `types`, `workspaces`, `records`, `record_fields`, `settings`, `drafts`, `literature_details`, and `notification_deliveries`. Required constraints include:

```sql
project_id TEXT REFERENCES records(id) ON DELETE SET NULL,
recurrence_frequency TEXT CHECK (recurrence_frequency IN ('daily','weekly','monthly')),
recurrence_interval INTEGER CHECK (recurrence_interval IS NULL OR recurrence_interval > 0),
reading_status TEXT CHECK (reading_status IN ('unread','reading','read'))
```

Enable `PRAGMA foreign_keys = ON` on every connection. Store booleans as `0`/`1` and timestamps as integer milliseconds.

- [x] **Step 3: Implement initialization and transactions**

Invoke `get_database_url`, then load that returned URL through the SQL plugin. Apply missing migrations in a transaction. If `types` and `workspaces` are empty after migration, insert `BUILTIN_TYPES`, `BUILTIN_WORKSPACES`, default settings, and `buildSampleRecords()` in one transaction. Rust reminder and backup modules must call the same `database.rs` path helper instead of constructing a second path.

Implement `saveRecord` as an upsert followed by replacement of its `record_fields` and optional `literature_details` rows in the same transaction. Implement `replaceAll` by validating references before deleting and inserting snapshot data.

- [x] **Step 4: Run repository contract against SQLite**

Define an injected `SqlExecutor` interface with `select<T>(sql, params)`, `execute(sql, params)`, and `transaction(callback)` methods. Production wraps the Tauri SQL plugin; Vitest uses an in-memory fake executor that records statements, enforces transaction commit/rollback, and applies the repository contract. Run:

`pnpm test && cargo test --manifest-path src-tauri/Cargo.toml && pnpm build`

Expected: mapping, transaction, and existing tests pass.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: persist workbench data in sqlite`

### Task 4: Hydrate Zustand through the repository

**Files:**
- Create: `src/repositories/index.ts`
- Create: `src/stores/workbenchStore.ts`
- Create: `src/components/AppStartup.tsx`
- Create: `src/test/workbenchStore.test.ts`
- Modify: `src/App.tsx`
- Modify: all imports from `src/store.ts`
- Delete after migration: `src/store.ts`

**Interfaces:**
- Consumes: `WorkbenchRepository`.
- Produces: store lifecycle `phase: 'loading' | 'ready' | 'error'` and `error: string | null`.
- Produces: `createWorkbenchStore(repository: WorkbenchRepository)`.

- [x] **Step 1: Write failure-first store tests**

Test these exact behaviors:

```ts
await store.getState().hydrate();
expect(store.getState().phase).toBe('ready');

repository.saveRecord = async () => { throw new Error('disk full'); };
await expect(store.getState().updateRecord(record.id, { title: '保留草稿' })).rejects.toThrow('disk full');
expect(store.getState().records.find((item) => item.id === record.id)?.title).not.toBe('保留草稿');
expect(store.getState().error).toContain('disk full');
```

Run: `pnpm vitest run src/test/workbenchStore.test.ts`

Expected: FAIL because the factory does not exist.

- [x] **Step 2: Implement asynchronous persisted actions**

Each mutation builds the next domain object, awaits the repository write, then updates the Zustand cache. Do not optimistically mutate persistent data. UI-only setters such as search and active view remain synchronous.

- [x] **Step 3: Add application startup states**

`AppStartup` calls `hydrate()` once. Render a branded loading screen during `loading`. On `error`, show the message and buttons for “重试” and “打开数据目录”; the second button uses `DesktopPlatform.openDataDirectory()` from Task 5.

- [x] **Step 4: Migrate consumers and remove localStorage persistence**

Update component imports, await mutations where errors matter, and remove Zustand `persist`, migration version 6, `createJSONStorage`, and the old `store.ts` only after `rg "from ['\"]\.\.?/store" src` returns no matches.

Run: `pnpm test && pnpm lint && pnpm build && pnpm test:e2e`

Expected: the UI behaves as before but starts from SQLite-backed hydration.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `refactor: hydrate application state through repository`

### Task 5: Introduce the desktop platform adapter and remove Electron

**Files:**
- Create: `src/platform/DesktopPlatform.ts`
- Create: `src/platform/tauriDesktopPlatform.ts`
- Create: `src/platform/browserDesktopPlatform.ts`
- Modify: `src/platform.ts`
- Modify: `src/components/TitleBar.tsx`
- Modify: `src/components/SettingsView.tsx`
- Modify: `package.json`
- Delete: `electron/main.cjs`
- Delete: `electron/preload.cjs`

**Interfaces:**
- Produces: `DesktopPlatform` methods `minimize`, `toggleMaximize`, `close`, `openExternal`, `openDataDirectory`, `getAutoLaunch`, `setAutoLaunch`, `getCloseToTray`, `setCloseToTray`.

- [x] **Step 1: Write adapter tests**

Test that `browserDesktopPlatform.openExternal('javascript:alert(1)')` rejects and `openExternal('https://doi.org/10.1/example')` succeeds through an injected opener. Test unsupported desktop settings return `false` rather than throwing.

- [x] **Step 2: Define and implement the adapters**

Use this contract:

```ts
export interface DesktopPlatform {
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  close(): Promise<void>;
  openExternal(url: string): Promise<void>;
  openDataDirectory(): Promise<void>;
  getAutoLaunch(): Promise<boolean>;
  setAutoLaunch(enabled: boolean): Promise<boolean>;
  getCloseToTray(): Promise<boolean>;
  setCloseToTray(enabled: boolean): Promise<boolean>;
}
```

Validate external protocols against `https:` only before calling the Tauri shell plugin.

- [x] **Step 3: Migrate window and setting consumers**

Replace `rwWindow` usage with the injected `DesktopPlatform`. Keep browser preview functional through `browserDesktopPlatform`. Store close-to-tray in SQLite settings; the Tauri close handler reads the current setting through a Rust-managed value updated when the setting changes.

- [x] **Step 4: Remove Electron dependencies and files**

Run: `pnpm remove -D electron electron-builder concurrently cross-env wait-on`

Remove `main`, Electron scripts, Windows builder config, `electron/`, and obsolete `.ico`-only resource references. Do not remove source artwork needed to generate `.icns` later.

Run: `pnpm check && pnpm test:e2e && cargo test --manifest-path src-tauri/Cargo.toml && pnpm tauri build --bundles app`

Expected: all checks pass; `rg -n "electron|rwWindow" src package.json` returns no runtime references.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: complete tauri and sqlite migration`
