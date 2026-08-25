# Writing and Visual Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe Markdown writing and preview, recoverable drafts, light/dark/system themes, motion controls, Chinese typography, and portable exports.

**Architecture:** Markdown remains plain source in SQLite. Focused feature modules own rendering, summaries, drafts, themes, and export serialization; components consume those modules without embedding parsing or file-system logic.

**Tech Stack:** React 19, TypeScript, `react-markdown`, `remark-gfm`, `remove-markdown`, Tauri dialog/fs/shell plugins, CSS custom properties, Vitest, Testing Library, Playwright.

## Global Constraints

- Complete `2026-08-17-tauri-sqlite.md` first.
- Use a textarea with an Edit/Preview switch; do not add a rich-text or WYSIWYG editor.
- Store Markdown source only; never persist rendered HTML.
- Do not enable raw HTML in Markdown.
- Open only validated HTTPS links through `DesktopPlatform.openExternal`.
- Respect both system reduced-motion preference and the application motion setting.
- Keep all four export formats: JSON, Markdown, CSV, and HTML.
- The folder currently has no Git metadata. Run commit checkpoints only after a repository is attached or initialized by the user.

---

## File Structure

- `src/features/markdown/MarkdownPreview.tsx`: safe GFM rendering.
- `src/features/markdown/MarkdownEditor.tsx`: edit/preview control.
- `src/features/markdown/plainText.ts`: Markdown-to-summary conversion.
- `src/features/drafts/useRecordDraft.ts`: debounced draft persistence and recovery.
- `src/features/theme/theme.ts`: resolves system/application theme and motion.
- `src/features/export/serializers.ts`: pure JSON/Markdown/CSV/HTML serializers.
- `src/features/export/exportService.ts`: file picker and file writing.
- `src/styles/`: split tokens, components, Markdown, and themes from the monolithic stylesheet.

### Task 1: Render safe Markdown and plain-text summaries

**Files:**
- Create: `src/features/markdown/MarkdownPreview.tsx`
- Create: `src/features/markdown/plainText.ts`
- Create: `src/features/markdown/markdown.css`
- Create: `src/test/markdown.test.tsx`
- Modify: `src/components/RecordRow.tsx`
- Modify: `src/components/RecordsView.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `MarkdownPreview({ source, onOpenExternal })`.
- Produces: `markdownToPlainText(source: string): string`.
- Produces: `markdownSummary(source: string, maxLength?: number): string`.

- [x] **Step 1: Install lightweight Markdown dependencies**

Run:

```bash
pnpm add react-markdown remark-gfm remove-markdown
```

- [x] **Step 2: Write rendering and security tests**

Test the following source:

```ts
const source = '# 标题\n\n- 列表\n\n```bash\npnpm test\n```\n\n[论文](https://doi.org/10.1000/test)\n<script>alert(1)</script>';
```

Assertions:

- heading, list, and code block render;
- no `<script>` element exists;
- clicking the DOI calls `onOpenExternal` with the HTTPS URL;
- `markdownSummary(source)` contains `标题` and `列表` but not `#`, backticks, or HTML tags.

Run: `pnpm vitest run src/test/markdown.test.tsx`

Expected: FAIL because the feature files do not exist.

- [x] **Step 3: Implement preview and summaries**

Render with:

```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    a: ({ href, children }) => (
      <a href={href} onClick={(event) => {
        event.preventDefault();
        if (href) void onOpenExternal(href);
      }}>{children}</a>
    ),
  }}
>
  {source}
</ReactMarkdown>
```

Do not import or configure `rehype-raw`. Use `remove-markdown` for summaries, collapse whitespace, trim, and truncate at 160 Unicode code points by default.

- [x] **Step 4: Replace raw content snippets**

Use `markdownSummary(record.content)` in `RecordRow`. Render `MarkdownPreview` in direction cards instead of `white-space: pre-line`, with an eight-line visual clamp around the preview container.

Run: `pnpm test && pnpm lint && pnpm build`

