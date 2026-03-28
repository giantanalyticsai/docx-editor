# Tech Spec: Legal Review Features

## Metadata

| Field      | Value                                                                                 |
| ---------- | ------------------------------------------------------------------------------------- |
| **Author** | Yash Sharma                                                                           |
| **Status** | Approved                                                                              |
| **Date**   | 2026-03-26                                                                            |
| **ADR**    | [ADR-0001: Native Legal Review Features](../adr/0001-native-legal-review-features.md) |
| **Repo**   | `giantanalyticsai/docx-editor`                                                        |

---

## 1. Overview

Four native features for legal document review workflows, built into the `docx-editor` library.

**Inputs:** User interaction (clicks, keyboard shortcuts), ProseMirror editor state, template plugin state.

**Outputs:** Updated editor state (tracked changes, comments, renamed template fields), new exported TypeScript commands (`replaceWithTracking`, `findTextPositions`).

**Boundary:** These features do not add backend dependencies, authentication, or real-time collaboration. Client-side only.

---

## 2. Feature Specifications & API Contracts

### 2.1 Review Mode Toolbar

**What:** Four toolbar buttons rendered inside `toolbarChildren` when `editingMode === 'suggesting'`:

- Accept all changes
- Reject all changes
- Navigate to previous change
- Navigate to next change

**Where:** `packages/react/src/components/DocxEditor.tsx` — `toolbarChildren` block (~line 3340).

**Logic:**

```typescript
// Accept all — reuses existing command
acceptAllChanges()(view.state, view.dispatch);
extractTrackedChanges(view.state); // refresh sidebar

// Reject all
rejectAllChanges()(view.state, view.dispatch);

// Next change — scrolls editor to the found range
const range = findNextChange(view.state, view.state.selection.from);
if (range) {
  const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to));
  view.dispatch(tr);
  editorRef.current?.scrollToPosition(range.from);
}

// Prev change — same but findPreviousChange
```

**Imported from (already exist):**

- `acceptAllChanges`, `rejectAllChanges`, `findNextChange`, `findPreviousChange` from `@eigenpal/docx-core/prosemirror/commands/comments`

**Icons (MaterialSymbol):** `done_all` (accept all), `close` (reject all), `navigate_before`, `navigate_next`

**Condition:** Buttons only render when `editingMode === 'suggesting'`, grouped with a `ToolbarSeparator`.

---

### 2.2 Comment Creation UI

**What:** Three entry points to start adding a comment:

1. Toolbar button (`add_comment` icon)
2. Keyboard shortcut `Ctrl+Alt+M` / `Cmd+Opt+M`
3. Default right-click context menu item "Comment"

**Where:**

- `packages/react/src/components/DocxEditor.tsx`
- `packages/react/src/components/TextContextMenu.tsx`

**Extracted handler (removes duplication):**

```typescript
// Extracted from handleContextMenuAction case 'addComment' (lines 2410-2432)
const handleStartAddComment = useCallback(() => {
  const view = getActiveEditorView();
  if (!view) return;
  const { from, to } = view.state.selection;
  if (from === to) return; // no selection
  const yPos = findSelectionYPosition(scrollContainerRef.current, editorContentRef.current, from);
  setCommentSelectionRange({ from, to });
  const pendingMark = view.state.schema.marks.comment.create({ commentId: PENDING_COMMENT_ID });
  const tr = view.state.tr.addMark(from, to, pendingMark);
  tr.setSelection(TextSelection.create(tr.doc, to));
  view.dispatch(tr);
  setAddCommentYPosition(yPos);
  setShowCommentsSidebar(true);
  setIsAddingComment(true);
  setFloatingCommentBtn(null);
}, [getActiveEditorView]);
```

**Toolbar button:** Added next to the comment sidebar toggle button (line ~3343). Disabled when `view.state.selection.empty`.

**Keyboard shortcut:** Added to the container `onKeyDown` handler:

