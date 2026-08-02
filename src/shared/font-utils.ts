import type { TypographyStyle } from './types';

const MAX_SCANNED_ELEMENTS = 2000;

/** Splits a CSS font stack without breaking quoted family names containing commas. */
export function parseFontFamilyList(value: string): string[] {
  const families: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  const append = () => {
    const normalized = current
      .trim()
      .replace(/^("|')|("|')$/g, '')
      .trim();
    if (normalized) families.push(normalized);
    current = '';
  };

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      current += character;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      current += character;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === ',') append();
    else current += character;
  }
  append();
  return families;
}

function hasDirectText(element: Element): boolean {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return Boolean(element.value || element.getAttribute('placeholder'));
  }
  return [...element.childNodes].some(
    (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
  );
}

/**
 * Collects the preferred family of rendered text elements inside the selection.
 * Fallback entries are intentionally omitted because they are candidates, not a
 * list of fonts simultaneously used by the selected UI.
 */
export function collectFontFamilies(element: Element): string[] {
  const families: string[] = [];
  const seen = new Set<string>();
  const queue: Element[] = [element];
  let scanned = 0;

  while (queue.length > 0 && scanned < MAX_SCANNED_ELEMENTS) {
    const current = queue.shift();
    if (!current) break;
    scanned += 1;
    const style = getComputedStyle(current);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      Number.parseFloat(style.opacity) === 0
    ) {
      continue;
    }

    if (hasDirectText(current)) {
      const primary = parseFontFamilyList(style.fontFamily)[0];
      const key = primary?.toLocaleLowerCase();
      if (primary && key && !seen.has(key)) {
        seen.add(key);
        families.push(primary);
      }
    }

    queue.push(...current.children);
    if (current.shadowRoot) queue.push(...current.shadowRoot.children);
  }

  return families;
}

/** Keeps imported v0.1/v0.2 bookmarks readable without showing their full fallback stack. */
export function fontFamiliesForDisplay(typography: TypographyStyle): string[] {
  if (typography.fontFamilies && typography.fontFamilies.length > 0) {
    return typography.fontFamilies;
  }
  const primary = parseFontFamilyList(typography.fontFamily)[0];
  return primary ? [primary] : [];
}
