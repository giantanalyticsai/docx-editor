/**
 * ReviewBar — toolbar content for the "Review" tab.
 *
 * Shows track-changes controls (accept/reject, navigation), comment buttons,
 * and the editing mode dropdown. Mirrors the FormattingBar pattern: reads
 * props from EditorToolbarContext, renders ToolbarGroup/ToolbarButton.
 *
 * Separated from FormattingBar because these are conceptually different
 * workflows (formatting vs. review) and Word/GDocs separate them too.
 */

import React, { useCallback } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../lib/utils';

export interface ReviewBarProps {
  /** Additional CSS class name */
  className?: string;
  /** Custom items to render at the end of the review bar */
  children?: ReactNode;
  /** When true, renders with display:contents for inline flex flow */
  inline?: boolean;
}

/**
 * ReviewBar renders review/collaboration tools.
 *
 * Actual button wiring is done via `children` from the consumer (DocxEditor)
 * because the review actions need access to the editor view instance, which
 * lives in the component that owns the ProseMirror state — not in the toolbar.
 */
export function ReviewBar({ className, children, inline = false }: ReviewBarProps) {
  const handleBarMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive =
      target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
    if (!isInteractive) {
      e.preventDefault();
    }
  }, []);

  return (
    <div
      className={cn(
        inline
          ? 'contents'
          : 'flex items-center px-1 py-1 bg-white border-b border-slate-100 min-h-[36px] overflow-x-auto',
        className
      )}
      role="toolbar"
      aria-label="Review toolbar"
      data-testid="review-bar"
      onMouseDown={inline ? undefined : handleBarMouseDown}
    >
      {children}
    </div>
  );
}