```typescript
if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'm') {
  e.preventDefault();
  handleStartAddComment();
}
```

**Context menu default items** (`TextContextMenu.tsx` — `DEFAULT_MENU_ITEMS` array):

```typescript
{ action: 'addComment', label: 'Comment', shortcut: '⌘⌥M' }
```

Added after the existing `selectAll` entry.

---

### 2.3 Template Field Inline Editing Popup

**What:** Clicking a `{variable}` tag in the document opens an inline popup for renaming the variable. Renders inside the template plugin's overlay layer.

**New file:** `packages/react/src/plugins/template/components/TemplateFieldPopup.tsx`

**TypeScript interface:**

```typescript
interface TemplateFieldPopupProps {
  tag: TemplateTag;
  context: RenderedDomContext;
  editorView: EditorView;
  onClose: () => void;
}
```

**Positioning:** Uses `context.getRectsForRange(tag.from, tag.to)` to find the tag's bounding rect, renders as an absolutely positioned div below the first rect.

**Rename logic:**

```typescript
function handleApply(newName: string) {
  const { schema } = editorView.state;
  // Construct new tag text preserving the prefix (#, /, ^, @)
  const prefix =
    tag.type === 'sectionStart'
      ? '#'
      : tag.type === 'sectionEnd'
        ? '/'
        : tag.type === 'invertedStart'
          ? '^'
          : tag.type === 'raw'
            ? '@'
            : '';
  const newTagText = `{${prefix}${newName}}`;
  const tr = editorView.state.tr.replaceWith(
    tag.from,
    tag.to,
    editorView.state.schema.text(newTagText)
  );
  editorView.dispatch(tr);
  onClose();
}
```

**Dismiss behavior:**

- Escape key → `onClose()`
- Click outside (document `mousedown` listener) → `onClose()`
- `onMouseDown={e => e.stopPropagation()}` to prevent PM focus-stealing

**Template plugin integration** (`packages/react/src/plugins/template/index.ts`):

```typescript
// In renderOverlay, after TemplateHighlightOverlay:
if (state.selectedId) {
  const selectedTag = state.tags.find((t) => t.id === state.selectedId);
  if (selectedTag && editorView) {
    elements.push(
      React.createElement(TemplateFieldPopup, {
        key: 'field-popup',
        tag: selectedTag,
        context,
        editorView,
        onClose: () => setSelectedElement(editorView, undefined),
      })
    );
  }
}
```

---

### 2.4 Find & Replace with Track Changes

**What:** ProseMirror-level commands that find text in the document and replace it with tracked change marks (deletion on old text, insertion on new text). Replaces the frontend's manual document tree walk.

**New file:** `packages/core/src/prosemirror/commands/findAndReplace.ts`

**Exported API:**

```typescript
/**
 * Find all occurrences of searchText in the PM document.
 * Returns PM position ranges (inclusive from, exclusive to).
 */
export function findTextPositions(
  doc: PMNode,
  searchText: string,
  options?: { matchCase?: boolean }
): Array<{ from: number; to: number }>;

/**
 * Replace all occurrences of searchText with replaceText, applying
 * deletion marks to old text and insertion marks to new text.
 * Works regardless of whether suggestion mode is currently active.
 */
export function replaceWithTracking(
  searchText: string,
  replaceText: string,
  options?: { author?: string; matchCase?: boolean }
): Command;

/**
 * Replace only the next occurrence after the current cursor position.
 */
export function replaceNextWithTracking(
  searchText: string,
  replaceText: string,
  options?: { author?: string; matchCase?: boolean }
): Command;
```

**`findTextPositions` implementation strategy:**

Reuse the same pattern as the template plugin's `findTags` (collects text parts from `doc.descendants`, builds a combined string + position map, then applies regex/indexOf):

