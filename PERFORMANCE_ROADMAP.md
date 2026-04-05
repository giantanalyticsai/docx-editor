# Performance Roadmap: docx-editor Layout Engine

## Problem Statement

The docx-editor becomes slow (200-500ms per keystroke) on documents with 20+ pages. Users experience visible input lag that makes editing unusable on real-world tender documents (typically 20-80 pages).

### Root Cause Analysis

Profiling with `PerformanceObserver` on a 23-page tender document revealed:

- **58 long tasks** for typing 25 characters
- **Average: 205ms per keystroke**, peak: 1,086ms
- Total DOM nodes: only 4,228 (not a DOM size issue)
- ProseMirror nodes: only 1,789

The bottleneck is the **synchronous full-document re-layout** that runs on every keystroke.

### Architecture (Current)

```
Keystroke
  ↓
ProseMirror transaction (fast, <5ms)
  ↓
toFlowBlocks.ts — converts PM doc → FlowBlock[] (full document traversal)
  ↓
measureParagraph.ts — measures each paragraph (canvas-based, fast per paragraph)
  ↓
layout-engine/index.ts — runs paginator on ALL blocks (full document)
  ↓
layout-painter/ — re-renders ALL layout pages to DOM
  ↓
User sees update (200-500ms total)
```

The layout engine already uses **Canvas API** for text measurement (not DOM reflow), which is good. The problem is:

1. **Full document re-layout on every keystroke** — all blocks are re-measured and re-paginated, even if only one paragraph changed
2. **All pages re-rendered** — the layout painter rebuilds all page DOMs, not just the affected ones
3. **Synchronous execution** — the entire pipeline runs in one synchronous JavaScript task, blocking the main thread

---

## Optimization Strategy (3 Tiers)

### Tier 1: Dirty-Page Tracking (Highest Impact, Medium Effort)

**Goal:** Only re-measure and re-paginate from the edited paragraph forward.

**Key insight:** Editing paragraph N can only affect pages from page(N) onwards. Pages before the edit are guaranteed unchanged.

#### Changes needed:

**`layout-bridge/toFlowBlocks.ts`:**

