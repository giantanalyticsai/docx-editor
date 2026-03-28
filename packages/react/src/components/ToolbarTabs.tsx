/**
 * ToolbarTabs — Word-style ribbon tab switcher.
 *
 * Renders a row of tab buttons that control which toolbar bar is visible
 * (e.g. Home → FormattingBar, Review → ReviewBar). Intended to sit inside
 * the TitleBar alongside the MenuBar.
 *
 * Styling matches the MenuDropdown trigger buttons for visual consistency.
 */

import type { CSSProperties } from 'react';

export interface ToolbarTab {
  /** Unique tab identifier */
  id: string;
  /** Display label */
  label: string;
}

export interface ToolbarTabsProps {
  /** Available tabs */
  tabs: ToolbarTab[];
  /** Currently active tab id */
  activeTab: string;
  /** Called when the user clicks a tab */
  onTabChange: (tabId: string) => void;
  /** Whether tabs are disabled */
  disabled?: boolean;
}

const baseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '2px 10px',
  border: 'none',
  background: 'transparent',
  borderRadius: '4px 4px 0 0',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 400,
  color: 'var(--doc-text, #374151)',
  whiteSpace: 'nowrap',
  height: 28,
  lineHeight: '28px',
  borderBottomWidth: 2,
  borderBottomStyle: 'solid',
  borderBottomColor: 'transparent',
  transition: 'border-color 0.15s, background 0.15s',
};

const activeStyle: CSSProperties = {
  ...baseStyle,
  fontWeight: 500,
  borderBottomColor: 'var(--doc-primary, #1a73e8)',
  color: 'var(--doc-primary, #1a73e8)',
};

export function ToolbarTabs({ tabs, activeTab, onTabChange, disabled = false }: ToolbarTabsProps) {
  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-end', gap: 2, marginLeft: 8 }}
      role="tablist"
      aria-label="Toolbar tabs"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`toolbar-panel-${tab.id}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => !disabled && onTabChange(tab.id)}
            style={isActive ? activeStyle : baseStyle}
            onMouseOver={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'var(--doc-hover, #f3f4f6)';
              }
            }}
            onMouseOut={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
