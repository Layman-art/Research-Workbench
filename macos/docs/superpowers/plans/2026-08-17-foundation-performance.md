# Foundation and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the pnpm/Node 22 toolchain, restore a reliable test baseline, remove broad Zustand subscriptions, and cut the current 23 MB font payload.

**Architecture:** Preserve the current Electron application during this plan. Improve only build discipline, selectors, render boundaries, and font loading so the application remains functionally identical and becomes a stable baseline for the Tauri migration.

**Tech Stack:** pnpm, Node.js 22 LTS, React 19, Zustand 5, TypeScript 5.8, Vitest, Playwright, Vite.

## Global Constraints

- Target a single user on Apple Silicon Mac.
- Use pnpm only; do not retain `package-lock.json`.
- Use Node.js 22 LTS; Node.js 26 is outside the supported development baseline.
- Performance validation uses a fixed fixture of 50 records, not thousands of records.
- Do not add virtualization, a search service, a Web Worker, IndexedDB, or SQLite in this plan.
- Keep user-visible behavior unchanged.
- The folder currently has no Git metadata. Treat each commit step as a checkpoint with the supplied message; run it only after the user attaches or initializes a repository.

---

## File Structure

- `.node-version`: pins Node 22 for version managers.
- `package.json`: declares pnpm, quality scripts, and compatible engines.
- `src/test/setup.ts`: provides deterministic browser storage for Vitest.
- `src/test/fixtures.ts`: creates the shared 50-record performance fixture.
- `src/store/selectors.ts`: owns reusable filtered-record and count selectors.
- `src/components/*.tsx`: subscribes only to required Zustand slices.
- `src/main.tsx`: imports only selected Latin font subsets.
- `src/styles.css`: uses macOS system Chinese fonts and retained Latin fonts.
- `scripts/report-bundle-size.mjs`: reports JS, CSS, font, and total output bytes.

### Task 1: Standardize pnpm and Node 22

**Files:**
- Create: `.node-version`
- Modify: `package.json`
- Delete: `package-lock.json`
- Verify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `pnpm check`, which runs lint, unit tests, and production build.
- Produces: a Node version constraint of `>=22.12.0 <23`.

- [ ] **Step 1: Verify the current package-manager state**

Run: `test -f pnpm-lock.yaml && test -f package-lock.json && node --version && pnpm --version`

Expected: both lock files exist before cleanup; the current shell may report Node 26.

- [ ] **Step 2: Pin the runtime and package manager**

Write `.node-version` as:

```text
22
```

Set these exact `package.json` fields and scripts:

```json
{
  "packageManager": "pnpm@11.1.1",
  "engines": { "node": ">=22.12.0 <23", "pnpm": ">=11 <12" },
  "scripts": {
    "check": "pnpm lint && pnpm test && pnpm build"
  }
}
```

Retain all existing scripts and dependencies around these additions.

- [ ] **Step 3: Remove npm state and refresh the pnpm lock**

Run: `pnpm install --lockfile-only`

Expected: `pnpm-lock.yaml` is valid for the declared package manager.

Delete only `package-lock.json`; do not delete `node_modules` or user files.

- [ ] **Step 4: Verify the toolchain under Node 22**

Run: `pnpm install --frozen-lockfile && pnpm check`

Expected: lint, all 16 existing unit tests, and the Vite production build pass without `NODE_OPTIONS=--no-experimental-webstorage`.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `chore: standardize pnpm and node 22 toolchain`

### Task 2: Make browser tests deterministic

**Files:**
- Modify: `src/test/setup.ts`
- Modify: `playwright.config.ts`
- Modify: `package.json`
- Test: `src/test/store.test.ts`
- Test: `src/test/e2e/smoke.spec.ts`

**Interfaces:**
- Produces: a clean `localStorage` before every Vitest test.
- Produces: `pnpm test:e2e:install` for the pinned Chromium browser.

- [ ] **Step 1: Add a regression assertion for storage isolation**

Add to `src/test/store.test.ts`:

```ts
it('does not inherit persisted state from another test', () => {
  expect(localStorage.getItem('cross-test-marker')).toBeNull();
  localStorage.setItem('cross-test-marker', 'set-by-this-test');
  expect(localStorage.getItem('cross-test-marker')).toBe('set-by-this-test');
});
```

Run: `pnpm test`

Expected: the suite exposes any remaining environment or isolation failure.

- [ ] **Step 2: Reset storage in the test setup**

Make `src/test/setup.ts` contain:

```ts
import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';

beforeEach(() => {
  window.localStorage.clear();
});
```

- [ ] **Step 3: Pin Playwright installation and server behavior**

Add this script:

```json
"test:e2e:install": "playwright install chromium"
```

Reformat `playwright.config.ts` without changing its port or two smoke tests. Use `pnpm dev --host 127.0.0.1` as the web-server command and set `workers: 1` because this is a small local desktop project and both tests share browser storage semantics.

- [ ] **Step 4: Run browser tests**

Run: `pnpm test:e2e:install && pnpm test:e2e`

Expected: both existing Chromium smoke tests pass.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `test: stabilize browser and storage test environments`

