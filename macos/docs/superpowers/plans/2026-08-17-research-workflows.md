# Research Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect projects to next actions, add a draggable project board, recurring todos, batch operations, lightweight literature tracking, interactive dashboard navigation, and restrained completion/reorder animation.

**Architecture:** Pure domain functions define recurrence and referential behavior. Repository transactions enforce durable changes, while focused React feature modules implement list/board presentation and selection without adding new global state for transient gestures.

**Tech Stack:** React 19, TypeScript, Zustand, SQLite Repository, `@dnd-kit/core`, `@dnd-kit/sortable`, CSS transitions, Vitest, Testing Library, Playwright.

## Global Constraints

- Complete `2026-08-17-writing-visual-experience.md` first.
- A todo may reference zero or one project; a project may expose many incomplete next actions.
- Deleting a project clears `projectId` and never deletes its todos.
- Recurrence supports only daily, weekly, and monthly intervals.
- Completing a recurring todo creates one next future instance and does not backfill missed instances.
- Literature tracking remains lightweight and does not manage PDFs or citations.
- All animations obey resolved reduced-motion settings.
- The folder currently has no Git metadata. Run commit checkpoints only after a repository is attached or initialized by the user.

---

## File Structure

- `src/features/projects/ProjectView.tsx`: list/board mode shell.
- `src/features/projects/ProjectBoard.tsx`: status columns and DnD.
- `src/features/projects/ProjectNextActions.tsx`: project-linked incomplete todos.
- `src/features/todos/recurrence.ts`: deterministic next-date calculation.
- `src/features/todos/completeTodo.ts`: transactional completion operation.
- `src/features/selection/useRecordSelection.ts`: local multi-selection model.
- `src/features/selection/BulkActionBar.tsx`: batch commands.
- `src/features/literature/LiteratureFields.tsx`: structured literature editor.
- `src/features/literature/LiteratureCard.tsx`: reading status and external links.

### Task 1: Implement recurring-todo domain rules and transaction

**Files:**
- Create: `src/features/todos/recurrence.ts`
- Create: `src/features/todos/completeTodo.ts`
- Create: `src/test/recurrence.test.ts`
- Modify: `src/repositories/WorkbenchRepository.ts`
- Modify: `src/repositories/SqliteWorkbenchRepository.ts`
- Modify: `src/stores/workbenchStore.ts`

**Interfaces:**
- Produces: `nextDueDate(currentDueDate: string, rule: RecurrenceRule, today: string): string`.
- Produces: `repository.completeTodo(id: string, completedAt: number): Promise<{ completed: RecordItem; next: RecordItem | null }>`.

- [x] **Step 1: Write date-rule tests**

Cover these exact cases:

```ts
expect(nextDueDate('2026-08-17', { frequency: 'daily', interval: 2 }, '2026-08-17')).toBe('2026-08-19');
expect(nextDueDate('2026-08-01', { frequency: 'weekly', interval: 1 }, '2026-08-17')).toBe('2026-08-22');
expect(nextDueDate('2026-01-31', { frequency: 'monthly', interval: 1 }, '2026-01-31')).toBe('2026-02-28');
expect(nextDueDate('2028-01-31', { frequency: 'monthly', interval: 1 }, '2028-01-31')).toBe('2028-02-29');
```

Run: `pnpm vitest run src/test/recurrence.test.ts`

Expected: FAIL because `nextDueDate` does not exist.

- [x] **Step 2: Implement deterministic recurrence**

Parse dates as local calendar components without adding milliseconds. Repeatedly advance by the rule until the result is strictly later than `today`. For monthly rules, retain the original desired day while clamping each candidate to the target month's final day.

- [x] **Step 3: Add the completion transaction**

Extend the repository with `completeTodo`. In one SQLite transaction: load the todo, mark it done, and if recurrence exists create one new record with a new ID, `done = false`, the computed future `dueDate`, the same project/workspace/priority/content/recurrence, and fresh timestamps.

- [x] **Step 4: Connect store and verify rollback**

Test that a forced insert failure rolls back the completion and does not leave a partial next item. On success, replace the completed item and prepend the returned next item in one Zustand update.

Run: `pnpm test && pnpm build`

