# @giantanalyticsai/docx-js-editor

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