- Track which ProseMirror node positions changed (from the transaction's `steps`)
- Map changed positions to FlowBlock indices
- Return a `dirtyFrom: number` indicating the first dirty block index

**`layout-bridge/measuring/measureParagraph.ts`:**

- Add a measurement cache keyed on paragraph content hash + formatting
- On re-layout, skip measurement for unchanged paragraphs (return cached result)
- Invalidate cache entries when the paragraph's PM node changes

**`layout-engine/index.ts`:**

- Accept `startFromBlock: number` parameter
- Reuse existing page/fragment state for pages before the dirty block
- Only run the paginator from the dirty block forward
- If the edit doesn't change the page break position, stop early (no cascading re-layout)

**`layout-painter/`:**

- Track which pages changed (by comparing fragment lists)
- Only update DOM for changed pages
- Use `requestAnimationFrame` for batching multiple rapid edits

**Expected impact:** 5-10x speedup for single-character edits. A keystroke in page 5 of a 23-page document would only re-layout pages 5-23, and if the page break doesn't move, only page 5.

---

### Tier 2: Pretext Integration (High Impact, High Effort)

**Goal:** Replace Canvas text measurement with [Pretext](https://github.com/chenglou/pretext) for 500x faster text measurement.

**Key insight:** While the current Canvas-based measurement is fast per call, it's called for every paragraph on every re-layout. Pretext's caching and batch measurement would make this near-instant.

#### Where Pretext fits:

```
Current:
  measureParagraph.ts → measureContainer.ts → Canvas.measureText()
                                                ↑ per run, per paragraph

With Pretext:
  measureParagraph.ts → pretext.prepare() → pretext.layout()
                         ↑ cached segments    ↑ instant from cache
```

#### Changes needed:

**`layout-bridge/measuring/measureContainer.ts`:**

- Replace `measureTextWidth()` with Pretext's `prepare()` + width calculation
- Replace `getFontMetrics()` with Pretext's font metric cache
- Pretext handles: font loading, text segmentation, width measurement, line breaking

**`layout-bridge/measuring/measureParagraph.ts`:**

- Replace manual line-breaking algorithm with Pretext's `layout()` output
- Pretext natively handles: word boundaries, soft hyphens, CJK characters, emoji
- Remove `WIDTH_TOLERANCE` heuristic — Pretext has sub-pixel accuracy

**New file: `layout-bridge/measuring/pretextAdapter.ts`:**

```typescript
import { prepare, layout } from 'pretext';

// Initialize Pretext with the document's fonts
export function initPretext(fonts: string[]) {
  // Pretext pre-loads and caches font metrics
}

// Measure a paragraph using Pretext
export function measureParagraphPretext(
  runs: Run[],
  containerWidth: number,
  tabStops: TabStop[]
): ParagraphMeasure {
  // Convert runs to Pretext segments
  // Call prepare() for font metrics (cached)
  // Call layout() for line breaking
  // Return ParagraphMeasure compatible result
}
```

**Expected impact:** Individual paragraph measurement goes from ~0.5ms to ~0.01ms. Combined with Tier 1 (dirty tracking), total per-keystroke cost drops to <10ms.

#### Challenges:

- Table cell measurement still needs width distribution logic (Pretext handles text within cells, but column width allocation is separate)
- Image dimensions come from DOCX metadata, not Pretext
- Need to handle Pretext's async font loading during initial document load

---

### Tier 3: Virtual Page Rendering (Medium Impact, Medium Effort)

**Goal:** Only mount page DOMs for pages visible in the viewport.

**Key insight:** On a 23-page document, only 2-3 pages are visible at any time. Rendering all 23 layout page DOMs is wasteful.

#### Changes needed:

**`layout-painter/index.ts`:**

- Track viewport scroll position
- Only call `renderPage()` for pages within ±1 page of the viewport
- Use placeholder divs with correct heights for off-screen pages
- Mount/unmount page DOMs on scroll (with `requestIdleCallback` for pre-rendering)

**CSS (already partially implemented):**

```css
.layout-page {
  content-visibility: auto;
  contain-intrinsic-size: auto 794px 1122px;
  contain: layout style paint;
}
```

**Expected impact:** DOM node count drops by ~80% (from 23 page DOMs to ~3). Paint and composite costs near-zero for off-screen content.

---

## Implementation Priority

| Tier                          | Effort    | Impact                  | Dependencies                    |
| ----------------------------- | --------- | ----------------------- | ------------------------------- |
| **Tier 1: Dirty tracking**    | 2-3 days  | **5-10x** speedup       | None                            |
| **Tier 2: Pretext**           | 1-2 weeks | **50x** per-measurement | None (can parallel with Tier 1) |
| **Tier 3: Virtual rendering** | 2-3 days  | **80%** DOM reduction   | Tier 1 (needs stable page list) |

**Recommended order:** Tier 1 → Tier 3 → Tier 2

Tier 1 (dirty tracking) gives the biggest immediate improvement with least risk. Tier 3 is low-effort once Tier 1 is done. Tier 2 is the most invasive but makes measurement cost negligible.

---

## File Map

Core files that need modification:

```
packages/core/src/
├── layout-engine/
│   ├── index.ts              ← Tier 1: Add startFromBlock, early exit
│   ├── paginator.ts          ← Tier 1: Support resume from saved state
│   └── types.ts              ← Add dirty tracking types
├── layout-bridge/
│   ├── toFlowBlocks.ts       ← Tier 1: Track dirty block index from PM transaction
│   ├── measuring/
│   │   ├── measureContainer.ts ← Tier 2: Replace with Pretext adapter
│   │   ├── measureParagraph.ts ← Tier 1: Add measurement cache; Tier 2: Use Pretext
│   │   └── cache.ts           ← Tier 1: Measurement result cache
│   └── measuring/pretextAdapter.ts ← Tier 2: New file, Pretext integration
├── layout-painter/
│   ├── index.ts              ← Tier 1: Diff-based page updates; Tier 3: Virtual rendering
│   └── renderPage.ts         ← Tier 3: Lazy mount/unmount
```

---

## Benchmarks to Establish

Before implementing, create baseline benchmarks:

```typescript
// packages/core/src/layout-engine/performance.test.ts (already exists)

// Add these cases:
1. Single character insert at page 1 of 5-page doc
2. Single character insert at page 1 of 25-page doc
3. Single character insert at page 1 of 50-page doc
4. Single character insert at page 25 of 50-page doc (mid-document)
5. Paragraph delete at page 10 of 25-page doc
6. Table cell edit in a 5-page doc with 20 tables

// Measure:
- toFlowBlocks() time
- measureParagraph() time (per paragraph and total)
- layout engine paginator time
- layout painter render time
- Total keystroke-to-screen time
```

---

## Context: Why This Matters

This fork is used by [Tendor](https://tendor.ai), a tender/grant management SaaS. Users edit returnable schedule documents (typically 20-80 pages) with tables, tracked changes, and government formatting requirements. The current 200-500ms per-keystroke latency makes the editor unusable for their workflows.

The Tendor integration (`tendor-web` monorepo) uses this editor as:

1. The primary document editing interface (replacing a node-based system)
2. With AI-powered editing via Mastra agents (tool-based document mutations)
3. With real-time collaboration via Yjs + Hocuspocus (planned)

Performance is the #1 blocker for production deployment.
