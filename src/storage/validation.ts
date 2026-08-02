import type {
  BookmarkCategory,
  ColorValue,
  ComputedStyleInfo,
  DesignBookmark,
  UIPatternResult,
} from '../shared/types';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const categories = new Set<BookmarkCategory>([
  'Header',
  'Hero',
  'Navigation',
  'Button',
  'Card',
  'Form',
  'Modal',
  'Footer',
  'Typography',
  'Other',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasString = (record: Record<string, unknown>, key: string) => typeof record[key] === 'string';

const hasNullableString = (record: Record<string, unknown>, key: string) =>
  record[key] === null || typeof record[key] === 'string';

function hasStringFields(record: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => hasString(record, field));
}

function isPattern(value: unknown): value is UIPatternResult {
  return (
    isRecord(value) &&
    hasString(value, 'name') &&
    hasString(value, 'japaneseName') &&
    hasString(value, 'description') &&
    typeof value.confidence === 'number' &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    Array.isArray(value.reasons) &&
    value.reasons.every((reason) => typeof reason === 'string')
  );
}

function isColor(value: unknown): value is ColorValue {
  return (
    isRecord(value) &&
    hasString(value, 'css') &&
    (value.hex === null || typeof value.hex === 'string') &&
    typeof value.alpha === 'number'
  );
}

function isStyle(value: unknown): value is ComputedStyleInfo {
  if (!isRecord(value)) return false;
  const { typography, colors, spacing, appearance, layout } = value;
  return (
    isRecord(typography) &&
    hasStringFields(typography, [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
      'textAlign',
    ]) &&
    isColor(typography.color) &&
    isRecord(colors) &&
    isColor(colors.text) &&
    isColor(colors.background) &&
    isColor(colors.border) &&
    isRecord(spacing) &&
    isRecord(spacing.margin) &&
    isRecord(spacing.padding) &&
    hasStringFields(spacing.margin, ['top', 'right', 'bottom', 'left']) &&
    hasStringFields(spacing.padding, ['top', 'right', 'bottom', 'left']) &&
    hasStringFields(spacing, ['rowGap', 'columnGap']) &&
    isRecord(appearance) &&
    hasStringFields(appearance, ['border', 'borderRadius', 'boxShadow', 'opacity']) &&
    isRecord(layout) &&
    hasStringFields(layout, [
      'display',
      'position',
      'flexDirection',
      'justifyContent',
      'alignItems',
      'gridTemplateColumns',
      'overflow',
      'zIndex',
    ])
  );
}

export function validateBookmarkData(value: unknown): ValidationResult<DesignBookmark> {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['Bookmark must be an object.'] };

  for (const key of [
    'id',
    'title',
    'sourceUrl',
    'pageTitle',
    'createdAt',
    'updatedAt',
    'cssSelector',
    'htmlSummary',
    'note',
  ]) {
    if (!hasString(value, key)) errors.push(`${key} must be a string.`);
  }
  if (!categories.has(value.category as BookmarkCategory)) errors.push('category is invalid.');
  if (!Array.isArray(value.tags) || !value.tags.every((tag) => typeof tag === 'string')) {
    errors.push('tags must be a string array.');
  }
  if (value.faviconUrl !== null && typeof value.faviconUrl !== 'string') {
    errors.push('faviconUrl must be a string or null.');
  }
  if (!isPattern(value.uiPattern)) errors.push('uiPattern is invalid.');
  if (!isStyle(value.style)) errors.push('style is invalid.');
  if (
    !isRecord(value.element) ||
    !hasStringFields(value.element, ['tagName', 'text']) ||
    !hasNullableString(value.element, 'role') ||
    !hasNullableString(value.element, 'id') ||
    !Array.isArray(value.element.classNames) ||
    !value.element.classNames.every((className) => typeof className === 'string')
  ) {
    errors.push('element is invalid.');
  }
  if (
    !isRecord(value.screenshot) ||
    !hasString(value.screenshot, 'screenshotId') ||
    typeof value.screenshot.width !== 'number' ||
    !Number.isFinite(value.screenshot.width) ||
    value.screenshot.width <= 0 ||
    typeof value.screenshot.height !== 'number' ||
    !Number.isFinite(value.screenshot.height) ||
    value.screenshot.height <= 0 ||
    value.screenshot.mimeType !== 'image/webp' ||
    typeof value.screenshot.clippedToViewport !== 'boolean'
  ) {
    errors.push('screenshot is invalid.');
  }
  if (typeof value.sourceUrl === 'string') {
    try {
      const url = new URL(value.sourceUrl);
      if (!['http:', 'https:', 'file:'].includes(url.protocol))
        errors.push('sourceUrl protocol is not allowed.');
    } catch {
      errors.push('sourceUrl is invalid.');
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: value as unknown as DesignBookmark };
}

export interface ImportArchiveData {
  version: 1;
  exportedAt: string;
  bookmarks: DesignBookmark[];
}

export function validateImportArchive(value: unknown): ValidationResult<ImportArchiveData> {
  if (!isRecord(value) || value.version !== 1 || typeof value.exportedAt !== 'string') {
    return { ok: false, errors: ['Unsupported or malformed archive metadata.'] };
  }
  if (!Array.isArray(value.bookmarks)) {
    return { ok: false, errors: ['bookmarks must be an array.'] };
  }
  const bookmarks: DesignBookmark[] = [];
  const errors: string[] = [];
  value.bookmarks.forEach((bookmark, index) => {
    const result = validateBookmarkData(bookmark);
    if (result.ok) bookmarks.push(result.value);
    else errors.push(...result.errors.map((error) => `bookmarks[${index}]: ${error}`));
  });
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: { version: 1, exportedAt: value.exportedAt, bookmarks } };
}

export function resolveImportedBookmarks(
  bookmarks: DesignBookmark[],
  existingIds: ReadonlySet<string>,
  createId: () => string = () => crypto.randomUUID(),
): { bookmarks: DesignBookmark[]; sourceIds: string[] } {
  const reserved = new Set(existingIds);
  const sourceIds: string[] = [];
  const resolved = bookmarks.map((bookmark) => {
    sourceIds.push(bookmark.id);
    let id = bookmark.id;
    if (reserved.has(id)) {
      do id = createId();
      while (reserved.has(id));
    }
    reserved.add(id);
    return {
      ...bookmark,
      id,
      screenshot: { ...bookmark.screenshot, screenshotId: id },
    };
  });
  return { bookmarks: resolved, sourceIds };
}
