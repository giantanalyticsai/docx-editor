---
'@giantanalyticsai/docx-js-editor': patch
---

Thread `fontFamilies` prop through Ribbon toolbar mode. Previously the prop was accepted by `<DocxEditor>` and `<Toolbar>` but silently dropped before reaching the font dropdown — Ribbon mode always showed the default font list. Custom font lists now apply consistently to both legacy and ribbon toolbars.
