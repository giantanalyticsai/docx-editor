/**
 * Paste Style Inliner Extension
 *
 * When pasting from apps like Google Docs that use class-based CSS
 * (e.g. `<style>.c5 { margin-top: 12pt }</style>`) instead of inline styles,
 * ProseMirror's parseDOM can't read the styles because elements aren't attached
 * to the live document during parsing.
 *
 * This extension provides a `transformPastedHTML` hook that:
 * 1. Parses the pasted HTML string
 * 2. Extracts all `<style>` rules
 * 3. Inlines them onto matching elements
 * 4. Returns the modified HTML so parseDOM can read inline styles
 */

import { Plugin } from 'prosemirror-state';
import { createExtension } from '../create';
import type { ExtensionRuntime } from '../types';
import { Priority } from '../types';

/**
 * Parse a CSS rule's style declarations into a Record<property, value>.
 */
function parseStyleDeclarations(cssText: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Split on semicolons, handling edge cases
  const declarations = cssText.split(';');
  for (const decl of declarations) {
    const trimmed = decl.trim();
    if (!trimmed) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx < 0) continue;
    const prop = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (prop && value) {
      result[prop] = value;
    }
  }
  return result;
}

/**
 * Merge style declarations onto an element's existing inline style.
 * Existing inline styles take precedence (they were explicitly set by the app).
 */
function mergeStylesOntoElement(element: HTMLElement, declarations: Record<string, string>): void {
  const existingStyle = element.getAttribute('style') || '';
  const existingDeclarations = parseStyleDeclarations(existingStyle);

  // Only add properties that aren't already inline
  for (const [prop, value] of Object.entries(declarations)) {
    if (!(prop in existingDeclarations)) {
      element.style.setProperty(prop, value);
    }
  }
}

/**
 * Extract CSS rules from `<style>` elements and inline them onto matching elements.
 *
 * Uses the browser's CSSStyleSheet API to properly parse CSS rules,
 * handling complex selectors, specificity, etc.
 */
function inlineStylesFromStyleBlocks(doc: Document): void {
  const styleElements = doc.querySelectorAll('style');
  if (styleElements.length === 0) return;

  // Collect all CSS rules from all <style> blocks
  const rulesWithSelectors: Array<{
    selector: string;
    declarations: Record<string, string>;
  }> = [];

  for (const styleEl of styleElements) {
    const cssText = styleEl.textContent || '';
    if (!cssText.trim()) continue;

    // Use a temporary style sheet to parse CSS properly
    // This handles complex selectors, media queries, etc.
    try {
      const tempStyle = doc.createElement('style');
      tempStyle.textContent = cssText;
      doc.head.appendChild(tempStyle);

      const sheet = tempStyle.sheet;
      if (sheet) {
        for (let i = 0; i < sheet.cssRules.length; i++) {
          const rule = sheet.cssRules[i];
          if (rule instanceof CSSStyleRule) {
            const declarations: Record<string, string> = {};
            const style = rule.style;
            for (let j = 0; j < style.length; j++) {
              const prop = style[j];
              declarations[prop] = style.getPropertyValue(prop);
            }
            if (Object.keys(declarations).length > 0) {
              rulesWithSelectors.push({
                selector: rule.selectorText,
                declarations,
              });
            }
          }
        }
      }

      doc.head.removeChild(tempStyle);
    } catch {
      // If CSSStyleSheet parsing fails, fall back to regex-based parsing
      const ruleRegex = /([^{]+)\{([^}]+)\}/g;
      let match;
      while ((match = ruleRegex.exec(cssText)) !== null) {
        const selector = match[1].trim();
        const declarations = parseStyleDeclarations(match[2]);
        if (Object.keys(declarations).length > 0) {
          rulesWithSelectors.push({ selector, declarations });
        }
      }
    }
  }

  if (rulesWithSelectors.length === 0) return;

  // Apply each rule to matching elements in the document
  for (const { selector, declarations } of rulesWithSelectors) {
    try {
      const matchingElements = doc.body.querySelectorAll(selector);
      for (const el of matchingElements) {
        mergeStylesOntoElement(el as HTMLElement, declarations);
      }
    } catch {
      // Invalid selector — skip silently
    }
  }
}

