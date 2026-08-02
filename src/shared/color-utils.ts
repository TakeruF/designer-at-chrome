import type { ColorValue } from './types';

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clampByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
const clampAlpha = (value: number) => Math.max(0, Math.min(1, value));

function parseChannel(value: string): number {
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) return clampByte((Number.parseFloat(trimmed) / 100) * 255);
  return clampByte(Number.parseFloat(trimmed));
}

function parseAlpha(value: string | undefined): number {
  if (!value) return 1;
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) return clampAlpha(Number.parseFloat(trimmed) / 100);
  return clampAlpha(Number.parseFloat(trimmed));
}

function parseHex(value: string): RgbaColor | null {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length) || !/^[\da-f]+$/i.test(hex)) return null;
  const expanded = hex.length <= 4 ? [...hex].map((char) => char.repeat(2)).join('') : hex;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  };
}

export function parseCssColor(value: string): RgbaColor | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  if (normalized.startsWith('#')) return parseHex(normalized);

  const match = normalized.match(/^rgba?\((.*)\)$/);
  if (!match) return null;
  const inside = match[1];
  let channels: string[];
  let alpha: string | undefined;

  if (inside.includes(',')) {
    const parts = inside.split(',').map((part) => part.trim());
    channels = parts.slice(0, 3);
    alpha = parts[3];
  } else {
    const [channelPart, alphaPart] = inside.split('/').map((part) => part.trim());
    channels = channelPart.split(/\s+/);
    alpha = alphaPart;
  }

  if (channels.length !== 3 || channels.some((channel) => Number.isNaN(parseChannel(channel)))) {
    return null;
  }

  return {
    r: parseChannel(channels[0]),
    g: parseChannel(channels[1]),
    b: parseChannel(channels[2]),
    a: parseAlpha(alpha),
  };
}

export function rgbaToHex(value: string): string | null {
  const color = parseCssColor(value);
  if (!color) return null;
  const channel = (number: number) => clampByte(number).toString(16).padStart(2, '0').toUpperCase();
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

export function toColorValue(css: string): ColorValue {
  const parsed = parseCssColor(css);
  return {
    css,
    hex: parsed ? rgbaToHex(css) : null,
    alpha: parsed?.a ?? 1,
  };
}
