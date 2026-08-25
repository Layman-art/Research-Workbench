# Research Workbench Delivery Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved Research Workbench redesign in five independently testable phases and deliver a personal Apple Silicon Mac application.

**Architecture:** The roadmap first stabilizes the current frontend, then replaces Electron/localStorage with Tauri/SQLite, and only then adds writing, workflow, and native macOS features. Each linked plan ends in a working build and its own verification gate.

**Tech Stack:** pnpm, Node.js 22 LTS, React 19, TypeScript, Zustand, Tauri 2, Rust, SQLite, Vitest, Playwright.

## Global Constraints

- Target a single user on Apple Silicon Mac.
- Use pnpm 11 and Node.js 22 LTS.
- Validate performance with 50 representative records.
- Build arm64 `.app` and `.dmg`; Windows, Linux, Intel Mac, cloud sync, accounts, and collaboration are out of scope.
- Do not skip a phase gate or begin a later phase while required checks fail.
- The folder currently has no Git metadata. Run commit checkpoints only after a repository is attached or initialized by the user.

---

## Execution Order

- [x] **Phase 1: Foundation and performance**

Execute [2026-08-17-foundation-performance.md](./2026-08-17-foundation-performance.md).

Exit gate: pnpm/Node 22 are fixed, unit/E2E/build checks pass, no application component uses bare `useStore()`, and font bytes are below 1 MB.

- [x] **Phase 2: Tauri and SQLite migration**

Execute [2026-08-17-tauri-sqlite.md](./2026-08-17-tauri-sqlite.md).

Exit gate: existing features run from an arm64 Tauri `.app`, Repository contract tests pass, data survives restart in SQLite, and Electron/localStorage persistence is removed.

- [x] **Phase 3: Writing and visual experience**

Execute [2026-08-17-writing-visual-experience.md](./2026-08-17-writing-visual-experience.md).

Exit gate: Markdown, draft recovery, theme/motion settings, Chinese typography, and JSON/Markdown/CSV/HTML export pass automated and visual checks.

- [x] **Phase 4: Research workflows**

Execute [2026-08-17-research-workflows.md](./2026-08-17-research-workflows.md).

Exit gate: project board, next actions, recurring todos, batch actions, literature tracking, dashboard navigation, and motion-aware transitions work with the 50-record fixture.

- [x] **Phase 5: macOS native delivery**

Execute [2026-08-17-macos-native-distribution.md](./2026-08-17-macos-native-distribution.md).

Exit gate: tray, auto-launch, notifications, Dock badge, native titlebar, arm64 `.app`, `.dmg`, persistence, installation, and documentation pass the complete release checklist.

## Requirement Coverage

| Approved requirement | Owning plan and task |
| --- | --- |
| pnpm and Node 22 | Foundation Task 1 |
| Test environment | Foundation Task 2 |
| Invalid Zustand rerenders | Foundation Task 3 |
| Font payload | Foundation Task 4 |
| Repository and SQLite | Tauri Task 2–4 |
| Replace Electron with Tauri | Tauri Task 1 and 5 |
| Markdown and plain summaries | Writing Task 1–2 |
| Unsaved protection and drafts | Writing Task 2 |
| Moonlight theme and motion control | Writing Task 3 |
| Chinese typography | Writing Task 4 |
| JSON, Markdown, CSV, HTML export | Writing Task 5 |
| Project board | Workflow Task 3 |
| Project-linked next actions | Workflow Task 2 |
| Recurring todos | Workflow Task 1 and 4 |
| Batch operations | Workflow Task 5 |
| Literature records | Workflow Task 6 |
| Interactive MoonHero | Workflow Task 7 |
| Completion and reorder animation | Workflow Task 4 and 7 |
| Tray and auto-launch | macOS Task 1 |
| Native notifications and click navigation | macOS Task 2 |
| Dock badge | macOS Task 3 |
| Native macOS titlebar | macOS Task 4 |
| arm64 app, DMG, and installation guide | macOS Task 5–6 |

## Final Release Gate

- [x] Run `pnpm check`.
- [x] Run `pnpm test:e2e`.
- [x] Run `cargo test --manifest-path src-tauri/Cargo.toml`.
- [x] Run `pnpm size` and record final JS, CSS, font, `.app`, and `.dmg` sizes.
- [x] Run `pnpm dist:mac` and verify the executable reports arm64.
- [ ] Complete the manual macOS checklist for restart persistence, Markdown, board drag, recurrence, batch operations, literature links, tray, auto-launch, notification click, Dock badge, theme, reduced motion, export, and DMG installation.
