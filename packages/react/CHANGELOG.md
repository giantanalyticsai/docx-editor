# @giantanalyticsai/docx-js-editor

## 1.2.0

### Minor Changes

- [#14](https://github.com/giantanalyticsai/docx-editor/pull/14) [`442f3fc`](https://github.com/giantanalyticsai/docx-editor/commit/442f3fcf0a8f5aa9a249c5e038c9bf289c2b7a09) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Add `fontFamilies` prop to `DocxEditor` to customize the toolbar's font dropdown.

  Pass either bare strings or full `FontOption` objects (or a mix). Strings render in the "Other" group; `FontOption[]` enables CSS fallback chains and category grouping. Omitting the prop preserves the existing 12-font default. Closes [#278](https://github.com/giantanalyticsai/docx-editor/issues/278).

  ```tsx
  <DocxEditor
    fontFamilies={[
      'Arial',
      { name: 'Roboto', fontFamily: 'Roboto, sans-serif', category: 'sans-serif' },
    ]}
  />
  ```

- [#14](https://github.com/giantanalyticsai/docx-editor/pull/14) [`d9e22cb`](https://github.com/giantanalyticsai/docx-editor/commit/d9e22cbd66a2444365048842b1f656e2846cb63c) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - # Word-style split button for text + highlight color (issue [#130](https://github.com/giantanalyticsai/docx-editor/issues/130))

  Closes [#130](https://github.com/eigenpal/docx-editor/issues/130).

  The font-color and highlight-color toolbar buttons are now Word-style split buttons. Two halves:
  - **Apply half (icon + swatch):** click to re-apply the last color you picked. No dropdown.
  - **Arrow half (▾):** click to open the full color picker (theme grid, standard colors, custom hex, "no color").

  Pick a color once, then for every subsequent occurrence just click the swatch — one click instead of three.

  ## API surface (consolidated)

  The package previously shipped two color pickers — a simple `ColorPicker` and a fuller `AdvancedColorPicker`. The two have been merged into a single `ColorPicker` with two new props:
  - `splitButton?: boolean` — default `true`. Set `false` to render a legacy single-button shape.
  - `defaultColor?: ColorValue | string` — initial "last picked" color used by the apply half before the user picks anything. Defaults: text → red, highlight → yellow, border → black.

  The "last picked" memory is independent of the current selection's color (matches Word). Picking "Automatic" / "No color" does NOT update it.

  ## Breaking changes
  - The legacy `ColorPicker` (the simpler grid picker that ran inline, not via dropdown) has been **removed**. Its types `ColorOption` and the old `ColorPickerProps` shape are no longer exported.
  - `AdvancedColorPicker` has been **renamed to `ColorPicker`**. Update imports:

    ```diff
    - import { AdvancedColorPicker } from '@eigenpal/docx-js-editor';
    + import { ColorPicker } from '@eigenpal/docx-js-editor';
    ```

    The exported `ColorPickerProps` and `ColorPickerMode` types now correspond to the renamed component (formerly `AdvancedColorPickerProps` / `AdvancedColorPickerMode`).

  - CSS class names changed from `docx-advanced-color-picker-*` → `docx-color-picker-*`. If you targeted these in user CSS overrides, update the selectors.

  ## Migration

  No changes needed inside the library — text-color, highlight-color, table-cell-fill, and table-border-color buttons all use the new `ColorPicker` automatically. If you import `AdvancedColorPicker` directly, switch to `ColorPicker`. If you used the legacy simpler `ColorPicker`, the new `ColorPicker` is a drop-in for any case that benefits from the fuller picker; otherwise build a small custom picker — the legacy one was thin enough to inline.

### Patch Changes

- [#14](https://github.com/giantanalyticsai/docx-editor/pull/14) [`b70576d`](https://github.com/giantanalyticsai/docx-editor/commit/b70576d98b8ed8aed4e7d67fecc431bd3c4053b4) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Fix caret rendering at the wrong height after changing font size/family in an empty paragraph. The paragraph measurement cache key didn't include `defaultFontSize`/`defaultFontFamily`, so empty paragraphs with different default fonts collided on the same key and the cache returned a stale measurement until the user typed a character.

- [#14](https://github.com/giantanalyticsai/docx-editor/pull/14) [`b70576d`](https://github.com/giantanalyticsai/docx-editor/commit/b70576d98b8ed8aed4e7d67fecc431bd3c4053b4) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Fix font/size/color/highlight changes silently dropping when applied in an empty paragraph (e.g. right after pressing Enter). The mark commands set stored marks before updating the paragraph node, but every transform step clears stored marks — so the chosen value was wiped before dispatch and typed text fell back to the editor default. Reordered so node updates run first.

- [#14](https://github.com/giantanalyticsai/docx-editor/pull/14) [`10747b8`](https://github.com/giantanalyticsai/docx-editor/commit/10747b88b4ff705195295f6122cf184bd9523720) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Fix a regression where clicking the checkmark of a resolved comment did not re-open the comment card (issue [#268](https://github.com/giantanalyticsai/docx-editor/issues/268)). `PagedEditor.updateSelectionOverlay` fired `onSelectionChange` from every overlay redraw — including ResizeObserver and layout/font callbacks — not only on actual selection changes. When the sidebar card resize (or any window resize) triggered a redraw, the parent received a spurious callback with the unchanged cursor and cleared the just-set expansion. Dedup by PM state identity (immutable references) so consumers are only notified for real selection / doc / stored-marks changes.

  Also: cursor-based sidebar expansion now skips resolved comments. Moving the cursor through previously-commented text no longer re-opens old resolved threads — they stay collapsed to the checkmark marker until the user explicitly clicks it.

- [#14](https://github.com/giantanalyticsai/docx-editor/pull/14) [`16e6143`](https://github.com/giantanalyticsai/docx-editor/commit/16e6143656b4ef2fe538000a99a41b23a261448c) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Thread `fontFamilies` prop through Ribbon toolbar mode. Previously the prop was accepted by `<DocxEditor>` and `<Toolbar>` but silently dropped before reaching the font dropdown — Ribbon mode always showed the default font list. Custom font lists now apply consistently to both legacy and ribbon toolbars.

- [#14](https://github.com/giantanalyticsai/docx-editor/pull/14) [`946c1e6`](https://github.com/giantanalyticsai/docx-editor/commit/946c1e601ba7e3573d4cdb2f684b6f8318aef997) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Sync upstream `eigenpal/docx-editor` (Apr 2026):
  - Help → Report issue menu (upstream [#262](https://github.com/giantanalyticsai/docx-editor/issues/262))
  - Persist header/footer images on save (upstream [#264](https://github.com/giantanalyticsai/docx-editor/issues/264), fixes [#251](https://github.com/giantanalyticsai/docx-editor/issues/251))
  - Correct OOXML theme color tint/shade resolution (upstream [#270](https://github.com/giantanalyticsai/docx-editor/issues/270))
  - Persist header/footer on blank-doc save (upstream [#275](https://github.com/giantanalyticsai/docx-editor/issues/275), fixes [#274](https://github.com/giantanalyticsai/docx-editor/issues/274))

- [#14](https://github.com/giantanalyticsai/docx-editor/pull/14) [`cd026b4`](https://github.com/giantanalyticsai/docx-editor/commit/cd026b45ddd557de47fca6e58e13d15eeca82627) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Improve Microsoft Word paste handling for two long-standing artifacts:
  - **VML phantom tables**: Word emits a `<![if !vml]><span style="position:absolute"><table>...</table></span><![endif]>` fallback alongside every textbox, callout, signature block, or margin annotation. Browsers ignore the conditional guard but render the inner `<table>`, so pasting any Word content with shapes injected a phantom 1×1 table between paragraphs. The new `stripVmlFallback` pass removes the fallback wrapper and stray `<v:*>` / `<o:*>` tags before `DOMParser` sees them.
  - **Lists pasted as prose**: Word numbered/bulleted lists arrive as flat `<p style="mso-list:l0 level1 lfo1">` paragraphs with the marker glyph baked in as literal text inside `<span style='mso-list:Ignore'>`. The new `reconstructWordLists` pass detects these paragraphs, strips the literal-marker spans, and stamps `data-num-id` / `data-num-ilvl` on the `<p>`, which the existing `<p>` parseDOM rule now reads into `numPr`. Pasted lists are recognised by the toolbar, renumber correctly, and round-trip to DOCX as real list items.

  Both fixes run inside the existing `transformPastedHTML` plugin hook, so they apply to both Ctrl+V and toolbar paste paths. Covered by `e2e/tests/word-paste-debug.spec.ts` which exercises seven realistic clipboard payloads (Word lists, VML shapes, mso-spacerun whitespace, conditional comments, Outlook HTML, RTF-only, plain-text).

## 1.1.1

### Patch Changes

- [#12](https://github.com/giantanalyticsai/docx-editor/pull/12) [`df705d1`](https://github.com/giantanalyticsai/docx-editor/commit/df705d1862ad98cb92b2f0c585c270b24c6fdc55) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - fix(build): include agent-use package in monorepo build and rename remaining @eigenpal references

  The root build script was missing @giantanalyticsai/docx-editor-agents, causing
  it to publish without a dist/ directory. Also updated all example configs, docs,
  and specs to use @giantanalyticsai scope consistently.

## 1.1.0

### Minor Changes

- [#10](https://github.com/giantanalyticsai/docx-editor/pull/10) [`660833a`](https://github.com/giantanalyticsai/docx-editor/commit/660833aca67f365025876f8ceb77ba127455f4bd) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Sync upstream eigenpal/docx-js-editor: i18n support with locale prop and translations (Polish, German), incremental layout pipeline for 30x faster keystrokes, table context menu fixes with dialog-backed cell splitting, collaborative prop for Yjs integration, live agent chat tools with EditorBridge, tracked changes fixes, cursor-based sidebar expansion, unicode word selection, and header/footer line spacing alignment.

## 1.0.0

### Major Changes

- [#5](https://github.com/giantanalyticsai/docx-editor/pull/5) [`9ea03eb`](https://github.com/giantanalyticsai/docx-editor/commit/9ea03ebf4dd3c8cc95baac6264b06ee574eba779) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - BREAKING: Rename package scope from @eigenpal to @giantanalyticsai for GitHub Packages publishing. Consumers must update all imports.

## 0.1.1

### Patch Changes

- [`3f58005`](https://github.com/eigenpal/docx-editor/commit/3f5800555c152df9b4c047d46e8f14536aad8c3a) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Fix CI: publish to GitHub Packages instead of npm, bump Node to 22

## 0.1.0

### Minor Changes

- [`ca528e9`](https://github.com/eigenpal/docx-editor/commit/ca528e96b7a2ae2f74021775800839dc99c7d313) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Add review toolbar, comment UI, template onTagSelect callback, find-replace with track changes, @mention in comments, default heading styles, and real-time collaborative editing package (Yjs + Hocuspocus)

## 0.0.33

### Patch Changes

- Add i18n

## 0.0.32

### Patch Changes

- Fixes with comments and tracked changes

## 0.0.31

### Patch Changes

- [`d77716f`](https://github.com/eigenpal/docx-editor/commit/d77716f3abc8580ca48d9e2280f6564ce17df443) Thanks [@jedrazb](https://github.com/jedrazb)! - Bump

## 0.0.30

### Patch Changes

- Bump

## 0.0.29

### Patch Changes

- Bump to patch

## 0.0.28

### Patch Changes

- Bump packages
