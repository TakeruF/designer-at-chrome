import { useState } from 'react';
import type { BookmarkCategory, DesignBookmark } from '../../shared/types';
import { updateBookmark } from '../../storage/bookmark-storage';
import { useScreenshotUrl } from '../hooks/useScreenshotUrl';
import { ExternalIcon } from './Icons';
import { StyleSections } from './StyleSections';
import { Accordion, Button, Notice } from './UI';

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

export function BookmarkDetail({
  bookmark,
  startEditing,
  onBack,
  onUpdated,
  onDelete,
}: {
  bookmark: DesignBookmark;
  startEditing: boolean;
  onBack: () => void;
  onUpdated: (bookmark: DesignBookmark) => void;
  onDelete: () => void;
}) {
  const image = useScreenshotUrl(bookmark.screenshot.screenshotId, 'full');
  const [editing, setEditing] = useState(startEditing);
  const [title, setTitle] = useState(bookmark.title);
  const [category, setCategory] = useState<BookmarkCategory>(bookmark.category);
  const [tags, setTags] = useState(bookmark.tags.join(', '));
  const [note, setNote] = useState(bookmark.note);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください。');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateBookmark(bookmark.id, {
        title: title.trim(),
        category,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        note: note.trim(),
      });
      onUpdated(updated);
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '更新できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page detail-page">
      <div className="detail-toolbar">
        <Button onClick={onBack}>← Back</Button>
        <div>
          <Button
            variant="icon"
            aria-label="元ページを新しいタブで開く"
            title="Open source page"
            onClick={() => void chrome.tabs.create({ url: bookmark.sourceUrl })}
          >
            <ExternalIcon />
          </Button>
          <Button onClick={() => setEditing((value) => !value)}>
            {editing ? 'Cancel edit' : 'Edit'}
          </Button>
          <Button className="danger-button" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      <div className="detail-image">
        {image.url ? (
          <img src={image.url} alt={`${bookmark.title}のスクリーンショット`} />
        ) : (
          <div className="image-placeholder">
            {image.error ? 'Image unavailable' : 'Loading full image…'}
          </div>
        )}
      </div>
      {bookmark.screenshot.clippedToViewport ? (
        <Notice>
          要素がviewport外にはみ出していたため、表示されていた範囲のみ保存されています。
        </Notice>
      ) : null}

      {editing ? (
        <section className="bookmark-form detail-edit">
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as BookmarkCategory)}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tags</span>
              <input value={tags} onChange={(event) => setTags(event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Memo</span>
            <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="form-actions">
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </section>
      ) : (
        <section className="detail-summary">
          <div className="detail-summary__category">{bookmark.category}</div>
          <h1>{bookmark.title}</h1>
          <a
            href={bookmark.sourceUrl}
            onClick={(event) => {
              event.preventDefault();
              void chrome.tabs.create({ url: bookmark.sourceUrl });
            }}
          >
            {bookmark.sourceUrl}
          </a>
          {bookmark.tags.length > 0 ? (
            <div className="tag-list">
              {bookmark.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          ) : null}
          {bookmark.note ? <p className="detail-note">{bookmark.note}</p> : null}
          <div className="pattern-line">
            <div>
              <span>Detected pattern</span>
              <strong>{bookmark.uiPattern.name}</strong>
              <small>{bookmark.uiPattern.japaneseName}</small>
            </div>
            <b>{Math.round(bookmark.uiPattern.confidence * 100)}%</b>
          </div>
        </section>
      )}

      <StyleSections style={bookmark.style} />
      <div className="section-stack section-stack--advanced">
        <div className="section-label">Advanced</div>
        <Accordion title="Structure" description="保存時のHTML情報">
          <dl className="definition-list">
            <div>
              <dt>HTML tag</dt>
              <dd>
                <code>&lt;{bookmark.element.tagName}&gt;</code>
              </dd>
            </div>
            <div>
              <dt>ARIA role</dt>
              <dd>
                <code>{bookmark.element.role ?? '—'}</code>
              </dd>
            </div>
            <div>
              <dt>CSS Selector</dt>
              <dd>
                <code>{bookmark.cssSelector}</code>
              </dd>
            </div>
          </dl>
          <div className="code-block">
            <span>HTML summary</span>
            <code>{bookmark.htmlSummary}</code>
          </div>
        </Accordion>
      </div>
    </div>
  );
}
