import { describe, expect, it } from 'vitest';
import { explainProperty } from '../src/shared/glossary';
import { localeFromLanguage } from '../src/storage/bookmark-storage';
import { hostPatternForUrl, isCapturePermissionError } from '../src/sidepanel/host-permissions';
import { categoryLabel, translate } from '../src/sidepanel/i18n';

describe('locale selection', () => {
  it('selects Japanese and Chinese from browser locales and falls back to English', () => {
    expect(localeFromLanguage('ja-JP')).toBe('ja');
    expect(localeFromLanguage('zh-CN')).toBe('zh');
    expect(localeFromLanguage('zh-TW')).toBe('zh');
    expect(localeFromLanguage('en-US')).toBe('en');
    expect(localeFromLanguage('fr')).toBe('en');
  });
});

describe('side-panel translations', () => {
  it('translates and interpolates values', () => {
    expect(translate('ja', 'library.count', { count: 3 })).toBe('3件の保存済みデザイン');
    expect(translate('en', 'library.count', { count: 3 })).toBe('3 saved designs');
    expect(translate('zh', 'library.count', { count: 3 })).toBe('已保存3个设计');
    expect(translate('zh', 'settings.theme.dark')).toBe('深色');
    expect(categoryLabel('Card', 'zh')).toBe('卡片');
    expect(explainProperty('display', 'flex', 'zh')).toBe('子元素使用Flexbox排列。');
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

  it('recognizes Chrome capture permission failures without hiding unrelated errors', () => {
    expect(
      isCapturePermissionError(
        new Error("Either the '<all_urls>' or 'activeTab' permission is required."),
      ),
    ).toBe(true);
    expect(isCapturePermissionError(new Error('Canvas failed.'))).toBe(false);
  });
});
