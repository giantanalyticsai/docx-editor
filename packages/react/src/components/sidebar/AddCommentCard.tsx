import { useState, useRef, useCallback } from 'react';
import type { SidebarItemRenderProps } from '../../plugin-api/types';
import { submitButtonStyle, CANCEL_BUTTON_STYLE } from './cardUtils';
import { MentionDropdown, type MentionProvider, type MentionUser } from './MentionDropdown';

export interface AddCommentCardProps extends SidebarItemRenderProps {
  onSubmit?: (text: string, mentions?: MentionUser[]) => void;
  onCancel?: () => void;
  mentionProvider?: MentionProvider;
}

export function AddCommentCard({
  measureRef,
  onSubmit,
  onCancel,
  mentionProvider,
}: AddCommentCardProps) {
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionUser[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setText(value);

      if (!mentionProvider) {
        setMentionQuery(null);
        return;
      }

      const cursorPos = e.target.selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex >= 0) {
        const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
        if (atIndex === 0 || charBefore === ' ' || charBefore === '\n') {
          const query = textBeforeCursor.slice(atIndex + 1);
          if (!query.includes(' ') && !query.includes('\n')) {
            setMentionQuery(query);
            return;
          }
        }
      }
      setMentionQuery(null);
    },
    [mentionProvider]
  );

  const handleMentionSelect = useCallback(
    (user: MentionUser) => {
      const cursorPos = textareaRef.current?.selectionStart ?? text.length;
      const textBeforeCursor = text.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');
      if (atIndex >= 0) {
        const before = text.slice(0, atIndex);
        const after = text.slice(cursorPos);
        const newText = `${before}@${user.name} ${after}`;
        setText(newText);
        setMentions((prev) => [...prev, user]);
      }
      setMentionQuery(null);
      textareaRef.current?.focus();
    },
    [text]
  );

  const handleSubmit = useCallback(() => {
    if (text.trim()) {
      onSubmit?.(text.trim(), mentions.length > 0 ? mentions : undefined);
      setText('');
      setMentions([]);
      setMentionQuery(null);
    }
  }, [text, mentions, onSubmit]);

  return (
    <div
      ref={measureRef}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#fff',
        boxShadow: '0 1px 3px rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
        zIndex: 50,
        position: 'relative',
      }}
    >
      <textarea
        ref={(el) => {
          (textareaRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
          el?.focus({ preventScroll: true });
        }}
        value={text}
        onChange={handleChange}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (
            mentionQuery !== null &&
            ['Enter', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)
          ) {
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === 'Escape') {
            onCancel?.();
            setText('');
            setMentionQuery(null);
          }
        }}
        placeholder="Add a comment... Use @ to mention"
        style={{
          width: '100%',
          border: '1px solid #1a73e8',
          borderRadius: 20,
          outline: 'none',
          resize: 'none',
          fontSize: 14,
          lineHeight: '20px',
          padding: '8px 16px',
          fontFamily: 'inherit',
          minHeight: 40,
          boxSizing: 'border-box',
          color: '#202124',
        }}
      />
      {mentionQuery !== null && mentionProvider && (
        <MentionDropdown
          query={mentionQuery}
          provider={mentionProvider}
          onSelect={handleMentionSelect}
          onDismiss={() => setMentionQuery(null)}
          anchorRef={textareaRef}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button
          onClick={() => {
            onCancel?.();
            setText('');
            setMentionQuery(null);
          }}
          style={CANCEL_BUTTON_STYLE}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          style={submitButtonStyle(!!text.trim())}
        >
          Comment
        </button>
      </div>
    </div>
  );
}
