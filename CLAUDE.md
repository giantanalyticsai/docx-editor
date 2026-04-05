# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

Monorepo for a browser-based WYSIWYG DOCX editor. Bun + React (TSX), ProseMirror-based.

1. **Display DOCX** — render with full WYSIWYG fidelity per ECMA-376 spec
2. **Edit DOCX** — track changes, comments, formatting, tables, images, hyperlinks
3. **Insert docxtemplater variables** — `{variable}` mappings with live preview

Client-side only. No backend.

### Monorepo Structure

| Package                                | Path                 | Description                                                                             |
| -------------------------------------- | -------------------- | --------------------------------------------------------------------------------------- |
| `@giantanalyticsai/docx-core`          | `packages/core`      | Framework-agnostic core: DOCX parsing, ProseMirror schema, layout engine, serialization |
| `@giantanalyticsai/docx-js-editor`     | `packages/react`     | React UI: toolbar, ribbon, paged editor, plugins, components                            |
| `@giantanalyticsai/docx-collab`        | `packages/collab`    | Collaboration support                                                                   |
| `@giantanalyticsai/docx-editor-agents` | `packages/agent-use` | Agent/MCP integration                                                                   |
| Vue scaffold                           | `packages/vue`       | Vue.js — contributions welcome                                                          |

Core entry points: `packages/core/src/core.ts` (main), `packages/core/src/headless.ts` (Node.js API).

---

## Commands

```bash
# Install
bun install

# Dev server (localhost:5173)
bun run dev

# Build (must build core first, then react, then collab — order matters)
bun run build

# Typecheck all packages
bun run typecheck

# Lint / format
bun run lint
bun run lint:fix
bun run format
bun run format:check

# Unit tests
bun test
bun test --watch

# E2E tests — targeted (preferred)
npx playwright test e2e/tests/formatting.spec.ts --timeout=30000
npx playwright test --grep "apply bold" --timeout=30000 --workers=4

# E2E tests — full suite (500+ tests, only for final validation)
npx playwright test --timeout=60000 --workers=4

# Fast verify cycle (use this 95% of the time)
bun run typecheck && npx playwright test --grep "<pattern>" --timeout=30000 --workers=4
```

### E2E Test Notes

- Tests live in `e2e/tests/` (NOT `tests/`). Fixtures in `e2e/fixtures/`, helpers in `e2e/helpers/`.
- Playwright config: `playwright.config.ts` — auto-starts dev server, Chromium only.
- **Never run all 500+ tests at once** unless explicitly validating final results.
- Use `--timeout=30000` and `--workers=4` for local runs.
- **Known flaky tests:** `formatting.spec.ts` (bold toggle/undo/redo), `text-editing.spec.ts` (clipboard ops).

### Test File Mapping

| Feature Area          | Test File                                                  |
| --------------------- | ---------------------------------------------------------- |
| Bold/Italic/Underline | `formatting.spec.ts`                                       |
| Alignment             | `alignment.spec.ts`                                        |
| Lists                 | `lists.spec.ts`                                            |
| Colors                | `colors.spec.ts`                                           |
| Fonts                 | `fonts.spec.ts`                                            |
| Enter/Paragraphs      | `text-editing.spec.ts`                                     |
| Undo/Redo             | `scenario-driven.spec.ts`                                  |
| Line spacing          | `line-spacing.spec.ts`                                     |
| Paragraph styles      | `paragraph-styles.spec.ts`                                 |
| Toolbar state         | `toolbar-state.spec.ts`                                    |
| Cursor-only ops       | `cursor-paragraph-ops.spec.ts`                             |
| Tables                | `tables.spec.ts`, `table-merge-split.spec.ts`              |
| Hyperlinks            | `hyperlinks.spec.ts`, `hyperlink-popup.spec.ts`            |
| Ribbon UI             | `ribbon-*.spec.ts` (many files by feature)                 |
| Images                | `image-roundtrip.spec.ts`, `clipboard-image-paste.spec.ts` |
| Visual regression     | `visual-regression.spec.ts`, `visual-check.spec.ts`        |

---

## ECMA-376 Reference

```
reference/quick-ref/wordprocessingml.md   # Paragraphs, runs, formatting
reference/quick-ref/themes-colors.md      # Theme colors, fonts, tints
reference/ecma-376/part1/schemas/wml.xsd  # WordprocessingML schema
reference/ecma-376/part1/schemas/dml-main.xsd # DrawingML schema
```

---

## WYSIWYG Fidelity — Hard Rule

Output must look identical to Microsoft Word. Must preserve: fonts, theme colors, styles, character formatting, tables (borders, shading, merged cells), headers/footers, section layout (margins, page size, orientation).

---

## Editor Architecture — Dual Rendering System

