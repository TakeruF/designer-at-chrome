import { describe, expect, it } from 'vitest';
import { analyzeProtectedFramePixels } from '../src/background/protected-content';

function pixels(
  colors: ReadonlyArray<readonly [number, number, number, number]>,
): Uint8ClampedArray {
  return new Uint8ClampedArray(colors.flat());
}

describe('protected video frame analysis', () => {
  it('flags a mostly black or transparent video region', () => {
    const mostlyBlack = Array.from({ length: 90 }, () => [0, 0, 0, 255] as const);
    const visible = Array.from({ length: 10 }, () => [180, 120, 80, 255] as const);
    const result = analyzeProtectedFramePixels(pixels([...mostlyBlack, ...visible]));
    expect(result.suspected).toBe(true);
    expect(result.darkOrTransparentRatio).toBeCloseTo(0.9);
  });

  it('does not flag a normally exposed frame', () => {
    const result = analyzeProtectedFramePixels(
      pixels(Array.from({ length: 20 }, (_, index) => [40 + index, 90, 160, 255])),
    );
    expect(result.suspected).toBe(false);
  });

  it('flags a transparent hardware-overlay-like region', () => {
    const result = analyzeProtectedFramePixels(
      pixels(Array.from({ length: 20 }, () => [255, 255, 255, 0])),
    );
    expect(result.suspected).toBe(true);
  });
});
