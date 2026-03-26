# ADR-0001: Native Legal Review Features in the Editor Library

## Status

Accepted

## Context

The docx-editor library is used by the Grayscope AI legal frontend (`grayscope-ai-legal-frontend`) as its core document editing component. Lawyers using the product rely on three workflows that align with Microsoft Word's "Review" tab:

1. **Redlining (Track Changes)** — AI suggestions and manual edits recorded as tracked insertions/deletions that lawyers can accept or reject
2. **Comments** — Inline annotations anchored to text ranges, used for feedback and discussion during contract review
3. **Template variable editing** — Clicking a `{variable}` placeholder to rename or configure it without leaving the editor

The frontend app built workarounds for all three:

- **Track changes UI**: No toolbar buttons for accept/reject all or change navigation. The commands exist in the library but have no UI entry points.
- **Comment creation**: A right-click context menu action exists but is not included in the default menu items. There is no toolbar button or keyboard shortcut.
- **Template field popup**: A 584-line `templateFieldPlugin.tsx` using module-level state (`let _popupField`, `let _listeners`, etc.) to survive React re-render cycles inside the editor's overlay system. Safety timeouts check `:hover` state to keep the popup alive. This is fragile and leaks state across component mounts.

Additionally, AI-driven suggestions (the core workflow in the app) require finding text and replacing it with tracked changes. The frontend manually walks the document tree to map text positions to paragraph/offset — a pattern that breaks when documents contain tables, footnotes, or multi-run text spans.

These four gaps were identified as blocking a reliable legal review workflow:

1. Review mode toolbar (accept/reject all, next/prev change)
2. Comment creation UI (toolbar button + keyboard shortcut)
3. Template field inline editing popup (native, no module-level hacks)
4. Find & replace with track changes (PM-level command for AI suggestions)

## Decision

Build all four features natively inside the `docx-editor` library rather than continuing to extend them in the consuming frontend application.

The marks (`InsertionExtension`, `DeletionExtension`, `CommentExtension`), accept/reject commands, suggestion mode plugin, and template plugin are already implemented. What is missing is UI surface area (toolbar buttons, keyboard shortcuts, popup components) and one new ProseMirror command (`replaceWithTracking`).

Building natively means:

- The frontend discards its module-level state hack and imports a proper component
- The text-finding logic uses PM document positions, not a manual tree walk
- Any future consumer of the library gets legal review features out of the box

## Alternatives Considered

### Keep frontend hacks, iterate gradually

- **Pros:** No library changes required; isolated to the consuming app
- **Cons:** The module-level state approach is architecturally unsound and will break under concurrent React rendering. The manual tree walk is already failing on documents with split runs (LLM output sometimes truncates mid-word). Technical debt compounds with each new legal workflow added.
- **Why not:** The hacks are load-bearing but brittle. They mask bugs rather than fix root causes.

### Build as a separate plugin package

- **Pros:** Keeps core library smaller; legal features are opt-in
- **Cons:** The review toolbar and comment button belong in the default editor UI, not a plugin. Template field editing is an enhancement to an existing plugin (`templatePlugin`), not a new plugin. The `replaceWithTracking` command belongs in core alongside `acceptChange`/`rejectChange`. Splitting them would create an awkward dependency between a "legal plugin" and internal PM commands.
- **Why not:** These features are general-purpose document review capabilities, not legal-specific. They belong in the library proper.

### Fork the library

- **Pros:** Total control
- **Cons:** Forks diverge. Upstream fixes and features require manual merges. This is the same library we maintain.
- **Why not:** We own the library. There is no reason to fork.

## Consequences

### Positive

- Frontend `templateFieldPlugin.tsx` (584 lines of module-level state) is deleted and replaced with an import
- AI suggestion application becomes a single `replaceWithTracking(search, replace)` call instead of a manual document tree walk
- Review toolbar works out of the box for any consumer of `DocxEditor` with `mode='suggesting'`
- Comment creation is accessible via toolbar, keyboard shortcut, and right-click — standard UX patterns for document editors

### Negative

- Library bundle size increases slightly (new popup component, new command file)
- `TemplateFieldPopup` is only useful when `templatePlugin` is active; consumers who don't use templates carry dead code. Mitigation: the component is tree-shakeable since it only lives inside the plugin.

### Risks

- **Popup positioning edge cases**: `RenderedDomContext.getRectsForRange()` returns rects in the layout-painter coordinate space. If a tag spans a page break, the rect may be split. Mitigation: always use the first rect for popup anchor.
- **`replaceWithTracking` cross-node boundaries**: Text can span multiple PM nodes (e.g., a bold word inside a sentence). `doc.textBetween()` flattens across nodes but PM positions are node-relative. Mitigation: use `doc.resolve()` to verify positions before dispatching.

## References

- [Tech Spec: Legal Review Features](../specs/01-legal-review-features.md)
- `packages/core/src/prosemirror/commands/comments.ts` — accept/reject/navigate commands
- `packages/core/src/prosemirror/plugins/suggestionMode.ts` — suggestion mode plugin
- `packages/react/src/plugins/template/index.ts` — template plugin
- `grayscope-ai-legal-frontend/src/components/features/drafts/docx-editor/templateFieldPlugin.tsx` — frontend hack being replaced
