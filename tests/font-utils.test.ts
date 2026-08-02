import { beforeEach, describe, expect, it } from 'vitest';
import {
  collectFontFamilies,
  fontFamiliesForDisplay,
  parseFontFamilyList,
} from '../src/shared/font-utils';

describe('font family extraction', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('parses quoted family names without exposing the full stack as one font', () => {
    expect(parseFontFamilyList('"Noto Sans, JP", Inter, sans-serif')).toEqual([
      'Noto Sans, JP',
      'Inter',
      'sans-serif',
    ]);
  });

  it('collects only primary fonts on visible text inside the selected element', () => {
    document.body.innerHTML = `
      <div style="font-family: Outside, sans-serif">Outside selection</div>
      <section id="selected">
        <h2 style="font-family: Inter, Arial, sans-serif">Heading</h2>
        <p style="font-family: Merriweather, Georgia, serif">Body copy</p>
        <span style="font-family: Inter, Arial, sans-serif">Duplicate</span>
        <div style="display: none"><span style="font-family: Hidden">Hidden text</span></div>
      </section>
    `;
    const selected = document.querySelector('#selected');
    if (!selected) throw new Error('Test selection was not created.');

    expect(collectFontFamilies(selected)).toEqual(['Inter', 'Merriweather']);
  });

  it('uses only the primary family when reading older bookmarks', () => {
    expect(
      fontFamiliesForDisplay({
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: '16px',
        fontWeight: '400',
        lineHeight: '24px',
        letterSpacing: 'normal',
        textAlign: 'start',
        color: { css: 'rgb(0, 0, 0)', hex: '#000000', alpha: 1 },
      }),
    ).toEqual(['Inter']);
  });
});
