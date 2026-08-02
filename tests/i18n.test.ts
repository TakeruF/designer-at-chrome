import { describe, expect, it } from 'vitest';
import { localeFromLanguage } from '../src/storage/bookmark-storage';
import { hostPatternForUrl } from '../src/sidepanel/host-permissions';
import { translate } from '../src/sidepanel/i18n';

describe('locale selection', () => {
  it('selects Japanese only for Japanese browser locales', () => {
    expect(localeFromLanguage('ja-JP')).toBe('ja');
    expect(localeFromLanguage('en-US')).toBe('en');
    expect(localeFromLanguage('fr')).toBe('en');
  });
});

describe('side-panel translations', () => {
  it('translates and interpolates values', () => {
    expect(translate('ja', 'library.count', { count: 3 })).toBe('3件の保存済みデザイン');
    expect(translate('en', 'library.count', { count: 3 })).toBe('3 saved designs');
  });
});

describe('optional host permissions', () => {
  it('limits access to the current HTTP(S) origin', () => {
    expect(hostPatternForUrl('https://github.com/example/repo?tab=readme')).toBe(
      'https://github.com/*',
    );
    expect(hostPatternForUrl('http://localhost:5173/page')).toBe('http://localhost:5173/*');
  });

  it('rejects restricted and malformed URLs', () => {
    expect(hostPatternForUrl('chrome://extensions')).toBeNull();
    expect(hostPatternForUrl('not a url')).toBeNull();
  });
});
