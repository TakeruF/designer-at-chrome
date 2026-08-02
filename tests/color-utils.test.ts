import { describe, expect, it } from 'vitest';
import { parseCssColor, rgbaToHex, toColorValue } from '../src/shared/color-utils';

describe('color utilities', () => {
  it('converts rgb values to uppercase hex', () => {
    expect(rgbaToHex('rgb(37, 99, 235)')).toBe('#2563EB');
  });

  it('converts rgba while preserving alpha separately', () => {
    expect(rgbaToHex('rgba(255, 0, 128, 0.35)')).toBe('#FF0080');
    expect(toColorValue('rgba(255, 0, 128, 0.35)')).toEqual({
      css: 'rgba(255, 0, 128, 0.35)',
      hex: '#FF0080',
      alpha: 0.35,
    });
  });

  it('supports modern space-separated syntax and percentages', () => {
    expect(parseCssColor('rgb(100% 50% 0% / 25%)')).toEqual({ r: 255, g: 128, b: 0, a: 0.25 });
  });

  it('represents transparent as zero alpha', () => {
    expect(toColorValue('transparent')).toEqual({ css: 'transparent', hex: '#000000', alpha: 0 });
  });
});
