import { useState } from 'react';
import { formatMediaTime } from '../../shared/media-utils';
import type { BookmarkCategory, DesignBookmark } from '../../shared/types';
import { updateBookmark } from '../../storage/bookmark-storage';
import { useScreenshotUrl } from '../hooks/useScreenshotUrl';
import { ExternalIcon } from './Icons';
import { StyleSections } from './StyleSections';
import { Accordion, Button, Notice } from './UI';
import { captureModeLabel, categoryLabel, useI18n } from '../i18n';

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
  const { locale, t } = useI18n();
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
      setError(t('detail.titleRequired'));
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
      setError(caught instanceof Error ? caught.message : t('detail.updateError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page detail-page">
      <div className="detail-toolbar">
        <Button onClick={onBack}>← {t('detail.back')}</Button>
        <div>
          <Button
            variant="icon"
            aria-label={t('card.open')}
            title={t('card.open')}
            onClick={() => void chrome.tabs.create({ url: bookmark.sourceUrl })}
          >
            <ExternalIcon />
          </Button>
          <Button onClick={() => setEditing((value) => !value)}>
            {editing ? t('detail.cancelEdit') : t('card.edit')}
          </Button>
          <Button className="danger-button" onClick={onDelete}>
            {t('detail.delete')}
          </Button>
        </div>
      </div>

      <div className="detail-image">
        {image.url ? (
          <img src={image.url} alt={bookmark.title} />
        ) : (
          <div className="image-placeholder">
            {image.error ? t('card.unavailable') : t('card.loading')}
          </div>
        )}
      </div>
      {bookmark.screenshot.clippedToViewport ? <Notice>{t('detail.clipped')}</Notice> : null}

      {editing ? (
        <section className="bookmark-form detail-edit">
          <label className="field">
            <span>{t('field.title')}</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>{t('field.category')}</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as BookmarkCategory)}
              >
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {categoryLabel(item, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('field.tags')}</span>
              <input value={tags} onChange={(event) => setTags(event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>{t('field.memo')}</span>
            <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <div className="form-actions">
            <Button variant="primary" disabled={saving} onClick={() => void save()}>
              {saving ? t('detail.saving') : t('detail.save')}
            </Button>
          </div>
        </section>
      ) : (
        <section className="detail-summary">
          <div className="detail-summary__category">{categoryLabel(bookmark.category, locale)}</div>
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
          {bookmark.video ? (
            <div className="media-frame-info">
              <div>
                <span>{t('detail.capturedFrame')}</span>
                <strong>
                  {formatMediaTime(bookmark.video.currentTime)}
                  {bookmark.video.duration === null
                    ? ''
                    : ` / ${formatMediaTime(bookmark.video.duration)}`}
                </strong>
              </div>
              <div>
                <span>{t('detail.resolution')}</span>
                <strong>
                  {bookmark.video.videoWidth || '—'} × {bookmark.video.videoHeight || '—'}
                </strong>
              </div>
              <div>
                <span>{t('detail.displayedSize')}</span>
                <strong>
                  {Math.round(bookmark.video.displayedWidth)} ×{' '}
                  {Math.round(bookmark.video.displayedHeight)}
                </strong>
              </div>
              <div>
                <span>{t('detail.aspectRatio')}</span>
                <strong>{bookmark.video.aspectRatio?.toFixed(2) ?? '—'}</strong>
              </div>
              <div>
                <span>{t('detail.captureArea')}</span>
                <strong>{captureModeLabel(bookmark.video.captureMode, locale)}</strong>
              </div>
              <div>
                <span>{t('detail.controls')}</span>
                <strong>
                  {bookmark.video.controlsIncluded ? t('detail.included') : t('detail.notIncluded')}
                </strong>
              </div>
              <div>
                <span>{t('detail.playback')}</span>
                <strong>
                  {bookmark.video.paused ? t('inspect.paused') : t('inspect.playing')} ·{' '}
                  {bookmark.video.muted ? t('detail.muted') : t('detail.soundOn')}
                </strong>
              </div>
              <div>
                <span>{t('detail.subtitles')}</span>
                <strong>
                  {bookmark.video.subtitlesDetected
                    ? t('detail.detected')
                    : t('detail.notDetected')}
                </strong>
              </div>
              {bookmark.video.captureLimitation ? (
                <p className="media-frame-info__notice">{bookmark.video.captureLimitation}</p>
              ) : null}
            </div>
          ) : null}
          <div className="pattern-line">
            <div>
              <span>{t('detail.pattern')}</span>
              <strong>{bookmark.uiPattern.name}</strong>
              <small>{bookmark.uiPattern.japaneseName}</small>
            </div>
            <b>{Math.round(bookmark.uiPattern.confidence * 100)}%</b>
          </div>
        </section>
      )}

      <StyleSections style={bookmark.style} />
      <div className="section-stack section-stack--advanced">
        <div className="section-label">{t('detail.advanced')}</div>
        <Accordion title={t('detail.structure')} description={t('detail.structureHelp')}>
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
            <span>{t('structure.html')}</span>
            <code>{bookmark.htmlSummary}</code>
          </div>
        </Accordion>
      </div>
    </div>
  );
}