Expected: all Markdown tests and existing tests pass.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: render safe markdown content and summaries`

### Task 2: Add Edit/Preview mode and draft recovery

**Files:**
- Create: `src/features/markdown/MarkdownEditor.tsx`
- Create: `src/features/drafts/useRecordDraft.ts`
- Create: `src/test/recordDraft.test.tsx`
- Modify: `src/components/EditorModal.tsx`
- Modify: `src/components/Modal.tsx`

**Interfaces:**
- Produces: `MarkdownEditor({ value, onChange, onOpenExternal })`.
- Produces: `useRecordDraft({ draftId, recordId, initialPayload, repository, debounceMs })`.
- Changes: `Modal.onRequestClose(reason)` returns `boolean | Promise<boolean>` before closing.

- [x] **Step 1: Write close-protection and draft tests**

Test that editing content then pressing Escape opens a confirmation and leaves the modal open when the user rejects. With a fake repository and fake timers, type content, advance 500 ms, and assert `saveDraft` receives serialized title/content/fields. Remount and assert the saved draft is offered for recovery.

Run: `pnpm vitest run src/test/recordDraft.test.tsx`

Expected: FAIL because the hook and close contract do not exist.

- [x] **Step 2: Implement the Markdown editor**

Use two buttons with `aria-pressed` for `编辑` and `预览`. Edit mode renders the existing textarea. Preview mode renders `MarkdownPreview`; empty content shows `暂无可预览内容`. Preserve cursor/content by keeping a single controlled string in `EditorModal`.

- [x] **Step 3: Implement drafts**

Use draft IDs `record:<recordId>` for existing records and a UUID-based `new:<uuid>` for new sessions. Serialize only editor fields, not functions. Debounce writes by 500 ms. Delete the draft after a successful record save or an explicit “丢弃更改”.

- [x] **Step 4: Protect every close path**

Route Escape, overlay click, close button, and Cancel through `onRequestClose`. Compare the normalized current draft to the initial editor payload. Show one confirmation with choices “继续编辑” and “丢弃更改”; do not use multiple nested browser confirmations.

Run: `pnpm test && pnpm test:e2e && pnpm build`

Expected: draft tests pass; saving removes the draft; rejected close retains content.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: add markdown editing and recoverable drafts`

### Task 3: Add theme and motion settings

**Files:**
- Create: `src/features/theme/theme.ts`
- Create: `src/features/theme/useAppearance.ts`
- Create: `src/test/theme.test.ts`
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/components/MusicNotes.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `resolveTheme(mode, systemDark): 'light' | 'dark'`.
- Produces: `resolveReducedMotion(mode, systemReduced): boolean`.
- Applies: `document.documentElement.dataset.theme` and `.dataset.motion`.

- [x] **Step 1: Write appearance-resolution tests**

```ts
expect(resolveTheme('system', true)).toBe('dark');
expect(resolveTheme('light', true)).toBe('light');
expect(resolveReducedMotion('system', true)).toBe(true);
expect(resolveReducedMotion('full', true)).toBe(false);
```

Run: `pnpm vitest run src/test/theme.test.ts`

Expected: FAIL because the functions do not exist.

- [x] **Step 2: Implement system listeners and persisted settings**

Subscribe to `(prefers-color-scheme: dark)` and `(prefers-reduced-motion: reduce)`. Resolve against SQLite `AppSettings`. Apply `data-theme="dark|light"` and `data-motion="reduce|full"` to `<html>` and remove listeners on cleanup.

- [x] **Step 3: Convert colors to semantic CSS variables**

Keep existing light variables, add `[data-theme='dark']` overrides for paper, surface, ink, muted, line, accent, shadows, form backgrounds, status pills, Markdown code blocks, and scrollbars. Replace remaining hard-coded light backgrounds used by content components.

- [x] **Step 4: Add controls and reduce decorative motion**

Settings offer three theme choices (`跟随系统`, `浅色`, `月夜`) and three motion choices (`跟随系统`, `减少动效`, `完整动效`). Under `[data-motion='reduce']`, disable floating-note, modal, completion, and drag transition animations. In full motion, increase note duration and reduce opacity relative to current values.

Run: `pnpm test && pnpm test:e2e && pnpm build`

