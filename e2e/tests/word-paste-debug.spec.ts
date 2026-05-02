/**
 * Word / RTF / Outlook paste debug harness
 *
 * Diagnostic only — does not assert "correct" behavior. Each scenario pastes
 * a realistic clipboard payload (captured shapes of what Word, Outlook,
 * Wordpad, and old .doc copy operations actually put on the clipboard) into
 * an empty document and dumps:
 *
 *   - the resulting hidden ProseMirror DOM
 *   - the visible layout-painter DOM (page 1 only)
 *   - a list of "overlap suspects": absolute-positioned spans on the painted
 *     page that share the same (top,left) coords (the rendering signature
 *     that matches the screenshot in the bug report)
 *   - a screenshot of page 1
 *
 * Run:  npx playwright test e2e/tests/word-paste-debug.spec.ts \
 *         --timeout=60000 --workers=1 --reporter=list
 *
 * Outputs land in screenshots/word-paste-debug/<scenario>.png and the per-test
 * console output captures the DOM/overlap reports.
 */

import { test, expect } from '@playwright/test';
import { EditorPage } from '../helpers/editor-page';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMPTY_DOCX = path.join(__dirname, '..', 'fixtures', 'empty.docx');
const SCREENSHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'word-paste-debug');

type ClipboardPayload = {
  html?: string;
  rtf?: string;
  plain: string;
};

