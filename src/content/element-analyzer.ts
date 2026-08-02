import { extractComputedStyle } from '../shared/style-utils';
import type { SelectedElementInfo, ViewportRect } from '../shared/types';
import { detectUIPattern } from './pattern-detector';
import { generateCssSelector } from './selector-generator';

const rounded = (value: number) => Math.round(value * 100) / 100;

export function rectToViewportRect(rect: DOMRect): ViewportRect {
  return {
    x: rounded(rect.x),
    y: rounded(rect.y),
    top: rounded(rect.top),
    right: rounded(rect.right),
    bottom: rounded(rect.bottom),
    left: rounded(rect.left),
    width: rounded(rect.width),
    height: rounded(rect.height),
  };
}

function findFavicon(): string | null {
  const icon = document.querySelector<HTMLLinkElement>(
    'link[rel~="icon"], link[rel="shortcut icon"]',
  );
  return icon?.href ?? null;
}

export function analyzeElement(element: Element): SelectedElementInfo {
  const rect = element.getBoundingClientRect();
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  return {
    pattern: detectUIPattern(element),
    tagName: element.tagName.toLowerCase(),
    role: element.getAttribute('role'),
    id: element.id || null,
    classNames: [...element.classList],
    text,
    width: rounded(rect.width),
    height: rounded(rect.height),
    viewportRect: rectToViewportRect(rect),
    cssSelector: generateCssSelector(element),
    htmlSummary: element.outerHTML.replace(/\s+/g, ' ').slice(0, 1200),
    computedStyle: extractComputedStyle(element),
    pageUrl: location.href,
    pageTitle: document.title,
    faviconUrl: findFavicon(),
  };
}
