/**
 * MentionDropdown — @mention autocomplete for comment inputs.
 *
 * Renders a dropdown of matching users when the user types @ in a
 * comment input. Positioned above or below the input based on viewport.
 * Keyboard navigable (arrow keys + Enter to select, Escape to dismiss).
 */

import { useState, useEffect, useRef } from 'react';

export interface MentionUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
}

export type MentionProvider = (query: string) => Promise<MentionUser[]>;

interface MentionDropdownProps {
  query: string;
  provider: MentionProvider;
  onSelect: (user: MentionUser) => void;
  onDismiss: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function MentionDropdown({
  query,
  provider,
  onSelect,
  onDismiss,
  anchorRef,
}: MentionDropdownProps) {
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch users when query changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    provider(query).then((results) => {
      if (!cancelled) {
        setUsers(results);
        setActiveIndex(0);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [query, provider]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, users.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && users.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(users[activeIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    }
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [users, activeIndex, onSelect, onDismiss]);

  // Position relative to anchor
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.top - 4,
      left: rect.left,
    });
  }, [anchorRef, query]);

  if (users.length === 0 && !loading) return null;

  return (
    <div
      ref={dropdownRef}
      onMouseDown={(e) => e.preventDefault()}
      style={{
        position: 'fixed',
        bottom: window.innerHeight - position.top,
        left: position.left,
        zIndex: 10001,
        background: '#fff',
        border: '1px solid #dadce0',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        minWidth: 200,
        maxWidth: 280,
        maxHeight: 200,
        overflowY: 'auto',
        padding: '4px 0',
        fontSize: 13,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {loading && <div style={{ padding: '8px 12px', color: '#80868b' }}>Searching...</div>}
      {users.map((user, index) => (
        <div
          key={user.id}
          onClick={() => onSelect(user)}
          style={{
            padding: '6px 12px',
            cursor: 'pointer',
            backgroundColor: index === activeIndex ? '#e8f0fe' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          onMouseEnter={() => setActiveIndex(index)}
        >
          {/* Avatar circle */}
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: '#1a73e8',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div
            style={{
              fontWeight: 500,
              color: '#202124',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {user.name}
          </div>
        </div>
      ))}
    </div>
  );
}