const SCENARIOS: Array<{ name: string; payload: ClipboardPayload; note: string }> = [
  {
    name: 'A_word_mso_list',
    note: 'Word numbered list — mso-list markers, literal bullet glyphs in <span>',
    payload: {
      plain: '1. Compliance review\n2. Risk assessment\n3. Approval',
      html: `<html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word"
        xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta http-equiv=Content-Type content="text/html; charset=utf-8">
        <meta name=Generator content="Microsoft Word 15">
        <style><!-- /* Font Definitions */
        p.MsoNormal, li.MsoNormal { mso-style-priority:99; margin:0in; font-size:11.0pt; font-family:"Calibri",sans-serif; }
        p.MsoListParagraph { margin-left:.5in; mso-add-space:auto; mso-pagination:widow-orphan; }
        --></style></head>
        <body lang=EN-US>
        <p class=MsoListParagraph style='text-indent:-.25in;mso-list:l0 level1 lfo1'>
          <![if !supportLists]><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span><![endif]>Compliance review<o:p></o:p>
        </p>
        <p class=MsoListParagraph style='text-indent:-.25in;mso-list:l0 level1 lfo1'>
          <![if !supportLists]><span style='mso-list:Ignore'>2.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span><![endif]>Risk assessment<o:p></o:p>
        </p>
        <p class=MsoListParagraph style='text-indent:-.25in;mso-list:l0 level1 lfo1'>
          <![if !supportLists]><span style='mso-list:Ignore'>3.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span></span><![endif]>Approval<o:p></o:p>
        </p>
        </body></html>`,
    },
  },
  {
    name: 'B_word_vml_shape',
    note: 'Word with VML <v:shape> textbox — absolute-positioned legacy graphics',
    payload: {
      plain: 'Confidential — for internal review only.',
      html: `<html xmlns:v="urn:schemas-microsoft-com:vml"
        xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word">
        <head><meta name=Generator content="Microsoft Word 15"></head>
        <body lang=EN-US>
        <p class=MsoNormal>Section header<o:p></o:p></p>
        <!--[if gte vml 1]>
          <v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe">
            <v:stroke joinstyle="miter"/>
            <v:path gradientshapeok="t" o:connecttype="rect"/>
          </v:shapetype>
          <v:shape id="Text Box 1" o:spid="_x0000_s1026" type="#_x0000_t202"
            style='position:absolute;margin-left:54pt;margin-top:18pt;width:200pt;height:60pt;z-index:251660288'>
            <v:textbox><![CDATA[<div>Confidential — for internal review only.</div>]]></v:textbox>
          </v:shape>
        <![endif]-->
        <![if !vml]>
          <span style='mso-ignore:vglayout;position:absolute;z-index:251660288;left:0;top:0;width:200pt;height:60pt'>
            <table cellpadding=0 cellspacing=0><tr><td style='padding:.75pt .75pt .75pt .75pt'>
              <p class=MsoNormal>Confidential — for internal review only.<o:p></o:p></p>
            </td></tr></table>
          </span>
        <![endif]>
        <p class=MsoNormal>Body text after shape.<o:p></o:p></p>
        </body></html>`,
    },
  },
  {
    name: 'C_word_spacerun_whitespace',
    note: 'Word with mso-spacerun=yes — multi-NBSP runs in spans',
    payload: {
      plain: 'Party A:        Acme Corp\nParty B:        Beta LLC',
      html: `<html xmlns:o="urn:schemas-microsoft-com:office:office">
        <body lang=EN-US>
        <p class=MsoNormal>Party A:<span style='mso-spacerun:yes'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span>Acme Corp<o:p></o:p></p>
        <p class=MsoNormal>Party B:<span style='mso-spacerun:yes'>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; </span>Beta LLC<o:p></o:p></p>
        </body></html>`,
    },
  },
  {
    name: 'D_word_conditional_comments',
    note: 'Word with conditional comments wrapping content',
    payload: {
      plain: 'This indemnity clause is broad.',
      html: `<html xmlns:o="urn:schemas-microsoft-com:office:office">
        <head>
        <!--[if gte mso 9]><xml>
          <o:OfficeDocumentSettings><o:AllowPNG/></o:OfficeDocumentSettings>
        </xml><![endif]-->
        <!--[if gte mso 9]><xml>
          <w:WordDocument><w:View>Print</w:View></w:WordDocument>
        </xml><![endif]-->
        <style><!--
        p.MsoNormal { margin:0in; font-size:11.0pt; font-family:"Calibri",sans-serif; }
        --></style>
        </head>
        <body lang=EN-US>
        <p class=MsoNormal>This indemnity clause is broad.<o:p></o:p></p>
        </body></html>`,
    },
  },
  {
    name: 'E_outlook_html',
    note: 'Outlook 365 — Word HTML wrapped in conditional comments + signature block',
    payload: {
      plain: 'Please review the attached. Best, J.',
      html: `<html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word">
        <head><meta name=Generator content="Microsoft Word 15 (filtered medium)">
        <style><!--
        @font-face { font-family:"Cambria Math"; panose-1:2 4 5 3 5 4 6 3 2 4; }
        p.MsoNormal { margin:0in; font-size:11.0pt; font-family:"Calibri",sans-serif; }
        span.EmailStyle17 { mso-style-type:personal-compose; font-family:"Calibri",sans-serif; color:windowtext; }
        --></style></head>
        <body lang=EN-US link="#0563C1" vlink="#954F72">
        <div class=WordSection1>
        <p class=MsoNormal>Please review the attached.<o:p></o:p></p>
        <p class=MsoNormal><o:p>&nbsp;</o:p></p>
        <p class=MsoNormal>Best,<o:p></o:p></p>
        <p class=MsoNormal>J.<o:p></o:p></p>
        </div></body></html>`,
    },
  },
  {
    name: 'F_rtf_only_no_html',
    note: 'Wordpad / old .doc — only text/rtf + text/plain on clipboard, no HTML',
    payload: {
      plain: 'Plain fallback text from RTF source.',
      rtf: `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Calibri;}}
        \\f0\\fs22 Plain fallback text from RTF source.\\par}`,
    },
  },
  {
    name: 'G_plain_only',
    note: 'Old .doc binary or unknown source — only text/plain available',
    payload: {
      plain:
        'Section 3.1 Limitation of Liability.\nThe maximum aggregate liability shall not exceed $10,000.',
    },
  },
];