```typescript
export function findTextPositions(doc, searchText, options) {
  const { matchCase = false } = options ?? {};
  const parts: { text: string; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) parts.push({ text: node.text, pos });
    return true;
  });

  let combined = '';
  const posMap: number[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.text.length; i++) posMap.push(p.pos + i);
    combined += p.text;
  }

  const needle = matchCase ? searchText : searchText.toLowerCase();
  const haystack = matchCase ? combined : combined.toLowerCase();
  const results: Array<{ from: number; to: number }> = [];
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    results.push({ from: posMap[idx], to: posMap[idx + searchText.length - 1] + 1 });
    idx += searchText.length;
  }
  return results;
}
```

**`replaceWithTracking` implementation:**

Process matches in reverse order to preserve position validity:

```typescript
export function replaceWithTracking(searchText, replaceText, options): Command {
  return (state, dispatch) => {
    const matches = findTextPositions(state.doc, searchText, options);
    if (matches.length === 0) return false;
    if (!dispatch) return true;

    const { author = 'User', matchCase = false } = options ?? {};
    const { insertion: insertionType, deletion: deletionType } = state.schema.marks;
    const now = new Date().toISOString();

    let tr = state.tr;
    // Process in reverse so later positions stay valid
    for (let i = matches.length - 1; i >= 0; i--) {
      const { from, to } = matches[i];
      const revisionId = Date.now() + i; // unique per change
      const attrs = { revisionId, author, date: now };

      // Mark old text as deleted
      tr = tr.addMark(from, to, deletionType.create(attrs));

      // Insert new text with insertion mark after the deleted range
      if (replaceText.length > 0) {
        const insertionMark = insertionType.create(attrs);
        const newNode = state.schema.text(replaceText, [insertionMark]);
        tr = tr.insert(to, newNode);
      }
    }

    // Prevent suggestionMode's appendTransaction from double-marking
    tr.setMeta('suggestionModeApplied', true);
    dispatch(tr);
    return true;
  };
}
```

**Export chain:**

- `packages/core/src/prosemirror/commands/findAndReplace.ts` (new file)
- Add to `packages/core/src/core.ts` barrel exports
- Re-export from `packages/react/src/index.ts`

---

## 3. Dependencies

No new runtime dependencies. All implementations use existing:

| Dependency          | Already present | Used by                   |
| ------------------- | --------------- | ------------------------- |
| `prosemirror-state` | yes             | Feature 4 commands        |
| `prosemirror-view`  | yes             | Feature 3 popup           |
| `prosemirror-model` | yes             | Feature 4 mark creation   |
| `react`             | yes             | Feature 3 popup component |

---

## 4. Data Models

### Tracked change attributes (existing, unchanged)

```typescript
interface TrackedChangeAttrs {
  revisionId: number;
  author: string;
  date?: string;
}
```

### TemplateFieldPopup position

```typescript
interface PopupPosition {
  top: number; // px, relative to overlay container
  left: number; // px
}
// Derived from RenderedDomContext.getRectsForRange(tag.from, tag.to)[0]
```

---

## 5. Error Handling

| Scenario                                      | Handling                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `findTextPositions` — search text not found   | Returns empty array; `replaceWithTracking` returns `false` without dispatching |
| `TemplateFieldPopup` — tag position not found | `getRectsForRange` returns empty array; popup does not render                  |
| `handleStartAddComment` — no selection        | Early return; no state changes                                                 |
| `findNextChange` — no changes in document     | Returns `null`; next/prev buttons are no-ops                                   |
| Empty `replaceText`                           | Only deletion mark applied; no insertion node created                          |

---

## 6. Test Plan

### Feature 1: Review Mode Toolbar

