import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ExtensionRuntimeError, isExtensionMessage, sendRuntimeMessage } from '../shared/messages';
import type {
  ExtensionError,
  SelectedElementInfo,
  ThemePreference,
  UIState,
} from '../shared/types';
import { getUIState, localeFromLanguage, setUIState } from '../storage/bookmark-storage';
import { BookmarkIcon, InspectIcon, ThemeIcon } from './components/Icons';
import { Button } from './components/UI';
import { I18nProvider, useI18n } from './i18n';
import { BookmarksPage } from './pages/BookmarksPage';
import { InspectPage } from './pages/InspectPage';

const themeOrder: ThemePreference[] = ['system', 'light', 'dark'];
const initialState: UIState = {
  activeTab: 'inspect',
  theme: 'system',
  locale: localeFromLanguage(chrome.i18n.getUILanguage()),
};

function extensionError(caught: unknown): ExtensionError {
  if (caught instanceof ExtensionRuntimeError)
    return { code: caught.code, message: caught.message };
  return {
    code: 'UNKNOWN',
    message: caught instanceof Error ? caught.message : 'An unexpected error occurred.',
  };
}

export function App() {
  const [uiState, setState] = useState<UIState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [selection, setSelection] = useState<SelectedElementInfo | null>(null);
  const [inspectionError, setInspectionError] = useState<ExtensionError | null>(null);
  const [bookmarksVersion, setBookmarksVersion] = useState(0);

  const refreshSelection = useCallback(async () => {
    try {
      const current = await sendRuntimeMessage<SelectedElementInfo | null>({
        type: 'GET_SELECTION',
      });
      setSelection(current);
      setInspectionError(null);
    } catch (caught) {
      setSelection(null);
      setInspectionError(extensionError(caught));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getUIState()
      .then((state) => {
        if (active) setState(state);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    void refreshSelection();
    return () => {
      active = false;
    };
  }, [refreshSelection]);

  useEffect(() => {
    const messageListener = (message: unknown) => {
      if (isExtensionMessage(message) && message.type === 'ELEMENT_SELECTED') {
        setSelection(message.payload);
        setInspectionError(null);
      }
    };
    const tabActivatedListener = () => void refreshSelection();
    const tabUpdatedListener = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      if (changeInfo.url && tab.active) void refreshSelection();
    };
    chrome.runtime.onMessage.addListener(messageListener);
    chrome.tabs.onActivated.addListener(tabActivatedListener);
    chrome.tabs.onUpdated.addListener(tabUpdatedListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.tabs.onActivated.removeListener(tabActivatedListener);
      chrome.tabs.onUpdated.removeListener(tabUpdatedListener);
    };
  }, [refreshSelection]);

  useEffect(() => {
    if (uiState.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = uiState.theme;
    document.documentElement.lang = uiState.locale;
    if (hydrated) {
      void setUIState(uiState).catch((caught: unknown) =>
        console.error('Failed to persist UI state.', caught),
      );
    }
  }, [hydrated, uiState]);

  return (
    <I18nProvider locale={uiState.locale}>
      <AppShell
        uiState={uiState}
        selection={selection}
        inspectionError={inspectionError}
        bookmarksVersion={bookmarksVersion}
        onState={setState}
        onSelection={setSelection}
        onError={setInspectionError}
        onRefreshSelection={refreshSelection}
        onSaved={() => {
          setBookmarksVersion((value) => value + 1);
          setState((state) => ({ ...state, activeTab: 'bookmarks' }));
        }}
      />
    </I18nProvider>
  );
}

function AppShell({
  uiState,
  selection,
  inspectionError,
  bookmarksVersion,
  onState,
  onSelection,
  onError,
  onRefreshSelection,
  onSaved,
}: {
  uiState: UIState;
  selection: SelectedElementInfo | null;
  inspectionError: ExtensionError | null;
  bookmarksVersion: number;
  onState: Dispatch<SetStateAction<UIState>>;
  onSelection: (selection: SelectedElementInfo) => void;
  onError: (error: ExtensionError | null) => void;
  onRefreshSelection: () => Promise<void>;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const selectTab = (activeTab: UIState['activeTab']) =>
    onState((state) => ({ ...state, activeTab }));
  const cycleTheme = () =>
    onState((state) => {
      const index = themeOrder.indexOf(state.theme);
      return { ...state, theme: themeOrder[(index + 1) % themeOrder.length] };
    });

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand" aria-label="UI Lens">
          <span className="brand__mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>UI Lens</strong>
          <small>{t('app.local')}</small>
        </div>
        <div className="header-actions">
          <Button
            variant="icon"
            className="language-button"
            aria-label={t('app.language')}
            title={t('app.language')}
            onClick={() =>
              onState((state) => ({ ...state, locale: state.locale === 'ja' ? 'en' : 'ja' }))
            }
          >
            {uiState.locale === 'ja' ? 'EN' : '日'}
          </Button>
          <Button
            variant="icon"
            aria-label={t('app.theme', { theme: uiState.theme })}
            title={t('app.theme', { theme: uiState.theme })}
            onClick={cycleTheme}
          >
            <ThemeIcon />
          </Button>
        </div>
      </header>
      <nav className="tab-bar" aria-label={t('app.nav')}>
        <button
          className={uiState.activeTab === 'inspect' ? 'is-active' : ''}
          aria-current={uiState.activeTab === 'inspect' ? 'page' : undefined}
          onClick={() => selectTab('inspect')}
        >
          <InspectIcon /> {t('app.inspect')}
        </button>
        <button
          className={uiState.activeTab === 'bookmarks' ? 'is-active' : ''}
          aria-current={uiState.activeTab === 'bookmarks' ? 'page' : undefined}
          onClick={() => selectTab('bookmarks')}
        >
          <BookmarkIcon /> {t('app.bookmarks')}
        </button>
      </nav>
      <main>
        {uiState.activeTab === 'inspect' ? (
          <InspectPage
            selection={selection}
            error={inspectionError}
            onSelection={onSelection}
            onError={onError}
            onPermissionGranted={onRefreshSelection}
            onSaved={onSaved}
          />
        ) : (
          <BookmarksPage refreshToken={bookmarksVersion} />
        )}
      </main>
    </div>
  );
}