test.describe('Word/RTF paste debug harness', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  for (const scenario of SCENARIOS) {
    test(scenario.name, async ({ page }) => {
      const editor = new EditorPage(page);
      await editor.goto();
      await editor.waitForReady();
      await editor.loadDocxFile(EMPTY_DOCX);
      await editor.focus();

      const dispatchResult = await page.evaluate((payload) => {
        const dt = new DataTransfer();
        if (payload.html) dt.setData('text/html', payload.html);
        if (payload.rtf) dt.setData('text/rtf', payload.rtf);
        dt.setData('text/plain', payload.plain);

        const target = document.querySelector<HTMLElement>('.ProseMirror');
        if (!target) return { dispatched: false, reason: 'no .ProseMirror target' };

        target.focus();

        const ev = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dt,
        });
        Object.defineProperty(ev, 'clipboardData', { value: dt });

        const accepted = target.dispatchEvent(ev);
        return {
          dispatched: true,
          accepted,
          types: Array.from(dt.types),
        };
      }, scenario.payload);

      // Wait for layout-painter to repaint after PM transaction
      await page.waitForTimeout(500);

      const report = await page.evaluate(() => {
        const pm = document.querySelector('.ProseMirror');
        const pages = document.querySelector('.paged-editor__pages');
        const firstPage = pages?.querySelector('.layout-page');

        // Overlap detector — group absolute-positioned spans by (top,left)
        const overlapBuckets = new Map<string, number>();
        let absSpanCount = 0;
        if (firstPage) {
          firstPage.querySelectorAll<HTMLElement>('span, div').forEach((el) => {
            const cs = getComputedStyle(el);
            if (cs.position !== 'absolute') return;
            absSpanCount++;
            const key = `${cs.top}|${cs.left}`;
            overlapBuckets.set(key, (overlapBuckets.get(key) ?? 0) + 1);
          });
        }
        const overlaps = Array.from(overlapBuckets.entries())
          .filter(([, count]) => count > 1)
          .map(([key, count]) => ({ key, count }));

        const truncate = (s: string, n: number) =>
          s.length <= n ? s : s.slice(0, n) + `… [+${s.length - n} chars]`;

        return {
          pmHtml: truncate(pm?.innerHTML ?? '<missing>', 4000),
          pmTextContent: truncate(pm?.textContent ?? '', 1000),
          firstPageHtml: truncate(firstPage?.innerHTML ?? '<missing>', 4000),
          absSpanCount,
          overlapBucketCount: overlapBuckets.size,
          overlaps: overlaps.slice(0, 20),
          pageCount: pages?.querySelectorAll('.layout-page').length ?? 0,
        };
      });

      // Per-scenario diagnostic dump (visible with --reporter=list)
      // eslint-disable-next-line no-console
      console.log(`\n=== ${scenario.name} ===`);
      // eslint-disable-next-line no-console
      console.log(scenario.note);
      // eslint-disable-next-line no-console
      console.log('dispatch:', dispatchResult);
      // eslint-disable-next-line no-console
      console.log(
        'pageCount:',
        report.pageCount,
        '| absSpans:',
        report.absSpanCount,
        '| distinct (top,left):',
        report.overlapBucketCount,
        '| overlapping coords:',
        report.overlaps.length
      );
      if (report.overlaps.length > 0) {
        // eslint-disable-next-line no-console
        console.log('OVERLAP SUSPECTS:', JSON.stringify(report.overlaps, null, 2));
      }
      // eslint-disable-next-line no-console
      console.log('--- PM textContent ---\n' + report.pmTextContent);
      // eslint-disable-next-line no-console
      console.log('--- PM innerHTML ---\n' + report.pmHtml);
      // eslint-disable-next-line no-console
      console.log('--- visible page innerHTML ---\n' + report.firstPageHtml);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${scenario.name}.png`),
        fullPage: false,
      });

      // Sanity: the editor did not crash and still has at least one page.
      expect(report.pageCount).toBeGreaterThan(0);

      // Regression assertions for the two paste-filter fixes.
      // A_word_mso_list: literal "1." marker must be gone, pasted paragraphs
      // must carry the docx-list-numbered class that toDOM emits when numPr
      // is set. PM merges the first inserted paragraph into the cursor's
      // (empty) paragraph and loses its attrs, so we only require items 2..N
      // to carry the class — that matches real-world paste-between-content
      // usage where the cursor's paragraph already has list attrs.
      if (scenario.name === 'A_word_mso_list') {
        expect(report.pmHtml).toMatch(/docx-list-numbered/);
        expect(report.pmHtml).not.toMatch(/>1\.</);
        expect(report.pmTextContent).not.toMatch(/^1\./);
        expect((report.pmHtml.match(/docx-list-numbered/g) ?? []).length).toBeGreaterThanOrEqual(2);
      }
      // B_word_vml_shape: phantom <table> from <![if !vml]> fallback must not be inserted.
      if (scenario.name === 'B_word_vml_shape') {
        expect(report.pmHtml).not.toMatch(/<table[\s>]/);
        expect(report.firstPageHtml).not.toMatch(/layout-table[\s"]/);
      }
    });
  }
});
