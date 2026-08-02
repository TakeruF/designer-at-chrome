import { useEffect, useState } from 'react';
import { isExtensionMessage, sendRuntimeMessage } from '../shared/messages';
import type { SelectedElementInfo, ThemePreference, UIState } from '../shared/types';
import { getUIState, setUIState } from '../storage/bookmark-storage';
import { BookmarkIcon, InspectIcon, ThemeIcon } from './components/Icons';
import { Button } from './components/UI';
import { BookmarksPage } from './pages/BookmarksPage';
import { InspectPage } from './pages/InspectPage';

const themeOrder: ThemePreference[] = ['system', 'light', 'dark'];

export function App() {
  const [uiState, setState] = useState<UIState>({ activeTab: 'inspect', theme: 'system' });
  const [hydrated, setHydrated] = useState(false);
  const [selection, setSelection] = useState<SelectedElementInfo | null>(null);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [bookmarksVersion, setBookmarksVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void getUIState()
      .then((state) => {
        if (active) setState(state);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    void sendRuntimeMessage<SelectedElementInfo | null>({ type: 'GET_SELECTION' })
      .then((current) => {
        if (active && current) setSelection(current);
      })
      .catch((caught: unknown) => {
        if (active)
          setInspectionError(
            caught instanceof Error ? caught.message : 'このページを検査できません。',
          );
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const listener = (message: unknown) => {
      if (isExtensionMessage(message) && message.type === 'ELEMENT_SELECTED') {
        setSelection(message.payload);
        setInspectionError(null);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    if (uiState.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = uiState.theme;
    if (hydrated)
      void setUIState(uiState).catch((caught: unknown) =>
        console.error('Failed to persist UI state.', caught),
      );
  }, [hydrated, uiState]);

  const selectTab = (activeTab: UIState['activeTab']) =>
    setState((state) => ({ ...state, activeTab }));
  const cycleTheme = () => {
    setState((state) => {
      const index = themeOrder.indexOf(state.theme);
      return { ...state, theme: themeOrder[(index + 1) % themeOrder.length] };
    });
  };
  const onSaved = () => {
    setBookmarksVersion((value) => value + 1);
    selectTab('bookmarks');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="UI Lens">
          <span className="brand__mark">
            <i />
            <i />
            <i />
          </span>
          <strong>UI Lens</strong>
          <small>Local</small>
        </div>
        <Button
          variant="icon"
          aria-label={`テーマを変更。現在: ${uiState.theme}`}
          title={`Theme: ${uiState.theme}`}
          onClick={cycleTheme}
        >
          <ThemeIcon />
        </Button>
      </header>
      <nav className="tab-bar" aria-label="Main navigation">
        <button
          className={uiState.activeTab === 'inspect' ? 'is-active' : ''}
          aria-current={uiState.activeTab === 'inspect' ? 'page' : undefined}
          onClick={() => selectTab('inspect')}
        >
          <InspectIcon /> Inspect
        </button>
        <button
          className={uiState.activeTab === 'bookmarks' ? 'is-active' : ''}
          aria-current={uiState.activeTab === 'bookmarks' ? 'page' : undefined}
          onClick={() => selectTab('bookmarks')}
        >
          <BookmarkIcon /> Bookmarks
        </button>
      </nav>
      <main>
        {uiState.activeTab === 'inspect' ? (
          <InspectPage
            selection={selection}
            error={inspectionError}
            onSelection={setSelection}
            onSaved={onSaved}
          />
        ) : (
          <BookmarksPage refreshToken={bookmarksVersion} />
        )}
      </main>
    </div>
  );
}
