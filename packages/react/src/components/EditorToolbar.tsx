/**
 * EditorToolbar — compound component with optional ribbon-style tabs.
 *
 * Supports two layouts:
 *   1. Classic (Google Docs): TitleBar + FormattingBar (default)
 *   2. Tabbed (Word-style):   TitleBar + ToolbarTabs + active tab content
 *
 * Usage (tabbed):
 *   <EditorToolbar {...toolbarProps}>
 *     <EditorToolbar.TitleBar>
 *       <EditorToolbar.Logo><MyIcon /></EditorToolbar.Logo>
 *       <EditorToolbar.DocumentName value={name} onChange={setName} />
 *       <EditorToolbar.MenuBar />
 *       <EditorToolbar.ToolbarTabs
 *         activeTab={activeTab}
 *         onTabChange={setActiveTab}
 *         tabs={[
 *           { id: 'home', label: 'Home' },
 *           { id: 'review', label: 'Review' },
 *         ]}
 *       />
 *     </EditorToolbar.TitleBar>
 *     {activeTab === 'home' && <EditorToolbar.FormattingBar />}
 *     {activeTab === 'review' && <EditorToolbar.ReviewBar>{...}</EditorToolbar.ReviewBar>}
 *   </EditorToolbar>
 */

import type { ReactNode } from 'react';
import { EditorToolbarContext } from './EditorToolbarContext';
import type { EditorToolbarProps } from './EditorToolbarContext';
import { TitleBar, Logo, DocumentName, MenuBar, TitleBarRight } from './TitleBar';
import type { TitleBarProps, LogoProps, DocumentNameProps, TitleBarRightProps } from './TitleBar';
import { FormattingBar } from './FormattingBar';
import type { FormattingBarProps } from './FormattingBar';
import { ReviewBar } from './ReviewBar';
import type { ReviewBarProps } from './ReviewBar';
import { ToolbarTabs } from './ToolbarTabs';
import type { ToolbarTabsProps } from './ToolbarTabs';
import { cn } from '../lib/utils';

// ============================================================================
// Main compound component
// ============================================================================

interface EditorToolbarComponent {
  (props: EditorToolbarProps & { children: ReactNode }): React.JSX.Element;
  TitleBar: typeof TitleBar;
  Logo: typeof Logo;
  DocumentName: typeof DocumentName;
  MenuBar: typeof MenuBar;
  TitleBarRight: typeof TitleBarRight;
  FormattingBar: typeof FormattingBar;
  ReviewBar: typeof ReviewBar;
  ToolbarTabs: typeof ToolbarTabs;
}

function EditorToolbarBase({
  children,
  className,
  ...toolbarProps
}: EditorToolbarProps & { children: ReactNode }) {
  return (
    <EditorToolbarContext.Provider value={toolbarProps}>
      <div
        className={cn('flex flex-col bg-white shadow-sm flex-shrink-0', className)}
        data-testid="editor-toolbar"
      >
        {children}
      </div>
    </EditorToolbarContext.Provider>
  );
}

// Attach sub-components as static properties
const EditorToolbar = EditorToolbarBase as EditorToolbarComponent;
EditorToolbar.TitleBar = TitleBar;
EditorToolbar.Logo = Logo;
EditorToolbar.DocumentName = DocumentName;
EditorToolbar.MenuBar = MenuBar;
EditorToolbar.TitleBarRight = TitleBarRight;
EditorToolbar.FormattingBar = FormattingBar;
EditorToolbar.ReviewBar = ReviewBar;
EditorToolbar.ToolbarTabs = ToolbarTabs;

export { EditorToolbar };
export type {
  EditorToolbarProps,
  TitleBarProps,
  LogoProps,
  DocumentNameProps,
  TitleBarRightProps,
  FormattingBarProps,
  ReviewBarProps,
  ToolbarTabsProps,
};