### Task 3: Introduce stable selectors and narrow subscriptions

**Files:**
- Create: `src/store/selectors.ts`
- Create: `src/test/selectors.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Dashboard.tsx`
- Modify: `src/components/RecordsView.tsx`
- Modify: `src/components/TodoView.tsx`
- Modify: `src/components/ScheduleView.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/TopBar.tsx`
- Modify: `src/components/EditorModal.tsx`
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/components/MoonHero.tsx`
- Modify: `src/components/RecordRow.tsx`

**Interfaces:**
- Consumes: `WorkbenchState`, `RecordItem`, and `TypeDef` from the current store and types.
- Produces: `filterRecords(input: FilterInput): RecordItem[]`.
- Produces: `countRecordsByType(records: RecordItem[], types: TypeDef[]): Record<string, number>`.

- [ ] **Step 1: Write selector tests using the 50-record fixture**

Create `src/test/selectors.test.ts` with these assertions:

```ts
import { describe, expect, it } from 'vitest';
import { buildSampleRecords } from '../sample';
import { BUILTIN_TYPES } from '../sample';
import { countRecordsByType, filterRecords } from '../store/selectors';

describe('record selectors', () => {
  it('filters without mutating its input', () => {
    const records = buildSampleRecords();
    const before = records.map((record) => record.id);
    const result = filterRecords({
      records,
      typeId: 'note',
      workspaceId: 'all',
      status: 'all',
      query: '实验',
    });
    expect(result.every((record) => record.typeId === 'note')).toBe(true);
    expect(records.map((record) => record.id)).toEqual(before);
  });

  it('counts every type in one pass', () => {
    const counts = countRecordsByType(buildSampleRecords(), BUILTIN_TYPES);
    expect(counts.project).toBe(3);
    expect(counts.todo).toBe(4);
  });
});
```

Run: `pnpm vitest run src/test/selectors.test.ts`

Expected: FAIL because `src/store/selectors.ts` does not exist.

- [ ] **Step 2: Implement pure selectors**

Define the exact input contract:

```ts
export interface FilterInput {
  records: RecordItem[];
  typeId?: string;
  workspaceId: string;
  status: string;
  query: string;
}
```

Move the current filter semantics from `selectFiltered` into `filterRecords`. Implement `countRecordsByType` with one records pass and one initialized result object; exclude archived records and completed todos exactly as `countForType` does today.

- [ ] **Step 3: Replace broad store subscriptions**

Use selectors such as:

```ts
const records = useStore((state) => state.records);
const search = useStore((state) => state.search);
const updateRecord = useStore((state) => state.updateRecord);
```

Do not use bare `useStore()` in application components. Where a component needs several scalar fields, use `useShallow` from `zustand/react/shallow`. Compute `filterRecords` in `useMemo` from only `records`, `search`, `workspaceFilter`, `statusFilter`, and `typeId`.

- [ ] **Step 4: Verify selectors and existing behavior**

Run: `pnpm test && pnpm lint && pnpm build && pnpm test:e2e`

Expected: selector tests and existing tests pass; `rg -n "useStore\(\)" src/components src/App.tsx` returns no matches.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `perf: narrow zustand subscriptions and centralize selectors`

### Task 4: Reduce font payload and report bundle size

**Files:**
- Create: `scripts/report-bundle-size.mjs`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm size`, printing total, font, JavaScript, and CSS byte counts from `dist`.

- [ ] **Step 1: Capture the current bundle baseline**

Run: `pnpm build && find dist/assets -type f -name '*.woff*' -print0 | xargs -0 du -ch | tail -1 && du -sh dist`

Expected baseline: approximately 23 MB of fonts and 24 MB total frontend output.

- [ ] **Step 2: Limit font imports**

Replace current font imports in `src/main.tsx` with:

```ts
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/source-serif-4/latin-600.css';
import '@fontsource/source-serif-4/latin-700.css';
```

Remove all `@fontsource/noto-serif-sc` imports. Keep the package until the production build verifies no remaining import; then remove it with `pnpm remove -D @fontsource/noto-serif-sc`.

- [ ] **Step 3: Prefer system Chinese fonts**

Use these exact stacks in `src/styles.css`:

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text',
  'PingFang SC', 'Hiragino Sans GB', sans-serif;
--font-serif: 'Source Serif 4', 'Songti SC', 'STSong', 'Noto Serif CJK SC', serif;
```

- [ ] **Step 4: Add and run a deterministic size report**

Implement `scripts/report-bundle-size.mjs` using `node:fs/promises` to recursively sum files under `dist`, grouping `.woff`/`.woff2`, `.js`, and `.css`. Print raw byte counts as JSON so future checks can compare numbers.

Add:

```json
"size": "node scripts/report-bundle-size.mjs"
```

Run: `pnpm build && pnpm size`

Expected: font bytes are below 1 MB and the application still displays Chinese using system fonts.

- [ ] **Step 5: Final phase verification and checkpoint**

Run: `pnpm check && pnpm test:e2e && pnpm size`

Expected: all checks pass and the measured result is recorded in `CHANGELOG.md` under the next unreleased entry.

Suggested message: `perf: reduce font payload and add size reporting`
