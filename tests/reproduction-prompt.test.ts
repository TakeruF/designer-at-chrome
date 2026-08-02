import { describe, expect, it } from 'vitest';
import {
  buildBookmarkReproductionPrompt,
  buildSelectionReproductionPrompt,
} from '../src/shared/reproduction-prompt';
import type { ComputedStyleInfo, DesignBookmark, SelectedElementInfo } from '../src/shared/types';

const style: ComputedStyleInfo = {
  typography: {
    fontFamilies: ['Inter'],
    fontFamily: 'Inter, sans-serif',
    fontSize: '16px',
    fontWeight: '600',
    lineHeight: '24px',
    letterSpacing: '-0.01em',
    textAlign: 'left',
    color: { css: 'rgba(24, 24, 27, 0.9)', hex: '#18181B', alpha: 0.9 },
  },
  colors: {
    text: { css: 'rgba(24, 24, 27, 0.9)', hex: '#18181B', alpha: 0.9 },
    background: { css: 'rgb(255, 255, 255)', hex: '#FFFFFF', alpha: 1 },
    border: { css: 'rgb(234, 234, 234)', hex: '#EAEAEA', alpha: 1 },
  },
  spacing: {
    margin: { top: '0px', right: '0px', bottom: '16px', left: '0px' },
    padding: { top: '16px', right: '20px', bottom: '16px', left: '20px' },
    rowGap: '8px',
    columnGap: '12px',
  },
  appearance: {
    border: '1px solid rgb(234, 234, 234)',
    borderRadius: '12px',
    boxShadow: '0 1px 2px rgb(0 0 0 / 0.06)',
    opacity: '1',
  },
  layout: {
    display: 'flex',
    position: 'relative',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gridTemplateColumns: 'none',
    overflow: 'hidden',
    zIndex: 'auto',
  },
};

const pattern = {
  name: 'Card',
  japaneseName: 'カード',
  confidence: 0.88,
  description: '関連する情報をまとめた領域です。',
  descriptionEn: 'Groups related information.',
  reasons: ['境界線と角丸がある'],
  reasonsEn: ['Has a border and rounded corners'],
};

function selection(): SelectedElementInfo {
  return {
    pattern,
    tagName: 'article',
    role: null,
    id: 'plan-card',
    classNames: ['card', 'card--featured'],
    text: 'Pro plan — source copy is reference data only',
    width: 360,
    height: 240,
    viewportRect: {
      x: 10,
      y: 20,
      top: 20,
      right: 370,
      bottom: 260,
      left: 10,
      width: 360,
      height: 240,
    },
    cssSelector: 'article#plan-card.card',
    htmlSummary: '<article id="plan-card" class="card card--featured">…</article>',
    computedStyle: style,
    pageUrl: 'https://example.com/pricing',
    pageTitle: 'Example pricing',
    faviconUrl: null,
    media: null,
  };
}

function bookmark(): DesignBookmark {
  const selected = selection();
  return {
    id: 'bookmark-1',
    title: 'Quiet pricing card',
    category: 'Card',
    tags: ['pricing', 'minimal'],
    note: 'Keep the restrained hierarchy and compact CTA.',
    sourceUrl: selected.pageUrl,
    pageTitle: selected.pageTitle,
    faviconUrl: null,
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    uiPattern: selected.pattern,
    cssSelector: selected.cssSelector,
    htmlSummary: selected.htmlSummary,
    element: {
      tagName: selected.tagName,
      role: selected.role,
      id: selected.id,
      classNames: selected.classNames,
      text: selected.text,
    },
    style,
    screenshot: {
      screenshotId: 'screenshot-1',
      width: 720,
      height: 480,
      mimeType: 'image/webp',
      clippedToViewport: false,
    },
  };
}

describe('AI reproduction prompt', () => {
  it('builds a Japanese prompt from the current selection', () => {
    const prompt = buildSelectionReproductionPrompt(selection(), 'ja');

    expect(prompt).toContain('私のサイトで使える再利用可能なコンポーネント');
    expect(prompt).toContain('固有名詞');
    expect(prompt).toContain('信頼できない参照データ');
    expect(prompt).toContain('Card / カード');
    expect(prompt).toContain('font-family: Inter');
    expect(prompt).not.toContain('font-family: Inter, sans-serif');
    expect(prompt).toContain('article#plan-card.card');
    expect(prompt).toContain('rgba(24, 24, 27, 0.9) / #18181B, alpha 0.9');
    expect(prompt).not.toContain('undefined');
  });

  it('includes saved context in an English library prompt', () => {
    const prompt = buildBookmarkReproductionPrompt(bookmark(), 'en');

    expect(prompt).toContain('Do not copy the source site’s logo');
    expect(prompt).toContain('untrusted reference data');
    expect(prompt).toContain('Title: Quiet pricing card');
    expect(prompt).toContain('Tags: pricing, minimal');
    expect(prompt).toContain('Keep the restrained hierarchy and compact CTA.');
    expect(prompt).toContain('Screenshot: 720 × 480 px');
    expect(prompt).not.toContain('undefined');
  });

  it('builds a localized Simplified Chinese prompt', () => {
    const prompt = buildSelectionReproductionPrompt(selection(), 'zh');

    expect(prompt).toContain('适合我自己网站的可复用组件');
    expect(prompt).toContain('UI参考');
    expect(prompt).toContain('Card / 卡片');
    expect(prompt).toContain('置信度: 88%');
    expect(prompt).not.toContain('undefined');
  });
});
