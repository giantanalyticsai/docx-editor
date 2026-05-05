/**
 * Repro for two-column continuous section break rendering bug.
 *
 * Models the OOXML structure that triggered the original failure (an NDA
 * authored in Word):
 *
 *   sectPr_0 (front matter, 1 col)
 *   sectPr_1 (body, 2 col, type=continuous)
 *   sectPr_body (final, 1 col, type=continuous)
 *
 * The body sectPr lives at the end of <w:body> and surfaces in the engine
 * via `options.columns`. Per ECMA-376 §17.6.17 a sectPr defines properties
 * for the section that ENDS at it, so the pre-scan in layoutDocument uses
 * sectionColumnConfigs[idx + 1] when transitioning at break[idx] — i.e. the
 * NEXT section's columns.
 */

import { describe, test, expect } from 'bun:test';

import { layoutDocument } from './index';
import type {
  ParagraphBlock,
  ParagraphMeasure,
  MeasuredLine,
  FlowBlock,
  Measure,
  PageMargins,
  LayoutOptions,
  ParagraphFragment,
} from './types';

function makeParagraphBlock(id: number, text: string, pmStart: number): ParagraphBlock {
  return {
    kind: 'paragraph',
    id,
    runs: [{ kind: 'text', text, pmStart, pmEnd: pmStart + text.length }],
    attrs: {},
    pmStart,
    pmEnd: pmStart + text.length + 1,
  };
}

function makeLine(width: number, lineHeight: number): MeasuredLine {
  return {
    fromRun: 0,
    fromChar: 0,
    toRun: 0,
    toChar: 10,
    width,
    ascent: lineHeight * 0.8,
    descent: lineHeight * 0.2,
    lineHeight,
  };
}

function makeParagraphMeasure(lines: MeasuredLine[]): ParagraphMeasure {
  return {
    kind: 'paragraph',
    lines,
    totalHeight: lines.reduce((s, l) => s + l.lineHeight, 0),
  };
}

const PAGE_SIZE = { w: 816, h: 1056 };
const MARGINS: PageMargins = { top: 96, right: 96, bottom: 96, left: 96 };
const CONTENT_WIDTH = PAGE_SIZE.w - MARGINS.left - MARGINS.right; // 624

const opts: LayoutOptions = {
  pageSize: PAGE_SIZE,
  margins: MARGINS,
  pageGap: 20,
  columns: { count: 1, gap: 0 }, // final section is 1-col
};

describe('Two-column continuous section break (NDA scenario)', () => {
  test('body paragraphs flow column 0 then column 1 with column-width fragments', () => {
    const colCount = 2;
    const colGap = 20;
    const expectedColumnWidth = (CONTENT_WIDTH - (colCount - 1) * colGap) / colCount; // 302
    const expectedColumn1X = MARGINS.left + expectedColumnWidth + colGap; // 418

    // Block stream:
    //   [front-matter para] [sectionBreak_0 cols=1-col]
    //   [body paras 0..7]   [sectionBreak_1 cols=2-col]
    // options.columns = 1-col (final section, after the body's 2-col section)
    //
    // Pre-scan produces sectionColumnConfigs = [1-col, 2-col, 1-col].
    // At sectionBreak_0 (sectionIdx=0), engine reads configs[1]=2-col and
    // calls paginator.updateColumns({count:2}). Body paras then flow at 2-col.

    const blocks: FlowBlock[] = [
      makeParagraphBlock(0, 'Front matter', 1),
      {
        kind: 'sectionBreak',
        id: 1,
        type: 'continuous',
        columns: { count: 1, gap: 0 },
      },
    ];
    const measures: Measure[] = [
      makeParagraphMeasure([makeLine(100, 24)]),
      { kind: 'sectionBreak' },
    ];

    // 10 body paragraphs, 100px each. Available height per column ≈ 840 after
    // front matter, so 10 paragraphs (1000px) overflow column 0 into column 1.
    for (let i = 0; i < 10; i++) {
      blocks.push(makeParagraphBlock(10 + i, `B${i}`, 30 + i * 5));
      measures.push(makeParagraphMeasure([makeLine(80, 100)]));
    }

    blocks.push({
      kind: 'sectionBreak',
      id: 99,
      type: 'continuous',
      columns: { count: colCount, gap: colGap },
    });
    measures.push({ kind: 'sectionBreak' });

    const layout = layoutDocument(blocks, measures, opts);

    expect(layout.pages.length).toBe(1);

    const fragments = layout.pages[0].fragments as ParagraphFragment[];
    const frontFrag = fragments.find((f) => f.blockId === 0)!;
    const bodyFrags = fragments.filter(
      (f) => typeof f.blockId === 'number' && (f.blockId as number) >= 10
    );

    // Front-matter paragraph is in 1-col → x=margin.left, width=full content.
    expect(frontFrag.x).toBe(MARGINS.left);
    expect(frontFrag.width).toBe(CONTENT_WIDTH);

    // Body paragraphs should split between column 0 (x=96) and column 1 (x=418).
    const col0 = bodyFrags.filter((f) => f.x === MARGINS.left);
    const col1 = bodyFrags.filter((f) => f.x === expectedColumn1X);
    expect(col0.length + col1.length).toBe(bodyFrags.length);
    expect(col0.length).toBeGreaterThan(0);
    expect(col1.length).toBeGreaterThan(0);

    // Each body fragment should be column-width, NOT full content-width.
    for (const f of bodyFrags) {
      expect(f.width).toBe(expectedColumnWidth);
    }
  });
});