/**
 * Google Docs wraps ALL clipboard content in a structural <b> tag:
 *   <b id="docs-internal-guid-XXXXX" style="font-weight:normal;">...content...</b>
 *
 * This is NOT a bold formatting tag — it is a container for Google Docs' internal
 * tracking GUID. The actual bold status is on <span> elements via font-weight CSS.
 *
 * This function detects such wrappers and replaces them with their child nodes,
 * preventing ProseMirror's BoldExtension parseDOM from applying bold to all content.
 */
function unwrapGoogleDocsStructuralB(doc: Document): void {
  const structuralBs = doc.body.querySelectorAll('b[id^="docs-internal-guid-"]');
  for (const b of structuralBs) {
    const parent = b.parentNode;
    if (!parent) continue;
    while (b.firstChild) {
      parent.insertBefore(b.firstChild, b);
    }
    parent.removeChild(b);
  }
}

/**
 * Word emits a "non-VML" fallback alongside every VML shape:
 *   <![if !vml]><span style='position:absolute'><table>...content...</table></span><![endif]>
 *
 * Browsers ignore the conditional-comment guard but DO render the inner table,
 * so ProseMirror's parseDOM picks up a phantom <table> for every textbox /
 * callout / signature block in the source document. Strip the fallback (and
 * the matching VML branch + any stray `<v:*>` / `<o:*>` tags) before parsing.
 */
