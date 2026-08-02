import { useMemo, useState } from 'react';
import { sendRuntimeMessage } from '../../shared/messages';
import type {
  BookmarkCategory,
  BookmarkDraft,
  CaptureStoredResult,
  DesignBookmark,
  SelectedElementInfo,
} from '../../shared/types';
import { addBookmark } from '../../storage/bookmark-storage';
import { deleteScreenshot } from '../../storage/screenshot-db';
import { Button, Notice } from './UI';

const categories: BookmarkCategory[] = [
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
];

function initialCategory(pattern: string): BookmarkCategory {
  if (/header/i.test(pattern)) return 'Header';
  if (/hero/i.test(pattern)) return 'Hero';
  if (/navigation|breadcrumb|tabs/i.test(pattern)) return 'Navigation';
  if (/button/i.test(pattern)) return 'Button';
  if (/card|list item/i.test(pattern)) return 'Card';
  if (/field|select|checkbox|radio|search|form/i.test(pattern)) return 'Form';
  if (/modal|dialog|drawer|sheet/i.test(pattern)) return 'Modal';
  if (/footer/i.test(pattern)) return 'Footer';
  return 'Other';
}

export function SaveBookmarkForm({
  selection,
  onCancel,
  onSaved,
}: {
  selection: SelectedElementInfo;
  onCancel: () => void;
  onSaved: (bookmark: DesignBookmark) => void;
}) {
  const domain = useMemo(() => {
    try {
      return new URL(selection.pageUrl).hostname;
    } catch {
      return selection.pageTitle;
    }
  }, [selection.pageTitle, selection.pageUrl]);
  const [draft, setDraft] = useState<BookmarkDraft>({
    title: `${selection.pattern.name} · ${domain}`,
    category: initialCategory(selection.pattern.name),
    tags: [],
    note: '',
  });
  const [tagText, setTagText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!draft.title.trim()) {
      setError('タイトルを入力してください。');
      return;
    }
    setSaving(true);
    setError(null);
    const id = crypto.randomUUID();
    try {
      const capture = await sendRuntimeMessage<CaptureStoredResult>({
        type: 'CAPTURE_AND_STORE',
        bookmarkId: id,
      });
      const now = new Date().toISOString();
      const bookmark: DesignBookmark = {
        id,
        title: draft.title.trim(),
        category: draft.category,
        tags: tagText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        note: draft.note.trim(),
        sourceUrl: selection.pageUrl,
        pageTitle: selection.pageTitle,
        faviconUrl: selection.faviconUrl,
        createdAt: now,
        updatedAt: now,
        uiPattern: selection.pattern,
        cssSelector: selection.cssSelector,
        htmlSummary: selection.htmlSummary,
        element: {
          tagName: selection.tagName,
          role: selection.role,
          id: selection.id,
          classNames: selection.classNames,
          text: selection.text,
        },
        style: selection.computedStyle,
        screenshot: {
          screenshotId: capture.screenshotId,
          width: capture.width,
          height: capture.height,
          mimeType: 'image/webp',
          clippedToViewport: capture.clippedToViewport,
        },
      };
      try {
        await addBookmark(bookmark);
      } catch (storageError) {
        await deleteScreenshot(id).catch(() => undefined);
        throw storageError;
      }
      onSaved(bookmark);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ブックマークを保存できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bookmark-form" aria-labelledby="save-bookmark-title">
      <div className="bookmark-form__head">
        <div>
          <div className="section-label">Local bookmark</div>
          <h2 id="save-bookmark-title">Save this design</h2>
        </div>
        <span>
          {selection.viewportRect.width} × {selection.viewportRect.height}
        </span>
      </div>
      <label className="field">
        <span>Title</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          autoFocus
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Category</span>
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value as BookmarkCategory })
            }
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tags</span>
          <input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="saas, clean"
          />
        </label>
      </div>
      <label className="field">
        <span>Memo</span>
        <textarea
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          placeholder="このデザインから学びたいこと"
          rows={3}
        />
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="form-actions">
        <Button onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={() => void save()} disabled={saving}>
          {saving ? 'Capturing…' : 'Save bookmark'}
        </Button>
      </div>
      <p className="privacy-note">Screenshot and metadata stay in this browser.</p>
    </section>
  );
}
