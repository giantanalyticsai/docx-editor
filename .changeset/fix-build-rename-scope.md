---
'@giantanalyticsai/docx-js-editor': patch
'@giantanalyticsai/docx-editor-agents': patch
---

fix(build): include agent-use package in monorepo build and rename remaining @eigenpal references

The root build script was missing @giantanalyticsai/docx-editor-agents, causing
it to publish without a dist/ directory. Also updated all example configs, docs,
and specs to use @giantanalyticsai scope consistently.