function stripVmlFallback(html: string): string {
  if (
    !html.includes('vml') &&
    !html.includes('mso-') &&
    !html.includes('<o:') &&
    !html.includes('<v:')
  ) {
    return html;
  }
  // <![if !vml]>...<![endif]> wraps the phantom-table fallback — drop the
  // whole block (content is unwanted).
  // <![if !supportLists]>...<![endif]> wraps the list-marker span — drop ONLY
  // the wrapper tokens so reconstructWordLists can still see the inner
  // <span style='mso-list:Ignore'>, otherwise the browser's bogus-comment
  // parser eats the span when it tokenizes `<![if !supportLists]>`.
  return html
    .replace(/<!\[if !vml\]>[\s\S]*?<!\[endif\]>/gi, '')
    .replace(/<!\[if gte vml[\s\S]*?<!\[endif\]>/gi, '')
    .replace(/<!\[if !supportLists\]>/gi, '')
    .replace(/<!\[endif\]>/gi, '')
    .replace(/<\/?v:[^>]+>/gi, '')
    .replace(/<\/?o:[^>]+>/gi, '');
}

/**
 * Word emits list items as flat `<p style="mso-list:l0 level1 lfo1">` paragraphs
 * with the marker glyph baked in as literal text inside a `<span style='mso-list:Ignore'>`
 * wrapper. Without the original `<w:numbering>` we can't recover full list IDs,
 * but we can detect runs of adjacent mso-list paragraphs sharing the same `lN`
 * group, classify ordered vs unordered from the marker character, drop the
 * literal-marker spans, and rebuild the run as a real `<ol>` / `<ul>` so PM's
 * existing list parseDOM applies list semantics (toolbar toggles, renumbering,
 * round-trip to DOCX).
 */

const BULLET_CHARS = new Set(['•', '·', 'o', '■', '□', '▪', '▫', '◦', '–', '-', '*']);

function extractListMarker(p: HTMLParagraphElement): { marker: string; isOrdered: boolean } | null {
  const ignoreSpan = p.querySelector<HTMLSpanElement>('span[style*="mso-list:Ignore" i]');
  if (!ignoreSpan) return null;
  const raw = (ignoreSpan.textContent ?? '').trim();
  if (!raw) return null;
  const firstChar = raw.charAt(0);
  const isOrdered = !BULLET_CHARS.has(firstChar) && /[0-9a-zA-Z]/.test(firstChar);
  return { marker: raw, isOrdered };
}

function stripMarkerArtifacts(p: HTMLParagraphElement): void {
  // Remove the literal marker span (e.g. "1." or "•") and the trailing
  // tiny-font NBSP run Word emits as the marker-to-text gap.
  const ignoreSpan = p.querySelector<HTMLSpanElement>('span[style*="mso-list:Ignore" i]');
  ignoreSpan?.remove();
  // Word's marker is always followed by a span with `font:7.0pt "Times New Roman"`
  // holding NBSPs. Drop leading whitespace-only spans so the <li> starts at content.
  while (p.firstChild) {
    const node = p.firstChild;
    if (node.nodeType === Node.TEXT_NODE && !(node.textContent ?? '').trim()) {
      p.removeChild(node);
      continue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const text = (el.textContent ?? '').replace(/ /g, '').trim();
      if (text === '') {
        p.removeChild(node);
        continue;
      }
    }
    break;
  }
}

function getMsoListLevel(p: HTMLParagraphElement): number {
  const style = p.getAttribute('style') ?? '';
  const match = /mso-list\s*:\s*l\d+\s+level(\d+)/i.exec(style);
  return match ? Math.max(0, parseInt(match[1], 10) - 1) : 0;
}

// numId 1 reserved for bullets, 2 for numbered — matches the convention used
// by ListExtension.toggleList (see ListExtension.ts:60 `isBullet = numId === 1`).
const BULLET_NUM_ID = 1;
const ORDERED_NUM_ID = 2;

function reconstructWordLists(doc: Document): void {
  const paragraphs = doc.body.querySelectorAll<HTMLParagraphElement>('p[style*="mso-list" i]');
  for (const p of paragraphs) {
    const marker = extractListMarker(p);
    if (!marker) continue;
    stripMarkerArtifacts(p);
    const ilvl = getMsoListLevel(p);
    const numId = marker.isOrdered ? ORDERED_NUM_ID : BULLET_NUM_ID;
    p.dataset.numId = String(numId);
    p.dataset.numIlvl = String(ilvl);
    p.dataset.listIsBullet = String(!marker.isOrdered);
    // Remove the mso-list-derived margin/text-indent so the layout engine's
    // list rendering (hanging-indent from numPr) takes over instead of the
    // baked-in Word indentation that survives in the inline style.
    const style = p.getAttribute('style') ?? '';
    const cleaned = style
      .replace(/margin-left\s*:[^;]+;?/gi, '')
      .replace(/text-indent\s*:[^;]+;?/gi, '')
      .replace(/mso-[^:;]+:[^;]+;?/gi, '');
    if (cleaned.trim()) {
      p.setAttribute('style', cleaned);
    } else {
      p.removeAttribute('style');
    }
  }
}

/**
 * Transform pasted HTML by inlining class-based CSS, unwrapping Google Docs
 * wrappers, stripping Word VML fallbacks, and reconstructing Word lists.
 */
function transformPastedHTML(html: string): string {
  const hasStyleBlock = html.includes('<style');
  const hasGoogleDocsWrapper = html.includes('docs-internal-guid-');
  const hasWordArtifacts =
    html.includes('mso-') || html.includes('<v:') || html.includes('<o:') || html.includes('<![if');

  if (!hasStyleBlock && !hasGoogleDocsWrapper && !hasWordArtifacts) return html;

  try {
    const preprocessed = hasWordArtifacts ? stripVmlFallback(html) : html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(preprocessed, 'text/html');

    // Reconstruct lists BEFORE inlining <style> blocks: setProperty() during
    // style inlining causes the browser to reserialize the inline style
    // attribute, which drops unknown properties like `mso-list:l0 level1 lfo1`.
    if (hasWordArtifacts) {
      reconstructWordLists(doc);
    }

    if (hasStyleBlock) {
      inlineStylesFromStyleBlocks(doc);
      const styleElements = doc.querySelectorAll('style');
      for (const el of styleElements) {
        el.remove();
      }
    }

    if (hasGoogleDocsWrapper) {
      unwrapGoogleDocsStructuralB(doc);
    }

    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

export const PasteStyleInlinerExtension = createExtension({
  name: 'pasteStyleInliner',
  // Run before other paste handlers so styles are inlined before parseDOM
  priority: Priority.High,
  onSchemaReady(): ExtensionRuntime {
    const plugin = new Plugin({
      props: {
        transformPastedHTML(html: string): string {
          return transformPastedHTML(html);
        },
      },
    });

    return { plugins: [plugin] };
  },
});
