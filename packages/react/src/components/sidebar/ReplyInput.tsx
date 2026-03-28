import { useState, useRef, useCallback } from 'react';
import { submitButtonStyle, CANCEL_BUTTON_STYLE } from './cardUtils';
import { MentionDropdown, type MentionProvider, type MentionUser } from './MentionDropdown';

const ACTIVE_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  border: '1px solid #1a73e8',
  borderRadius: 20,
  outline: 'none',
  fontSize: 14,
  padding: '8px 16px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  color: '#202124',
};

const INACTIVE_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  border: '1px solid #dadce0',
  borderRadius: 20,
  outline: 'none',
  fontSize: 14,
  padding: '8px 16px',
  fontFamily: 'inherit',
  color: '#80868b',
  cursor: 'text',
  backgroundColor: '#fff',
  boxSizing: 'border-box',
};

export interface ReplyInputProps {
  onSubmit: (text: string, mentions?: MentionUser[]) => void;
  mentionProvider?: MentionProvider;
}

export function ReplyInput({ onSubmit, mentionProvider }: ReplyInputProps) {
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionUser[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setText(value);

      if (!mentionProvider) {
        setMentionQuery(null);
        return;
      }

      // Detect @ trigger: find the last @ before cursor
      const cursorPos = e.target.selectionStart ?? value.length;
      const textBeforeCursor = value.slice(0, cursorPos);
      const atIndex = textBeforeCursor.lastIndexOf('@');

      if (atIndex >= 0) {
        const charBefore = atIndex > 0 ? textBeforeCursor[atIndex - 1] : ' ';
        // Only trigger if @ is at start or after a space
        if (atIndex === 0 || charBefore === ' ') {
          const query = textBeforeCursor.slice(atIndex + 1);
          // Don't show dropdown if there's a space after the query (mention completed)
          if (!query.includes(' ')) {
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
      // Replace @query with @name
      const cursorPos = inputRef.current?.selectionStart ?? text.length;
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
      inputRef.current?.focus();
    },
    [text]
  );

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed) {
      onSubmit(trimmed, mentions.length > 0 ? mentions : undefined);
    }
    setText('');
    setMentions([]);
    setActive(false);
    setMentionQuery(null);
  }, [text, mentions, onSubmit]);

  if (!active) {
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12 }}>
        <input
          readOnly
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setActive(true);
          }}
          placeholder="Reply or add others with @"
          style={INACTIVE_INPUT_STYLE}
        />
      </div>
    );
  }

  const trimmed = text.trim();

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, position: 'relative' }}>
      <input
        ref={(el) => {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          el?.focus({ preventScroll: true });
        }}
        type="text"
        value={text}
        onChange={handleChange}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          // Let MentionDropdown handle Enter/ArrowUp/ArrowDown/Escape when open
          if (
            mentionQuery !== null &&
            ['Enter', 'ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)
          ) {
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === 'Escape') {
            setActive(false);
            setText('');
            setMentionQuery(null);
          }
        }}
        placeholder="Reply or add others with @"
        style={ACTIVE_INPUT_STYLE}
      />
      {mentionQuery !== null && mentionProvider && (
        <MentionDropdown
          query={mentionQuery}
          provider={mentionProvider}
          onSelect={handleMentionSelect}
          onDismiss={() => setMentionQuery(null)}
          anchorRef={inputRef}
        />
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActive(false);
            setText('');
            setMentionQuery(null);
          }}
          style={CANCEL_BUTTON_STYLE}
        >
          Cancel
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSubmit();
          }}
          disabled={!trimmed}
          style={submitButtonStyle(!!trimmed)}
        >
          Reply
        </button>
      </div>
    </div>
  );
}