**This editor has TWO separate rendering systems. You MUST understand which one you're working with.**

```
┌──────────────────────────────────────────────────────────────┐
│  HIDDEN ProseMirror (left: -9999px)                          │
│  - Real editing state (selection, undo/redo, commands)       │
│  - Receives keyboard input                                   │
│  - CSS class: .paged-editor__hidden-pm                       │
│  - Component: packages/react/src/paged-editor/              │
│               HiddenProseMirror.tsx                           │
└──────────────────────────────────────────────────────────────┘
        │ state changes trigger re-render ↓
┌──────────────────────────────────────────────────────────────┐
│  VISIBLE Pages (layout-painter)                              │
│  - What the user actually sees                               │
│  - Static DOM, re-built from PM state on every change        │
│  - Has its own rendering logic (NOT toDOM)                   │
│  - CSS class: .paged-editor__pages                           │
│  - Entry: packages/core/src/layout-painter/renderPage.ts     │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

```
DOCX file
  → unzip.ts → parser.ts → Document model (packages/core/src/types/)
  → toProseDoc.ts → ProseMirror document
  → HiddenProseMirror renders off-screen
  → PagedEditor.tsx reads PM state → layout-painter renders visible pages
  → User edits → PM state updates → layout-painter re-renders

Saving:
  PM state → fromProseDoc.ts → Document model → serializer/ → XML → rezip.ts → DOCX
