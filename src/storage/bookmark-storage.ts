import type { DesignBookmark, SupportedLocale, ThemePreference, UIState } from '../shared/types';
import { validateBookmarkData } from './validation';

const BOOKMARKS_KEY = 'uiLens.bookmarks.v1';
const UI_STATE_KEY = 'uiLens.uiState.v1';

export function localeFromLanguage(language: string): SupportedLocale {
  const normalized = language.toLowerCase();
  if (normalized.startsWith('ja')) return 'ja';
  if (normalized.startsWith('zh')) return 'zh';
  return 'en';
}

function defaultUIState(): UIState {
  return {
    activeTab: 'inspect',
    theme: 'system',
    locale: localeFromLanguage(chrome.i18n.getUILanguage()),
  };
}

export async function getBookmarks(): Promise<DesignBookmark[]> {
  const result = await chrome.storage.local.get(BOOKMARKS_KEY);
  const raw: unknown = result[BOOKMARKS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const validated = validateBookmarkData(item);
    return validated.ok ? [validated.value] : [];
  });
}

export async function setBookmarks(bookmarks: DesignBookmark[]): Promise<void> {
  await chrome.storage.local.set({ [BOOKMARKS_KEY]: bookmarks });
}

export async function addBookmark(bookmark: DesignBookmark): Promise<void> {
  const bookmarks = await getBookmarks();
  await setBookmarks([bookmark, ...bookmarks.filter((item) => item.id !== bookmark.id)]);
}

export async function updateBookmark(
  id: string,
  patch: Pick<DesignBookmark, 'title' | 'category' | 'tags' | 'note'>,
): Promise<DesignBookmark> {
  const bookmarks = await getBookmarks();
  const index = bookmarks.findIndex((bookmark) => bookmark.id === id);
  if (index < 0) throw new Error('更新するブックマークが見つかりません。');
  const updated: DesignBookmark = {
    ...bookmarks[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  bookmarks[index] = updated;
  await setBookmarks(bookmarks);
  return updated;
}

export async function removeBookmark(id: string): Promise<void> {
  const bookmarks = await getBookmarks();
  await setBookmarks(bookmarks.filter((bookmark) => bookmark.id !== id));
}

export async function getUIState(): Promise<UIState> {
  const result = await chrome.storage.local.get(UI_STATE_KEY);
  const raw: unknown = result[UI_STATE_KEY];
  if (!raw || typeof raw !== 'object') return defaultUIState();
  const value = raw as Partial<UIState>;
  const activeTab =
    value.activeTab === 'bookmarks' || value.activeTab === 'settings' ? value.activeTab : 'inspect';
  const themes: ThemePreference[] = ['system', 'light', 'dark'];
  const theme = themes.includes(value.theme as ThemePreference)
    ? (value.theme as ThemePreference)
    : 'system';
  const locale: SupportedLocale =
    value.locale === 'ja' || value.locale === 'en' || value.locale === 'zh'
      ? value.locale
      : defaultUIState().locale;
  return { activeTab, theme, locale };
}

export async function setUIState(state: UIState): Promise<void> {
  await chrome.storage.local.set({ [UI_STATE_KEY]: state });
}
