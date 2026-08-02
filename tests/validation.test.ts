import { describe, expect, it } from 'vitest';
import type { DesignBookmark } from '../src/shared/types';
import {
  resolveImportedBookmarks,
  validateBookmarkData,
  validateImportArchive,
} from '../src/storage/validation';

function validBookmark(id = 'bookmark-1'): DesignBookmark {
  const color = { css: 'rgb(0, 0, 0)', hex: '#000000', alpha: 1 };
  return {
    id,
    title: 'Quiet card',
    category: 'Card',
    tags: ['minimal'],
    note: 'Good spacing',
    sourceUrl: 'https://example.com',
    pageTitle: 'Example',
    faviconUrl: null,
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    uiPattern: {
      name: 'Card',
      japaneseName: 'カード',
      confidence: 0.88,
      description: 'Grouped content.',
      reasons: ['card class'],
    },
    cssSelector: '.card',
    htmlSummary: '<article class="card">',
    element: { tagName: 'article', role: null, id: null, classNames: ['card'], text: 'Text' },
    style: {
      typography: {
        fontFamily: 'system-ui',
        fontSize: '14px',
        fontWeight: '400',
        lineHeight: '20px',
        letterSpacing: 'normal',
        textAlign: 'start',
        color,
      },
      colors: { text: color, background: color, border: color },
      spacing: {
        margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
        padding: { top: '16px', right: '16px', bottom: '16px', left: '16px' },
        rowGap: '8px',
        columnGap: '8px',
      },
      appearance: { border: '1px solid', borderRadius: '8px', boxShadow: 'none', opacity: '1' },
      layout: {
        display: 'flex',
        position: 'static',
        flexDirection: 'column',
        justifyContent: 'normal',
        alignItems: 'normal',
        gridTemplateColumns: 'none',
        overflow: 'visible',
        zIndex: 'auto',
      },
    },
    screenshot: {
      screenshotId: id,
      width: 800,
      height: 500,
      mimeType: 'image/webp',
      clippedToViewport: false,
    },
  };
}

describe('bookmark validation', () => {
  it('accepts a complete bookmark', () => {
    expect(validateBookmarkData(validBookmark()).ok).toBe(true);
  });

  it('rejects invalid category and screenshot data safely', () => {
    const invalid = {
      ...validBookmark(),
      category: 'Anything',
      screenshot: { mimeType: 'image/png' },
    };
    const result = validateBookmarkData(invalid);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('category');
  });

  it('rejects an archive with one invalid bookmark', () => {
    const result = validateImportArchive({
      version: 1,
      exportedAt: '2026-08-02T00:00:00.000Z',
      bookmarks: [validBookmark(), { id: 3 }],
    });
    expect(result.ok).toBe(false);
  });

  it('validates captured video frame metadata', () => {
    const bookmark = {
      ...validBookmark(),
      video: {
        containsVideo: true,
        videoCount: 1,
        currentTime: 42.5,
        duration: 120,
        paused: true,
        muted: false,
        videoWidth: 1920,
        videoHeight: 1080,
        displayedWidth: 960,
        displayedHeight: 540,
        aspectRatio: 16 / 9,
        nativeControls: true,
        subtitlesDetected: true,
        captureMode: 'current-frame',
        controlsIncluded: false,
        captureLimitation: null,
      },
    };
    expect(validateBookmarkData(bookmark).ok).toBe(true);
    expect(
      validateBookmarkData({ ...bookmark, video: { ...bookmark.video, currentTime: -1 } }).ok,
    ).toBe(false);
  });
});

describe('import id collision handling', () => {
  it('keeps free ids and remaps collisions, including collisions within the import', () => {
    const generated = ['new-1', 'new-2'];
    const result = resolveImportedBookmarks(
      [validBookmark('existing'), validBookmark('free'), validBookmark('free')],
      new Set(['existing']),
      () => generated.shift() ?? 'fallback',
    );
    expect(result.bookmarks.map((bookmark) => bookmark.id)).toEqual(['new-1', 'free', 'new-2']);
    expect(result.bookmarks.map((bookmark) => bookmark.screenshot.screenshotId)).toEqual([
      'new-1',
      'free',
      'new-2',
    ]);
    expect(result.sourceIds).toEqual(['existing', 'free', 'free']);
  });
});
