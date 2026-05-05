# @giantanalyticsai/docx-editor-agents

## 1.2.1

### Patch Changes

- [#17](https://github.com/giantanalyticsai/docx-editor/pull/17) [`252fb04`](https://github.com/giantanalyticsai/docx-editor/commit/252fb04cde51d05eca62552c0e2a0a52853968d2) Thanks [@milap-giantanalytics](https://github.com/milap-giantanalytics)! - fix: paragraph fragments in multi-column sections now use column width

  Paragraphs inside a section with `<w:cols w:num="2"/>` (or any multi-column
  layout) had their fragments emitted with `width = contentWidth` (the full
  page-content width). The line breaking in `measureParagraph` was already
  column-aware — only the fragment box was wrong — so rendered text overflowed
  column 0 into column 1's space and overlapped paragraphs that flowed into
  column 1, producing visually garbled output.

  Switch `layoutParagraph` to use `paginator.columnWidth` for fragment width.
  The paginator already tracks the active column width per section, so this
  makes the fragment match the layout the paginator already computes for
  positioning (`getColumnX`).

  Added a regression test (`two-column-section.test.ts`) covering an
  NDA-style document: front-matter (1 col) → continuous break → body (2 col)
  → continuous break → tail (1 col).

## 1.2.0

### Patch Changes

- [#14](https://github.com/giantanalyticsai/docx-editor/pull/14) [`15ffd49`](https://github.com/giantanalyticsai/docx-editor/commit/15ffd4975313845d244ea5770b11ab796e3557d2) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - Add `DocxReviewer.removeComment(id)` — removes a comment (and its replies when called on a top-level thread) along with its anchored range markers. Closes [#252](https://github.com/giantanalyticsai/docx-editor/issues/252).

## 1.1.1

### Patch Changes

- [#12](https://github.com/giantanalyticsai/docx-editor/pull/12) [`df705d1`](https://github.com/giantanalyticsai/docx-editor/commit/df705d1862ad98cb92b2f0c585c270b24c6fdc55) Thanks [@yash-giantanalytics](https://github.com/yash-giantanalytics)! - fix(build): include agent-use package in monorepo build and rename remaining @eigenpal references

  The root build script was missing @giantanalyticsai/docx-editor-agents, causing
  it to publish without a dist/ directory. Also updated all example configs, docs,
  and specs to use @giantanalyticsai scope consistently.

## 1.1.0

## 1.0.0

## 0.1.1

## 0.1.0

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
