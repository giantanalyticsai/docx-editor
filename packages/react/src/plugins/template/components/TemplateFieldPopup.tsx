/**
 * Template Field Popup Component
 *
 * Rendered via React portal to document.body so it lives completely outside
 * ProseMirror's DOM tree. This is the only reliable way to get editable
 * inputs — PM intercepts keyboard events on any element inside its view.
 *
 * Positioning uses RenderedDomContext.getRectsForRange to get the tag's
 * overlay-relative rect, then converts to viewport coordinates using the
 * pages container's getBoundingClientRect.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { EditorView } from 'prosemirror-view';
import type { RenderedDomContext } from '../../../plugin-api/types';
import type { TemplateTag, TagType } from '../prosemirror-plugin';

interface TemplateFieldPopupProps {
  tag: TemplateTag;
  context: RenderedDomContext;
  editorView: EditorView;
  onClose: () => void;
}

function getPrefix(type: TagType): string {
  switch (type) {
    case 'sectionStart':
      return '#';
    case 'sectionEnd':
      return '/';
    case 'invertedStart':
      return '^';
    case 'raw':
      return '@';
    default:
      return '';
  }
}

function getTypeLabel(type: TagType): string {
  switch (type) {
    case 'sectionStart':
      return 'Loop start';
    case 'sectionEnd':
      return 'Loop end';
    case 'invertedStart':
      return 'Conditional';
    case 'raw':
      return 'Raw HTML';
    default:
      return 'Variable';
  }
}

const TYPE_COLORS: Record<TagType, string> = {
  variable: '#f59e0b',
  sectionStart: '#3b82f6',
  sectionEnd: '#3b82f6',
  invertedStart: '#8b5cf6',
  raw: '#ef4444',
};

export function TemplateFieldPopup({ tag, context, editorView, onClose }: TemplateFieldPopupProps) {
  const [name, setName] = useState(tag.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Focus the input when popup opens
  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [tag.id]);

  // Reset input value when a different tag is selected
  useEffect(() => {
    setName(tag.name);
  }, [tag.id, tag.name]);

  // Dismiss on click outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Dismiss on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleApply = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed || !/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(trimmed)) return;

    const prefix = getPrefix(tag.type);
    const newTagText = `{${prefix}${trimmed}}`;

    const tr = editorView.state.tr.replaceWith(
      tag.from,
      tag.to,
      editorView.state.schema.text(newTagText)
    );
    editorView.dispatch(tr);
    onClose();
  }, [name, tag, editorView, onClose]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleApply();
      }
      // Escape handled by document-level listener above
    },
    [handleApply]
  );

  // Convert overlay-relative position to fixed viewport coordinates
  const containerOffset = context.getContainerOffset();
  const rects = context.getRectsForRange(tag.from, tag.to);
  if (rects.length === 0) return null;

  const pagesContainer = context.pagesContainer;
  const containerRect = pagesContainer.getBoundingClientRect();
  const anchorRect = rects[0];
  const fixedTop = containerRect.top + anchorRect.y + containerOffset.y + anchorRect.height + 6;
  const fixedLeft = containerRect.left + anchorRect.x + containerOffset.x;

  const typeColor = TYPE_COLORS[tag.type];
  const typeLabel = getTypeLabel(tag.type);
  const isReadOnly = tag.type === 'sectionEnd';

  const popup = (
    <div
      ref={popupRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: fixedTop,
        left: fixedLeft,
        zIndex: 10000,
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
        padding: '16px 20px',
        minWidth: 320,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 13,
      }}
    >
      {/* Type badge */}
      <div
        style={{
          display: 'inline-block',
          background: `${typeColor}18`,
          color: typeColor,
          border: `1px solid ${typeColor}33`,
          borderRadius: 4,
          padding: '2px 8px',
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 12,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        {typeLabel}
      </div>

      {isReadOnly ? (
        <div style={{ color: '#6b7280', marginBottom: 12 }}>
          <code
            style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}
          >
            {tag.rawTag}
          </code>
          <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
            Rename the matching loop start tag to rename this one.
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 6 }}>
            Field Name
          </div>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleInputKeyDown}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 6,
              fontSize: 14,
              fontFamily: 'monospace',
              color: '#111827',
              background: '#fff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = typeColor;
              (e.target as HTMLInputElement).style.boxShadow = `0 0 0 2px ${typeColor}22`;
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = '#e2e8f0';
              (e.target as HTMLInputElement).style.boxShadow = 'none';
            }}
            placeholder="variable_name"
          />
          <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af' }}>
            Tag:{' '}
            <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>
              {`{${getPrefix(tag.type)}${name || '...'}}`}
            </code>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={onClose}
          style={{
            padding: '6px 14px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            fontSize: 13,
            color: '#6b7280',
            fontWeight: 500,
          }}
        >
          Cancel
        </button>
        {!isReadOnly && (
          <button
            onClick={handleApply}
            style={{
              padding: '6px 14px',
              border: 'none',
              borderRadius: 6,
              background: typeColor,
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
