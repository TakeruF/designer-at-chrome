import { describe, expect, it } from 'vitest';
import { detectPatternFromFeatures, type PatternFeatures } from '../src/content/pattern-detector';

const base: PatternFeatures = {
  tag: 'div',
  role: '',
  type: '',
  classText: '',
  ariaLabel: '',
  ariaHasPopup: false,
  text: '',
  top: 300,
  left: 100,
  width: 200,
  height: 50,
  viewportWidth: 1200,
  viewportHeight: 800,
  linkCount: 0,
  buttonCount: 0,
  headingCount: 0,
  imageCount: 0,
  inputCount: 0,
  hasLogoLikeImage: false,
  hasIconChild: false,
  hasFilledBackground: false,
  display: 'block',
  position: 'static',
  flexDirection: 'row',
  borderRadius: 0,
  hasBorder: false,
  hasShadow: false,
};

describe('rule-based UI pattern detector', () => {
  it('recognizes a semantic header with high confidence', () => {
    const result = detectPatternFromFeatures({ ...base, tag: 'header', top: 0, width: 1200 });
    expect(result.name).toBe('Header');
    expect(result.confidence).toBeGreaterThanOrEqual(0.95);
    expect(result.reasons[0]).toContain('header');
  });

  it('recognizes icon-only buttons', () => {
    const result = detectPatternFromFeatures({
      ...base,
      tag: 'button',
      hasIconChild: true,
      ariaLabel: 'Close',
    });
    expect(result.name).toBe('Icon Button');
  });

  it('recognizes a visually emphasized filled button as primary', () => {
    const result = detectPatternFromFeatures({
      ...base,
      tag: 'button',
      text: 'Continue',
      hasFilledBackground: true,
    });
    expect(result.name).toBe('Primary Button');
  });

  it('recognizes a video as a recordable frame', () => {
    const result = detectPatternFromFeatures({
      ...base,
      tag: 'video',
      width: 960,
      height: 540,
    });
    expect(result.name).toBe('Video Frame');
    expect(result.japaneseName).toBe('動画フレーム');
    expect(result.confidence).toBe(0.99);
  });

  it('recognizes a hero from structure and viewport position', () => {
    const result = detectPatternFromFeatures({
      ...base,
      tag: 'section',
      classText: 'homepage-hero',
      top: 60,
      width: 1100,
      height: 420,
      headingCount: 1,
      buttonCount: 2,
    });
    expect(result.name).toBe('Hero Section');
    expect(result.reasons).toContain('主要操作らしいボタンを含む');
  });

  it('falls back to an unknown element with low confidence', () => {
    const result = detectPatternFromFeatures(base);
    expect(result.name).toBe('Unknown Element');
    expect(result.confidence).toBeLessThan(0.5);
  });
});
