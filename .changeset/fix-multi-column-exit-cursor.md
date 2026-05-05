---
'@giantanalyticsai/docx-js-editor': patch
'@giantanalyticsai/docx-editor-agents': patch
---

fix: advance cursor past tallest column when exiting a multi-column section

When a continuous section break transitioned out of a multi-column region
(e.g. 2-col → 1-col mid-page), the paginator's `updateColumns()` reset
`columnRegionTop` to `state.cursorY` — which is the bottom of the _last
column written to_, not the bottom of the _tallest_ column. With unbalanced
columns (col 0 fills the page, col 1 has only a short paragraph),
subsequent 1-col content was placed at col 1's shorter bottom and visually
overlapped col 0's tail content.

`updateColumns()` now advances `state.cursorY` to the maximum
`fragment.y + fragment.height` across the current page when exiting a
multi-column region, so trailing 1-col content (e.g. signature blocks
following a multi-column body) renders below all column content rather
than on top of it.

Adds a regression test in `two-column-section.test.ts` covering the
unbalanced-columns case followed by a 1-col paragraph.
