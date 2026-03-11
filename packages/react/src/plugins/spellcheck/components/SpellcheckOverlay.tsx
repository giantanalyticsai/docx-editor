import React, { useEffect, useLayoutEffect, useRef, useCallback, useMemo, useState } from 'react';
import type { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import {
  TextContextMenu,
  type TextContextMenuItem,
  type TextContextAction,
  getDefaultTextContextMenuItems,
} from '../../../components/TextContextMenu';
import { findWordBoundaries } from '@eigenpal/docx-core/utils/textSelection';
import type { RenderedDomContext } from '../../../plugin-api/types';
import type { SpellcheckMenuState, SpellcheckMisspelling } from '../prosemirror-plugin';
import {
  addWordToDictionary,
  closeSpellcheckMenu,
  ignoreMisspelling,
  spellcheckPluginKey,
} from '../prosemirror-plugin';
import { isCheckableWord, normalizeWord } from '../utils';

export interface SpellcheckOverlayProps {
  context: RenderedDomContext;
  editorView: EditorView | null;
  misspellings: SpellcheckMisspelling[];
  menu: SpellcheckMenuState | null;
}

type Rect = { x: number; y: number; width: number; height: number };

interface CachedMisspelling {
  misspelling: SpellcheckMisspelling;
  rects: Rect[];
}

interface UnderlineLine {
  key: string;
  rect: Rect;
  offset: { x: number; y: number };
}

const WAVE_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='8' height='4' viewBox='0 0 8 4'><path d='M0 3 Q2 1 4 3 T8 3' fill='none' stroke='#ef4444' stroke-width='1.2'/></svg>";
const WAVE_URL = `url(\"data:image/svg+xml,${encodeURIComponent(WAVE_SVG)}\")`;
const TYPING_IDLE_MS = 200;

function pointInRect(
  x: number,
  y: number,
  rect: { x: number; y: number; width: number; height: number }
) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function getMisspellingFromPoint(
  context: RenderedDomContext,
  clientX: number,
  clientY: number
): SpellcheckMisspelling | null {
  const ownerDoc = context.pagesContainer.ownerDocument;
  if (!ownerDoc) return null;

  const doc = ownerDoc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const caretPosition = doc.caretPositionFromPoint?.(clientX, clientY) ?? null;
  const caretRange = caretPosition ? null : (doc.caretRangeFromPoint?.(clientX, clientY) ?? null);

  if (!caretPosition && !caretRange) return null;

  const offsetNode = caretPosition
    ? caretPosition.offsetNode
    : (caretRange?.startContainer ?? null);
  const offset = caretPosition ? caretPosition.offset : (caretRange?.startOffset ?? 0);
  if (!offsetNode) return null;

  const element =
    offsetNode.nodeType === Node.ELEMENT_NODE
      ? (offsetNode as Element)
      : (offsetNode.parentElement ?? null);
  const span = element?.closest('span[data-pm-start][data-pm-end]') as HTMLElement | null;
  if (!span || !span.firstChild || span.firstChild.nodeType !== Node.TEXT_NODE) return null;

  const textNode = span.firstChild as Text;
  const text = textNode.data ?? '';
  if (!text) return null;

  const pmStart = Number(span.dataset.pmStart);
  const pmEnd = Number(span.dataset.pmEnd);
  if (!Number.isFinite(pmStart) || !Number.isFinite(pmEnd)) return null;

  const maxOffset = Math.max(0, text.length - 1);
  const clampedOffset = Math.max(0, Math.min(offset, maxOffset));
  const [start, end] = findWordBoundaries(text, clampedOffset);
  if (start === end) return null;

  const word = text.slice(start, end);
  if (!isCheckableWord(word)) return null;

  return {
    from: pmStart + start,
    to: pmStart + end,
    word: normalizeWord(word),
  };
}

export const SpellcheckOverlay: React.FC<SpellcheckOverlayProps> = ({
  context,
  editorView,
  misspellings,
  menu,
}) => {
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [lines, setLines] = useState<UnderlineLine[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    open: boolean;
    x: number;
    y: number;
    misspelling: SpellcheckMisspelling | null;
  }>({ open: false, x: 0, y: 0, misspelling: null });
  const cacheRef = useRef<Map<string, CachedMisspelling>>(new Map());
  const rafRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const pendingRecomputeRef = useRef(false);
  const lastLayoutVersionRef = useRef(0);
  const typingRef = useRef(false);
  const hasSelection = !!editorView && !editorView.state.selection.empty;
  const isEditable = editorView?.editable ?? false;

  const buildKey = useCallback(
    (misspelling: SpellcheckMisspelling) =>
      `${misspelling.from}:${misspelling.to}:${misspelling.word}`,
    []
  );

  const scheduleRecompute = useCallback(
    (force: boolean) => {
      if (typingRef.current) {
        pendingRecomputeRef.current = true;
        return;
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        if (misspellings.length === 0) {
          cacheRef.current = new Map();
          setLines([]);
          return;
        }

        const nextCache = new Map<string, CachedMisspelling>();
        const nextLines: UnderlineLine[] = [];
        const containerOffset = context.getContainerOffset();

        for (const misspelling of misspellings) {
          const key = buildKey(misspelling);
          let entry = force ? undefined : cacheRef.current.get(key);

          if (!entry) {
            entry = {
              misspelling,
              rects: context.getRectsForRange(misspelling.from, misspelling.to),
            };
          }

          nextCache.set(key, entry);

          entry.rects.forEach((rect, rectIndex) => {
            nextLines.push({
              key: `${key}-${rectIndex}`,
              rect,
              offset: containerOffset,
            });
          });
        }

        cacheRef.current = nextCache;
        setLines(nextLines);
      });
    },
    [buildKey, context, misspellings]
  );

  const enterTyping = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!typingRef.current) {
      typingRef.current = true;
      setIsTyping(true);
      setLines([]);
    }

    pendingRecomputeRef.current = true;

    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      typingRef.current = false;
      setIsTyping(false);

      if (pendingRecomputeRef.current) {
        pendingRecomputeRef.current = false;
        scheduleRecompute(true);
      }
    }, TYPING_IDLE_MS);
  }, [scheduleRecompute]);

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      const containerRect = context.pagesContainer.getBoundingClientRect();
      if (
        event.clientX < containerRect.left ||
        event.clientX > containerRect.right ||
        event.clientY < containerRect.top ||
        event.clientY > containerRect.bottom
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      editorView?.focus();
      const localX = (event.clientX - containerRect.left) / context.zoom;
      const localY = (event.clientY - containerRect.top) / context.zoom;

      const cachedEntries = Array.from(cacheRef.current.values());
      let hit = cachedEntries.find((entry) =>
        entry.rects.some((rect) => pointInRect(localX, localY, rect))
      );

      if (!hit) {
        // Fallback: compute rects on demand for hit-testing when cache is empty.
        for (const misspelling of misspellings) {
          const rects = context.getRectsForRange(misspelling.from, misspelling.to);
          if (rects.some((rect) => pointInRect(localX, localY, rect))) {
            hit = { misspelling, rects };
            break;
          }
        }
      }

      let misspelling = hit?.misspelling ?? null;
      if (!misspelling) {
        misspelling = getMisspellingFromPoint(context, event.clientX, event.clientY);
      }

      setContextMenu({
        open: true,
        x: event.clientX,
        y: event.clientY,
        misspelling,
      });

      if (misspelling && editorView) {
        const nextMenu: SpellcheckMenuState = {
          open: true,
          x: event.clientX,
          y: event.clientY,
          from: misspelling.from,
          to: misspelling.to,
          word: misspelling.word,
          suggestions: [],
          loading: true,
        };

        editorView.dispatch(
          editorView.state.tr.setMeta(spellcheckPluginKey, {
            type: 'spellcheck:menuOpen',
            menu: nextMenu,
          })
        );
      } else if (editorView) {
        closeSpellcheckMenu(editorView);
      }
    },
    [context, editorView, misspellings]
  );

  useLayoutEffect(() => {
    const container = context.pagesContainer;
    if (!container) return;

    const ownerDoc = container.ownerDocument;
    if (!ownerDoc) return;

    ownerDoc.addEventListener('contextmenu', handleContextMenu, true);
    return () => ownerDoc.removeEventListener('contextmenu', handleContextMenu, true);
  }, [context.pagesContainer, handleContextMenu]);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => (prev.open ? { ...prev, open: false } : prev));
    if (editorView) {
      closeSpellcheckMenu(editorView);
    }
  }, [editorView]);

  const handleMenuAction = useCallback(
    async (action: TextContextAction, value?: string) => {
      if (!editorView) return;

      const { state } = editorView;
      const { selection } = state;

      switch (action) {
        case 'cut':
          editorView.focus();
          document.execCommand('cut');
          break;
        case 'copy':
          editorView.focus();
          document.execCommand('copy');
          break;
        case 'paste':
          editorView.focus();
          document.execCommand('paste');
          break;
        case 'pasteAsPlainText': {
          editorView.focus();
          if (navigator.clipboard?.readText) {
            try {
              const text = await navigator.clipboard.readText();
              if (text) {
                editorView.dispatch(state.tr.insertText(text, selection.from, selection.to));
                break;
              }
            } catch {
              // fall through to execCommand
            }
          }
          document.execCommand('paste');
          break;
        }
        case 'delete':
          if (!selection.empty) {
            editorView.dispatch(state.tr.deleteSelection());
          }
          break;
        case 'selectAll': {
          const allSelection = TextSelection.create(state.doc, 0, state.doc.content.size);
          editorView.dispatch(state.tr.setSelection(allSelection));
          editorView.focus();
          break;
        }
        case 'spellcheckReplace': {
          const misspelling = contextMenu.misspelling;
          if (misspelling && value) {
            editorView.dispatch(state.tr.insertText(value, misspelling.from, misspelling.to));
            editorView.focus();
          }
          break;
        }
        case 'spellcheckIgnore': {
          const misspelling = contextMenu.misspelling;
          if (misspelling) {
            ignoreMisspelling(editorView, misspelling.from, misspelling.to);
          }
          break;
        }
        case 'spellcheckAddToDictionary': {
          const misspelling = contextMenu.misspelling;
          if (misspelling) {
            addWordToDictionary(editorView, misspelling.word);
          }
          break;
        }
        case 'spellcheckSuggestions':
        case 'spellcheckLoading':
        case 'separator':
          break;
      }
    },
    [contextMenu.misspelling, editorView]
  );

  const menuItems = useMemo(() => {
    const baseItems = getDefaultTextContextMenuItems();
    if (!contextMenu.misspelling) return baseItems;

    const items: TextContextMenuItem[] = [...baseItems, { action: 'separator', label: '' }];

    const menuMatches =
      !!menu &&
      menu.from === contextMenu.misspelling.from &&
      menu.to === contextMenu.misspelling.to;

    const suggestions = menuMatches ? menu.suggestions : [];
    const loading = menuMatches ? menu.loading : false;

    const suggestionItems: TextContextMenuItem[] = suggestions.slice(0, 5).map((suggestion) => ({
      action: 'spellcheckReplace' as const,
      label: suggestion,
      value: suggestion,
    }));

    if (loading && suggestionItems.length === 0) {
      suggestionItems.push({
        action: 'spellcheckLoading',
        label: 'Loading suggestions...',
        disabled: true,
      });
    }

    if (!loading && suggestionItems.length === 0) {
      suggestionItems.push({
        action: 'spellcheckLoading',
        label: 'No suggestions',
        disabled: true,
      });
    }

    items.push({
      action: 'spellcheckSuggestions',
      label: 'Suggestions',
      submenu: suggestionItems,
    });

    items.push({
      action: 'spellcheckIgnore',
      label: 'Ignore',
    });

    items.push({
      action: 'spellcheckAddToDictionary',
      label: 'Add to Dictionary',
    });

    return items;
  }, [contextMenu.misspelling, menu]);

  useEffect(() => {
    if (!editorView?.dom) return;
    const target = editorView.dom;

    const handleBeforeInput = (event: Event) => {
      const inputEvent = event as InputEvent;
      if (!inputEvent.inputType) return;
      if (inputEvent.inputType.startsWith('insert') || inputEvent.inputType.startsWith('delete')) {
        enterTyping();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.length === 1) {
        enterTyping();
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        enterTyping();
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        enterTyping();
      }
    };

    const handleCompositionStart = () => enterTyping();
    const handleCompositionEnd = () => enterTyping();

    target.addEventListener('beforeinput', handleBeforeInput);
    target.addEventListener('keydown', handleKeyDown);
    target.addEventListener('compositionstart', handleCompositionStart);
    target.addEventListener('compositionend', handleCompositionEnd);

    return () => {
      target.removeEventListener('beforeinput', handleBeforeInput);
      target.removeEventListener('keydown', handleKeyDown);
      target.removeEventListener('compositionstart', handleCompositionStart);
      target.removeEventListener('compositionend', handleCompositionEnd);
    };
  }, [editorView, enterTyping]);

  useEffect(() => {
    const force = layoutVersion !== lastLayoutVersionRef.current;
    lastLayoutVersionRef.current = layoutVersion;
    scheduleRecompute(force);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [layoutVersion, misspellings, scheduleRecompute]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
    });
    observer.observe(context.pagesContainer);
    return () => observer.disconnect();
  }, [context.pagesContainer]);

  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
  }, [context.zoom]);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {!isTyping && lines.length > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {lines.map(({ key, rect, offset }) => {
            const lineHeight = 4;
            return (
              <div
                key={key}
                className="docx-spellcheck-underline"
                style={{
                  position: 'absolute',
                  left: rect.x + offset.x,
                  top: rect.y + offset.y + rect.height - lineHeight + 1,
                  width: rect.width,
                  height: lineHeight,
                  backgroundImage: WAVE_URL,
                  backgroundRepeat: 'repeat-x',
                  backgroundSize: '8px 4px',
                  pointerEvents: 'none',
                }}
              />
            );
          })}
        </div>
      )}
      <TextContextMenu
        isOpen={contextMenu.open}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        hasSelection={hasSelection}
        isEditable={isEditable}
        items={menuItems}
        onAction={handleMenuAction}
        onClose={closeContextMenu}
      />
    </>
  );
};

export default SpellcheckOverlay;
