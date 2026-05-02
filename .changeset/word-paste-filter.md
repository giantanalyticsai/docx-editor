---
'@giantanalyticsai/docx-js-editor': patch
'@giantanalyticsai/docx-core': patch
---

Improve Microsoft Word paste handling for two long-standing artifacts:

- **VML phantom tables**: Word emits a `<![if !vml]><span style="position:absolute"><table>...</table></span><![endif]>` fallback alongside every textbox, callout, signature block, or margin annotation. Browsers ignore the conditional guard but render the inner `<table>`, so pasting any Word content with shapes injected a phantom 1×1 table between paragraphs. The new `stripVmlFallback` pass removes the fallback wrapper and stray `<v:*>` / `<o:*>` tags before `DOMParser` sees them.
- **Lists pasted as prose**: Word numbered/bulleted lists arrive as flat `<p style="mso-list:l0 level1 lfo1">` paragraphs with the marker glyph baked in as literal text inside `<span style='mso-list:Ignore'>`. The new `reconstructWordLists` pass detects these paragraphs, strips the literal-marker spans, and stamps `data-num-id` / `data-num-ilvl` on the `<p>`, which the existing `<p>` parseDOM rule now reads into `numPr`. Pasted lists are recognised by the toolbar, renumber correctly, and round-trip to DOCX as real list items.

Both fixes run inside the existing `transformPastedHTML` plugin hook, so they apply to both Ctrl+V and toolbar paste paths. Covered by `e2e/tests/word-paste-debug.spec.ts` which exercises seven realistic clipboard payloads (Word lists, VML shapes, mso-spacerun whitespace, conditional comments, Outlook HTML, RTF-only, plain-text).
