import { describe, expect, it } from 'vitest';
import { formatMediaTime } from '../src/shared/media-utils';

describe('media time formatter', () => {
  it('formats short and hour-long timestamps', () => {
    expect(formatMediaTime(42.9)).toBe('00:42');
    expect(formatMediaTime(84)).toBe('01:24');
    expect(formatMediaTime(7545)).toBe('2:05:45');
  });

  it('handles invalid timestamps safely', () => {
    expect(formatMediaTime(Number.NaN)).toBe('00:00');
    expect(formatMediaTime(-1)).toBe('00:00');
  });
});
