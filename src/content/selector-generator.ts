function escapeIdentifier(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/(^-?\d)|[^a-zA-Z0-9_-]/g, (match) => `\\${match}`);
}

function queryRoot(element: Element): Document | ShadowRoot {
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root : element.ownerDocument;
}

function isUnique(element: Element, selector: string): boolean {
  try {
    const matches = queryRoot(element).querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}

function segmentFor(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (element.id) {
    const idSelector = `#${escapeIdentifier(element.id)}`;
    if (isUnique(element, idSelector)) return idSelector;
  }

  const classes = [...element.classList]
    .filter((name) => name.length < 64 && !/^css-[\da-z]+$/i.test(name))
    .slice(0, 3)
    .map((name) => `.${escapeIdentifier(name)}`)
    .join('');
  const candidate = `${tag}${classes}`;
  if (classes && isUnique(element, candidate)) return candidate;

  const siblings = element.parentElement
    ? [...element.parentElement.children].filter((child) => child.tagName === element.tagName)
    : [];
  const suffix = siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(element) + 1})` : '';
  return `${candidate}${suffix}`;
}

function selectorWithinRoot(element: Element): string {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current) {
    const segment = segmentFor(current);
    segments.unshift(segment);
    const candidate = segments.join(' > ');
    if (isUnique(element, candidate) || segment.startsWith('#')) return candidate;
    current = current.parentElement;
  }
  return segments.join(' > ');
}

export function generateCssSelector(element: Element): string {
  const inner = selectorWithinRoot(element);
  const root = element.getRootNode();
  if (root instanceof ShadowRoot) {
    return `${generateCssSelector(root.host)} >>> ${inner}`;
  }
  return inner;
}