Expected: daily, weekly, monthly, leap-year, skipped-period, and rollback tests pass.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: add transactional recurring todos`

### Task 2: Add project linkage and next actions

**Files:**
- Create: `src/features/projects/ProjectNextActions.tsx`
- Create: `src/test/projectActions.test.tsx`
- Modify: `src/components/EditorModal.tsx`
- Modify: `src/components/RecordRow.tsx`
- Modify: `src/components/RecordsView.tsx`
- Modify: `src/repositories/SqliteWorkbenchRepository.ts`

**Interfaces:**
- Produces: `selectProjectNextActions(records, projectId): RecordItem[]`.
- Uses: `RecordItem.projectId: string | null`.

- [x] **Step 1: Write selector and UI tests**

Create two incomplete todos and one completed todo linked to a project. Assert the selector returns only the two incomplete records ordered by overdue first, then due date, then priority. Render `ProjectNextActions` and assert clicking a todo requests its editor.

- [x] **Step 2: Implement the selector and project picker**

Add a project selector to todo editing only. Options include `不关联项目` plus non-archived project records in the same workspace. When changing workspace, clear `projectId` if the selected project is outside the new workspace.

- [x] **Step 3: Render next actions on project cards**

Show at most three actions and a `还有 N 项` affordance. Empty projects show `尚未设置下一步行动` with a button that opens a new todo already linked to the project.

- [x] **Step 4: Verify deletion behavior**

Integration test project deletion and assert linked todos remain with `projectId === null`. Run: `pnpm test && pnpm test:e2e && pnpm build`.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: connect projects with next actions`

### Task 3: Add list/board project views with accessible drag and drop

**Files:**
- Create: `src/features/projects/ProjectView.tsx`
- Create: `src/features/projects/ProjectBoard.tsx`
- Create: `src/features/projects/ProjectColumn.tsx`
- Create: `src/test/projectBoard.test.tsx`
- Modify: `src/components/RecordsView.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `ProjectView` with persisted view mode `'list' | 'board'`.
- Produces: `moveProjectToStatus(projectId: string, status: Status): Promise<void>`.

- [x] **Step 1: Install and test DnD behavior**

Run: `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.

Render four columns and simulate the domain handler moving a project from `planned` to `active`. Assert `updateRecord(projectId, { status: 'active' })` is called once. Test keyboard movement through DnD keyboard sensors.

- [x] **Step 2: Implement board columns**

Columns use the four `STATUS_LABEL` values, show counts, and accept project cards. Retain vertical/horizontal category as a card badge rather than creating eight columns. Empty columns remain visible as drop targets.

- [x] **Step 3: Add view toggle and persistence**

Add list/board segmented controls next to project filters. Store the choice in `settings` as `projectViewMode`; default to `list`. Preserve existing list grouping and manual ordering.

- [x] **Step 4: Add motion-aware transitions and verify**

Use DnD transforms for card displacement and CSS transitions under full motion. Under reduced motion set transition duration to zero. Run unit tests, E2E board drag, and a keyboard-only manual pass.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: add project kanban board`

### Task 4: Add recurrence controls and motion-aware completion

**Files:**
- Create: `src/features/todos/RecurrenceFields.tsx`
- Create: `src/features/todos/CompletingTodoItem.tsx`
- Create: `src/test/todoCompletion.test.tsx`
- Modify: `src/components/EditorModal.tsx`
- Modify: `src/components/TodoView.tsx`

**Interfaces:**
- Consumes: `RecurrenceRule` and `completeTodo` from Task 1.
- Produces: recurrence editor with frequency and interval.

- [ ] **Step 1: Write editor and animation tests**

Assert selecting `每 2 周` produces `{ frequency: 'weekly', interval: 2 }`. With fake timers and full motion, clicking complete delays the repository action by 180 ms while applying `is-completing`. With reduced motion, it calls immediately.

- [x] **Step 2: Implement recurrence controls**

Todo editor shows `不重复 / 每天 / 每周 / 每月`. When repeating, show an integer interval constrained to 1–99 and a human-readable preview such as `每 2 周重复`.

- [ ] **Step 3: Implement restrained completion animation**

Apply opacity and translate transitions for 180 ms, then call `completeTodo`. Disable the checkbox during that interval to prevent duplicate completion. If persistence fails, remove the class, restore interaction, and display the repository error.

- [ ] **Step 4: Verify behavior**

Run: `pnpm test && pnpm test:e2e && pnpm build`.

Expected: completion is idempotent, recurring next items appear, and reduced motion has no delay.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: expose recurrence and completion transitions`

### Task 5: Add batch selection and operations

**Files:**
- Create: `src/features/selection/useRecordSelection.ts`
- Create: `src/features/selection/BulkActionBar.tsx`
- Create: `src/test/bulkActions.test.tsx`
- Modify: `src/components/RecordRow.tsx`
- Modify: `src/components/RecordsView.tsx`
- Modify: `src/components/TodoView.tsx`
- Modify: `src/repositories/WorkbenchRepository.ts`
- Modify: `src/repositories/SqliteWorkbenchRepository.ts`