```

### Click/Selection Flow

User clicks on visible page → `PagedEditor.handlePagesMouseDown()` → `getPositionFromMouse(clientX, clientY)` maps pixel coordinates to a PM document position → `hiddenPMRef.current.setSelection(pos)` → PM state update → visible pages re-render with selection overlay.

### Debugging Checklist

1. **Visual rendering bug or editing/data bug?**
   - Visual only → fix in `packages/core/src/layout-painter/`
   - Editing behavior → fix in `packages/core/src/prosemirror/extensions/`
   - Both → likely need changes in both systems

2. **Which renderer owns the output?**
   - Visible pages are rendered by `layout-painter/`, NOT by ProseMirror's `toDOM`
   - If you fix `toDOM` for a visual bug, **the user won't see the change**

3. **Where does the data come from?**
   - DOCX XML → `packages/core/src/docx/` parsers → `Document` model in `packages/core/src/types/`
   - `toProseDoc.ts` converts Document → PM nodes
   - `fromProseDoc.ts` converts PM → Document (round-trip for saving)

### Key File Map

All paths relative to repo root.

| What you're debugging                | Look here                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------- |
| How text/paragraphs appear on screen | `packages/core/src/layout-painter/renderParagraph.ts`                      |
| How images appear on screen          | `packages/core/src/layout-painter/renderImage.ts`                          |
| How tables appear on screen          | `packages/core/src/layout-painter/renderTable.ts`                          |
| How pages are composed               | `packages/core/src/layout-painter/renderPage.ts`                           |
| How a formatting command works       | `packages/core/src/prosemirror/extensions/` (marks/ and nodes/)            |
| How keyboard shortcuts work          | `packages/core/src/prosemirror/extensions/features/BaseKeymapExtension.ts` |
| How toolbar reflects selection       | `packages/core/src/prosemirror/plugins/selectionTracker.ts`                |
| How DOCX XML is parsed               | `packages/core/src/docx/paragraphParser.ts`, `tableParser.ts`, etc.        |
| How PM doc is built from parsed data | `packages/core/src/prosemirror/conversion/toProseDoc.ts`                   |
| Schema (node/mark definitions)       | `packages/core/src/prosemirror/extensions/nodes/`, `marks/`                |
| Table toolbar/dropdown               | `packages/react/src/components/ui/TableOptionsDropdown.tsx`                |
| Main toolbar                         | `packages/react/src/components/Toolbar.tsx`                                |
| Ribbon UI                            | `packages/react/src/components/Ribbon/`                                    |
| React editor component               | `packages/react/src/components/DocxEditor.tsx`                             |
| CSS for editor                       | `packages/react/src/styles/`                                               |

### Extension System

Extensions live in `packages/core/src/prosemirror/extensions/`:

- `nodes/` — ParagraphExtension, TableExtension, ImageExtension, etc.
- `marks/` — BoldExtension, ColorExtension, FontExtension, etc.
- `features/` — BaseKeymapExtension, ListExtension, HistoryExtension, etc.
- `StarterKit.ts` bundles all extensions; `ExtensionManager` builds schema + runtime
- Two-phase init: `ExtensionManager.buildSchema()` (sync) → `initializeRuntime()` (after EditorState)

### Common Pitfalls

- **Toolbar icons**: Icons in `packages/react/src/components/ui/Icons.tsx` use inline SVGs, NOT a font. `<MaterialSymbol name="foo">` looks up the icon in `iconMap`. If the name isn't in the map, it renders as raw text. **Always add new icons as SVG path components** and register them in `iconMap`.
- **Tailwind CSS conflicts**: Library CSS is scoped via `.ep-root` but layout-painter output isn't always protected. Use explicit inline styles on painted elements.
- **ProseMirror focus stealing**: Any mousedown that propagates to the PM view will move the cursor. Dropdown/dialog elements need `onMouseDown` with `stopPropagation()`.
- **Never use `require()`** in extension files — Vite/ESM only.
- **Build order matters**: Core must build before react package (`bun run build` handles this).

---

## Issue-Driven Bug Fix Workflow

Issue tracker: **https://github.com/giantanalyticsai/docx-editor/issues**

```bash
gh issue view <N> --repo giantanalyticsai/docx-editor
```

1. **Read** the issue — get description, repro steps, attached files
2. **Reproduce** locally — `bun run dev` + browser at `localhost:5173`
3. **Investigate** root cause — use Debugging Checklist + Key File Map above
4. **Fix** — minimal change, fix the right renderer (layout-painter vs PM)
5. **Test** — add/update Playwright E2E tests in `e2e/tests/`
6. **Verify** — `bun run typecheck` + targeted Playwright tests + visual check
7. **Commit** — reference issue number: `fix: ... (fixes #N)`
8. **PR** — `gh pr create` referencing issue, include screenshots for visual bugs

---

## Pre-PR Self-Review

1. **DRY** — Is the same logic/style repeated across files? Extract shared code.
2. **KISS** — Is the solution more complex than needed? Simpler alternatives?
3. **YAGNI** — Did you add anything not required by the task? Remove it.
4. **Formatting** — Run `bun run format` to ensure Prettier compliance before pushing.

---

## When Stuck

1. **Type error?** Read the actual types, don't guess
2. **Test failing?** Run with `--debug` and check console output
3. **Selection bug?** Add `console.log` in `getSelectionRange()` to trace
4. **OOXML spec question?** Check `reference/quick-ref/` or ECMA-376 schemas
5. **Timeout?** Kill command, narrow test scope, retry

---

## i18n (Internationalization)

All user-facing strings are translatable via a lightweight i18n system (no external dependencies).

### Key Files

| What                    | Where                                       |
| ----------------------- | ------------------------------------------- |
| Default English strings | `packages/react/i18n/en.json`               |
| Types (auto-derived)    | `packages/react/src/i18n/types.ts`          |
| Context + hook          | `packages/react/src/i18n/LocaleContext.tsx` |
| Barrel export           | `packages/react/src/i18n/index.ts`          |

### How It Works

- `LocaleStrings` type is auto-derived from `en.json` via `typeof import` — no manual interface
- `TranslationKey` is a union of all valid dot-paths (e.g., `"toolbar.bold" | "dialogs.findReplace.title" | ...`)
- `<DocxEditor i18n={de} />` deep-merges with English defaults (null keys fall back to English)
- `useTranslation()` hook returns `t(key, vars?)` for string lookup with `{variable}` interpolation

### Using t() in Components

```typescript
import { useTranslation } from '../i18n'; // adjust path

function MyComponent() {
  const { t } = useTranslation();
  return <button title={t('toolbar.bold')}>{t('common.apply')}</button>;
}

// With interpolation:
t('dialogs.findReplace.matchCount', { current: 3, total: 15 })
// → "3 of 15 matches"
```

### Adding a New String

1. Add the key + English value to `i18n/en.json` (nest by feature area)
2. Use `t('your.new.key')` in the component — types update automatically
3. Run `bun run i18n:fix` to sync community locale files (adds new keys as `null`)

### Locale Key States

| Value       | Meaning            | Behavior                              |
| ----------- | ------------------ | ------------------------------------- |
| `"Fett"`    | Translated         | Displayed to user                     |
| `null`      | Not yet translated | Falls back to English                 |
| _(missing)_ | Out of sync        | **CI fails** — run `bun run i18n:fix` |

### i18n CLI

```bash
bun run i18n:new <lang>   # scaffold new locale (e.g., bun run i18n:new de)
bun run i18n:status        # show translation coverage for all locales
bun run i18n:validate      # check all locale files in sync with en.json
bun run i18n:fix           # auto-add missing keys as null, remove extras
```

### When adding UI strings

**Always** use `t()` for user-facing text. Never hardcode English strings in components. After adding new keys to `en.json`, run `bun run i18n:fix` to sync all community locale files.

Full contribution guide: `docs/i18n.md`

---

## Rules

- Client-side only. No backend.
- Toolbar icons are Material Symbol fonts (same as Google Docs), saved locally as SVGs.
- Save screenshots to `screenshots/` folder.
