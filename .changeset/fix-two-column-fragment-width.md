---
'@giantanalyticsai/docx-js-editor': patch
'@giantanalyticsai/docx-editor-agents': patch
---

fix: paragraph fragments in multi-column sections now use column width

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