**Interfaces:**
- Produces: `repository.updateRecords(ids: string[], patch: BatchRecordPatch): Promise<RecordItem[]>`.
- Produces: `repository.deleteRecords(ids: string[]): Promise<void>`.

- [ ] **Step 1: Write selection and transaction tests**

Test select one, select visible, clear, and pruning IDs after filtering. Repository tests assert batch update is all-or-nothing and batch delete reports the exact selected count to the confirmation layer.

- [ ] **Step 2: Implement local selection**

Keep selection in the current view hook rather than global Zustand. Show checkboxes only after entering selection mode. `选择当前结果` selects filtered visible IDs, not hidden or archived records.

- [ ] **Step 3: Implement repository operations**

Support archive/unarchive, workspace move, project association for todos, and delete. Validate target workspace/project before starting a transaction. Project association rejects non-todo IDs.

- [ ] **Step 4: Implement the bulk bar and confirmations**

The sticky bar shows `已选择 N 条`, archive, move workspace, associate project when all selected are todos, delete, and cancel. Delete confirmation states the exact count and has no default focus on the destructive action.

Run: `pnpm test && pnpm test:e2e && pnpm build`.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: add transactional bulk record actions`

### Task 6: Add lightweight literature records

**Files:**
- Create: `src/features/literature/LiteratureFields.tsx`
- Create: `src/features/literature/LiteratureCard.tsx`
- Create: `src/features/literature/doi.ts`
- Create: `src/test/literature.test.tsx`
- Modify: `src/domain/models.ts`
- Modify: `src/sample.ts`
- Modify: `src/components/EditorModal.tsx`
- Modify: `src/components/RecordsView.tsx`

**Interfaces:**
- Produces: `normalizeDoi(input: string): string | null`.
- Produces: `doiUrl(doi: string): string`.
- Uses: `LiteratureDetails` and `ReadingStatus` from the domain model.

- [x] **Step 1: Write DOI and rendering tests**

Assert `https://doi.org/10.1145/123` and `doi:10.1145/123` normalize to `10.1145/123`, invalid whitespace-only values return null, and clicking a DOI opens `https://doi.org/10.1145/123`. Test all three Chinese reading-status labels.

- [x] **Step 2: Add the built-in type and structured editor**

Add a built-in `literature` type kind and icon. Editor fields are authors, four-digit year bounded from 1000 to current year + 1, DOI, HTTPS link, and reading status. Markdown content remains the reading note.

- [x] **Step 3: Render literature cards**

Show author/year, reading-status pill, DOI, link, Markdown summary, and updated date. DOI and link buttons validate and use `DesktopPlatform.openExternal`.

- [x] **Step 4: Verify persistence and export**

Run repository round-trip tests and assert JSON/Markdown/CSV/HTML exports include literature metadata. Run: `pnpm test && pnpm test:e2e && pnpm build`.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: add lightweight literature tracking`

### Task 7: Make MoonHero navigable and finish reorder animation

**Files:**
- Create: `src/test/moonHero.test.tsx`
- Modify: `src/components/MoonHero.tsx`
- Modify: `src/components/RecordsView.tsx`
- Modify: `src/styles/components.css`
- Modify: `src/styles/themes.css`

**Interfaces:**
- Produces: clickable SVG segments that call `setView(typeId)` and reset filters.

- [x] **Step 1: Write interaction tests**

Render two non-empty type segments. Assert each circle has an accessible label such as `科研项目：3 条记录`, keyboard focus, and Enter/click navigation. Assert hovering or focusing exposes the type and count in the center/tooltip.

- [x] **Step 2: Implement accessible SVG navigation**

Give segments `role="button"`, `tabIndex={0}`, accessible labels, and Enter/Space handling. Use a local hovered/focused segment state. Clicking calls `setStatusFilter('all')` and `setView(typeId)`.

- [ ] **Step 3: Complete list reorder animation**

Use the same dnd-kit sortable transform strategy as the board for reorderable record lists. Remove native HTML drag handlers after parity tests pass. Under reduced motion, render immediate position changes.

- [ ] **Step 4: Final workflow verification**

Run: `pnpm check && pnpm test:e2e && pnpm build:desktop`.

Manually verify the complete 50-record fixture in list, board, todo, literature, and dashboard views at 960×640 and 1280×820.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: make dashboard charts interactive and polish reordering`