Expected: preferences persist and system changes update immediately in system mode.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: add moonlight theme and motion preferences`

### Task 4: Improve Chinese typography and split styles by responsibility

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/layout.css`
- Create: `src/styles/components.css`
- Create: `src/styles/themes.css`
- Modify: `src/styles.css`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: one import entry `src/styles.css` that composes the four focused files and Markdown CSS.

- [ ] **Step 1: Capture visual regression screenshots**

Run the existing app at 1280×820 and capture dashboard, project list, editor, settings, and dark theme screenshots through Playwright. Store the temporary comparison images under `test-results/visual-baseline/`; they are execution evidence and are not added to application source.

- [ ] **Step 2: Move CSS without changing selectors**

Move variables/font stacks to `tokens.css`, root layout/titlebar/sidebar/topbar to `layout.css`, reusable cards/forms/modals/views to `components.css`, and theme/motion overrides to `themes.css`. `styles.css` contains only ordered `@import` rules.

- [x] **Step 3: Apply Chinese typography rules**

Use:

```css
.markdown-body,
.rc-content {
  line-height: 1.75;
  overflow-wrap: anywhere;
  text-autospace: normal;
}

.record-meta,
.due-badge,
.day-date,
.week-range {
  font-variant-numeric: tabular-nums;
}

.record-title,
.page-title {
  text-wrap: pretty;
}
```

Treat `text-autospace` and `text-wrap` as progressive enhancement; no JavaScript spacing processor is added.

- [ ] **Step 4: Verify layout and accessibility**

Run: `pnpm lint && pnpm build && pnpm test:e2e`

Manually compare the five screenshots at 1280×820 and minimum 960×640. Confirm Markdown code blocks scroll horizontally, long Chinese titles wrap, and focus rings remain visible in both themes.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `refactor: split styles and improve chinese typography`

### Task 5: Add JSON, Markdown, CSV, and HTML export

**Files:**
- Create: `src/features/export/serializers.ts`
- Create: `src/features/export/exportService.ts`
- Create: `src/test/export.test.ts`
- Modify: `src/components/SettingsView.tsx`
- Modify: `src/repositories/WorkbenchRepository.ts`

**Interfaces:**
- Produces: `serializeJson(snapshot)`, `serializeMarkdown(snapshot)`, `serializeCsv(snapshot)`, `serializeHtml(snapshot)`.
- Produces: `exportSnapshot(format, snapshot, platform): Promise<'saved' | 'cancelled'>`.

- [x] **Step 1: Write serializer tests**

Use records containing commas, quotes, Chinese, Markdown code fences, and spreadsheet-like values beginning with `=`, `+`, `-`, and `@`. Assert CSV follows RFC 4180 quoting and prefixes spreadsheet-formula cells with `'`. Assert HTML escapes raw record content before Markdown rendering and includes UTF-8 metadata.

Run: `pnpm vitest run src/test/export.test.ts`

Expected: FAIL because serializers do not exist.

- [x] **Step 2: Implement pure serializers**

Install the explicit HTML pipeline:

```bash
pnpm add unified remark-parse remark-gfm remark-rehype rehype-sanitize rehype-stringify
```

JSON uses the complete `WorkbenchSnapshot` plus `app`, schema version, and export timestamp. Markdown creates one folder-safe document body with headings per type and record. CSV uses one row per record with core columns and JSON-encoded custom fields. HTML uses the explicit unified pipeline above and produces a standalone UTF-8 document with embedded minimal CSS and sanitized rendered Markdown.

- [x] **Step 3: Implement save dialogs**

Use the Tauri dialog plugin to choose a path and fs plugin to write UTF-8 bytes. Suggested filenames use `research-workbench-YYYY-MM-DD` and the correct extension. Cancel returns `cancelled` without displaying an error.

- [x] **Step 4: Expose export choices in Settings**

Replace the single JSON export button with a menu or four clearly labeled buttons. Show a success message containing the saved filename; on failure, show the error and leave data unchanged.

Run: `pnpm test && pnpm test:e2e && pnpm build:desktop`

Expected: all serializers pass and each format saves from the packaged app.

- [ ] **Step 5: Commit checkpoint**

Suggested message: `feat: export workbench data in portable formats`
