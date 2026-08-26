import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { ExtensionRuntimeError, isExtensionMessage, sendRuntimeMessage } from '../shared/messages';
import type { ExtensionError, SelectedElementInfo, UIState } from '../shared/types';
import { getUIState, localeFromLanguage, setUIState } from '../storage/bookmark-storage';
import { BookmarkIcon, InspectIcon, SettingsIcon } from './components/Icons';
import { Button } from './components/UI';
import { I18nProvider, useI18n } from './i18n';
import { InspectionRequestGate, inspectionActionForTabUpdate } from './inspection-context';
import { BookmarksPage } from './pages/BookmarksPage';
import { InspectPage } from './pages/InspectPage';
import { SettingsPage } from './pages/SettingsPage';

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
  const [inspectionContextRevision, setInspectionContextRevision] = useState(0);
  const [bookmarksVersion, setBookmarksVersion] = useState(0);
  const requestGate = useRef(new InspectionRequestGate());

  const resetInspectionContext = useCallback(() => {
    requestGate.current.invalidate();
    setSelection(null);
    setInspectionError(null);
    // Remount InspectPage so its local action errors cannot leak into another tab.
    setInspectionContextRevision((value) => value + 1);
  }, []);

  const refreshSelection = useCallback(async () => {
    const requestVersion = requestGate.current.begin();
    try {
      const current = await sendRuntimeMessage<SelectedElementInfo | null>({
        type: 'GET_SELECTION',
      });
      if (!requestGate.current.isCurrent(requestVersion)) return;
      setSelection(current);
      setInspectionError(null);
    } catch (caught) {
      if (!requestGate.current.isCurrent(requestVersion)) return;
      setSelection(null);
      setInspectionError(extensionError(caught));
    }
  }, []);

  const activateTabContext = useCallback(
    async (tabId: number) => {
      resetInspectionContext();
      const transitionVersion = requestGate.current.begin();
      try {
        await sendRuntimeMessage<void>({ type: 'CLEAR_SELECTION', tabId });
      } catch {
        // A newly activated tab may not have an inspector yet. The refresh
        // below will inject it or surface the appropriate restricted-page state.
      }
      if (!requestGate.current.isCurrent(transitionVersion)) return;
      await refreshSelection();
    },
    [refreshSelection, resetInspectionContext],
  );

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
    const messageListener = (message: unknown, sender: chrome.runtime.MessageSender) => {
      if (
        isExtensionMessage(message) &&
        message.type === 'ELEMENT_SELECTED' &&
        sender.tab?.active !== false
      ) {
        requestGate.current.invalidate();
        setSelection(message.payload);
        setInspectionError(null);
      }
    };
    const tabActivatedListener = ({ tabId }: chrome.tabs.OnActivatedInfo) =>
      void activateTabContext(tabId);
    const tabUpdatedListener = (
      _tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      tab: chrome.tabs.Tab,
    ) => {
      const action = inspectionActionForTabUpdate(changeInfo, Boolean(tab.active));
      if (action === 'reset') resetInspectionContext();
      if (action === 'refresh') void refreshSelection();
    };
    chrome.runtime.onMessage.addListener(messageListener);
    chrome.tabs.onActivated.addListener(tabActivatedListener);
    chrome.tabs.onUpdated.addListener(tabUpdatedListener);
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.tabs.onActivated.removeListener(tabActivatedListener);
      chrome.tabs.onUpdated.removeListener(tabUpdatedListener);
    };
  }, [activateTabContext, refreshSelection, resetInspectionContext]);

  useEffect(() => {
    if (uiState.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = uiState.theme;
    document.documentElement.lang = uiState.locale === 'zh' ? 'zh-CN' : uiState.locale;
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
        inspectionContextRevision={inspectionContextRevision}
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
  inspectionContextRevision,
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
  inspectionContextRevision: number;
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
            className={uiState.activeTab === 'settings' ? 'is-active' : ''}
            aria-label={t('app.settings')}
            title={t('app.settings')}
            aria-pressed={uiState.activeTab === 'settings'}
            onClick={() => selectTab('settings')}
          >
            <SettingsIcon />
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
            key={inspectionContextRevision}
            selection={selection}
            error={inspectionError}
            onSelection={onSelection}
            onError={onError}
            onPermissionGranted={onRefreshSelection}
            onSaved={onSaved}
          />
        ) : uiState.activeTab === 'bookmarks' ? (
          <BookmarksPage refreshToken={bookmarksVersion} />
        ) : (
          <SettingsPage
            locale={uiState.locale}
            theme={uiState.theme}
            onLocale={(locale) => onState((state) => ({ ...state, locale }))}
            onTheme={(theme) => onState((state) => ({ ...state, theme }))}
          />
        )}
      </main>
    </div>
  );
}
