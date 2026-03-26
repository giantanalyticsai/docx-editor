/**
 * Find & Replace with Track Changes Commands
 *
 * PM-level text search and tracked-change replacement. Uses the same
 * position-mapping pattern as the template plugin's findTags() to
 * correctly map text offsets to ProseMirror document positions across
 * node boundaries (runs, marks, inline nodes).
 *
 * Separated from comments.ts because this concerns document search,
 * not comment/revision mark management.
 */

import type { Command } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';

/**
 * A PM document position range (from inclusive, to exclusive).
 */
export interface TextMatch {
  from: number;
  to: number;
}

/**
 * Find all occurrences of searchText in the ProseMirror document.
 *
 * Collects all text nodes via doc.descendants, builds a combined string
 * with a position map so that string indices translate back to PM positions.
 * This handles text split across runs, marks, and inline nodes correctly.
 */
export function findTextPositions(
  doc: PMNode,
  searchText: string,
  options?: { matchCase?: boolean }
): TextMatch[] {
  if (!searchText) return [];

  const { matchCase = false } = options ?? {};

  // Collect text parts with their PM start positions
  const parts: { text: string; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      parts.push({ text: node.text, pos });
    }
    return true;
  });

  // Build combined string and a map from combined-string index → PM position
  let combined = '';
  const posMap: number[] = [];
  for (const p of parts) {
    for (let i = 0; i < p.text.length; i++) {
      posMap.push(p.pos + i);
    }
    combined += p.text;
  }

  const needle = matchCase ? searchText : searchText.toLowerCase();
  const haystack = matchCase ? combined : combined.toLowerCase();

  const results: TextMatch[] = [];
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    const endIdx = idx + searchText.length - 1;
    results.push({
      from: posMap[idx],
      // posMap[endIdx] is the start of the last character; +1 gives exclusive end
      to: posMap[endIdx] + 1,
    });
    idx += searchText.length;
  }

  return results;
}

/**
 * Replace all occurrences of searchText with replaceText, marking the
 * old text with a deletion mark and the new text with an insertion mark.
 *
 * This works whether or not suggestion mode is currently active — marks
 * are applied explicitly rather than relying on the suggestion mode plugin's
 * appendTransaction hook. The transaction is tagged with 'suggestionModeApplied'
 * so the hook skips it and avoids double-marking.
 */
export function replaceWithTracking(
  searchText: string,
  replaceText: string,
  options?: { author?: string; matchCase?: boolean }
): Command {
  return (state, dispatch) => {
    const matches = findTextPositions(state.doc, searchText, options);
    if (matches.length === 0) return false;
    if (!dispatch) return true;

    const { author = 'User' } = options ?? {};
    const insertionType = state.schema.marks.insertion;
    const deletionType = state.schema.marks.deletion;

    if (!insertionType || !deletionType) return false;

    const now = new Date().toISOString();
    let tr = state.tr;

    // Process in reverse order so earlier positions stay valid after later ones shift
    for (let i = matches.length - 1; i >= 0; i--) {
      const { from, to } = matches[i];
      // Use a unique revisionId per match so each change is independently accept/rejectable
      const revisionId = Date.now() + i;
      const attrs = { revisionId, author, date: now };

      // Mark the old text as deleted (red strikethrough)
      tr = tr.addMark(from, to, deletionType.create(attrs));

      // Insert the replacement text with an insertion mark (green underline)
      if (replaceText.length > 0) {
        const insertionMark = insertionType.create(attrs);
        const newNode = state.schema.text(replaceText, [insertionMark]);
        tr = tr.insert(to, newNode);
      }
    }

    // Prevent suggestionMode's appendTransaction from re-processing this transaction
    tr.setMeta('suggestionModeApplied', true);
    dispatch(tr);
    return true;
  };
}

/**
 * Replace only the next occurrence of searchText after the current cursor,
 * applying deletion + insertion marks as tracked changes.
 */
export function replaceNextWithTracking(
  searchText: string,
  replaceText: string,
  options?: { author?: string; matchCase?: boolean }
): Command {
  return (state, dispatch) => {
    const allMatches = findTextPositions(state.doc, searchText, options);
    if (allMatches.length === 0) return false;

    const cursorPos = state.selection.from;
    // Find first match at or after cursor; wrap around to first if none
    const match = allMatches.find((m) => m.from >= cursorPos) ?? allMatches[0];

    if (!dispatch) return true;

    const { author = 'User' } = options ?? {};
    const insertionType = state.schema.marks.insertion;
    const deletionType = state.schema.marks.deletion;

    if (!insertionType || !deletionType) return false;

    const now = new Date().toISOString();
    const revisionId = Date.now();
    const attrs = { revisionId, author, date: now };

    let tr = state.tr;
    tr = tr.addMark(match.from, match.to, deletionType.create(attrs));
    if (replaceText.length > 0) {
      const insertionMark = insertionType.create(attrs);
      tr = tr.insert(match.to, state.schema.text(replaceText, [insertionMark]));
    }

    tr.setMeta('suggestionModeApplied', true);
    dispatch(tr);
    return true;
  };
}