| Test                                  | File                            | Validates                                                                         |
| ------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------- |
| Accept all clears all insertion marks | `tests/scenario-driven.spec.ts` | Enter suggesting mode → type text → click Accept All → verify no green underlines |
| Reject all removes inserted text      | `tests/scenario-driven.spec.ts` | Enter suggesting mode → type text → click Reject All → text is gone               |
| Next/prev cycles through changes      | `tests/scenario-driven.spec.ts` | Multiple tracked changes → navigate forward and backward                          |
| Buttons only show in suggesting mode  | `tests/toolbar-state.spec.ts`   | In editing mode, review buttons absent; in suggesting mode, present               |

### Feature 2: Comment Creation UI

| Test                            | File                            | Validates                                                           |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------- |
| Toolbar button creates comment  | `tests/scenario-driven.spec.ts` | Select text → click Add Comment → AddCommentCard appears in sidebar |
| Keyboard shortcut `Ctrl+Alt+M`  | `tests/scenario-driven.spec.ts` | Select text → press shortcut → AddCommentCard appears               |
| Context menu includes "Comment" | `tests/scenario-driven.spec.ts` | Right-click with selection → "Comment" menu item visible            |
| No selection → button disabled  | `tests/toolbar-state.spec.ts`   | Click in doc without selection → Add Comment button is disabled     |

### Feature 3: Template Field Popup

| Test                           | File                            | Validates                                                       |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------- |
| Click `{variable}` shows popup | `tests/scenario-driven.spec.ts` | Load doc with `{name}` → click tag → popup appears with input   |
| Rename updates document text   | `tests/scenario-driven.spec.ts` | Rename `{name}` to `{fullName}` → doc now contains `{fullName}` |
| Escape dismisses popup         | `tests/scenario-driven.spec.ts` | Open popup → press Escape → popup gone                          |
| Click outside dismisses popup  | `tests/scenario-driven.spec.ts` | Open popup → click elsewhere → popup gone                       |
| Section prefix preserved       | `tests/scenario-driven.spec.ts` | Rename `{#section}` to `{#newSection}` → prefix `#` preserved   |

### Feature 4: Find & Replace with Track Changes

| Test                                                     | File                                                            | Validates                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `findTextPositions` finds all occurrences                | `packages/core/src/prosemirror/commands/findAndReplace.test.ts` | PM doc with "foo foo" → 2 matches at correct positions                       |
| `replaceWithTracking` applies deletion + insertion marks | unit                                                            | "hello" → "goodbye": old text has deletion mark, new text has insertion mark |
| Reverse order processing preserves positions             | unit                                                            | 3 matches — all replaced correctly                                           |
| Case-insensitive matching                                | unit                                                            | `matchCase: false` finds "Foo" when searching "foo"                          |
| Empty replacement → only deletion mark                   | unit                                                            | Replace "foo" with "" → deletion mark only, no insertion                     |
| No matches → returns false, no dispatch                  | unit                                                            | Search text not present → command returns false                              |

---

## 7. Open Questions

All resolved before implementation:

- [x] **Where do ADR/spec live?** → In `docx-editor` service repo at `docs/adr/` and `docs/specs/` (service-scoped decisions)
- [x] **Tech spec format?** → Adapted template; Docker/gRPC/CI/Observability sections omitted (client-side library)
- [x] **`SUGGESTION_META` export needed?** → No — hardcode the string `'suggestionModeApplied'` in `findAndReplace.ts` (same value as in `suggestionMode.ts`). Avoids a coupling dependency.

---

## 8. References

- [ADR-0001: Native Legal Review Features](../adr/0001-native-legal-review-features.md)
- `packages/core/src/prosemirror/commands/comments.ts` — existing accept/reject commands
- `packages/core/src/prosemirror/plugins/suggestionMode.ts` — suggestion mode, `SUGGESTION_META` constant
- `packages/react/src/plugins/template/prosemirror-plugin.ts` — `findTags` pattern reused by `findTextPositions`
- `packages/react/src/plugins/template/components/TemplateHighlightOverlay.tsx` — overlay positioning pattern
- `packages/react/src/components/DocxEditor.tsx` lines 2410–2432 — `addComment` handler being extracted
