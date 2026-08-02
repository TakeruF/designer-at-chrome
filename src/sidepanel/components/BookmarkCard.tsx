import { formatMediaTime } from '../../shared/media-utils';
import { buildBookmarkReproductionPrompt } from '../../shared/reproduction-prompt';
import type { DesignBookmark } from '../../shared/types';
import { useScreenshotUrl } from '../hooks/useScreenshotUrl';
import { ExternalIcon, VideoIcon } from './Icons';
import { PromptCopyButton } from './PromptCopyButton';
import { Button } from './UI';
import { categoryLabel, useI18n } from '../i18n';

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function dateLabel(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

export function BookmarkCard({
  bookmark,
  onView,
  onEdit,
  onDelete,
}: {
  bookmark: DesignBookmark;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { locale, t } = useI18n();
  const screenshot = useScreenshotUrl(bookmark.screenshot.screenshotId, 'thumbnail');
  const reproductionPrompt = buildBookmarkReproductionPrompt(bookmark, locale);
  return (
    <article className="bookmark-card">
      <button
        className="bookmark-card__image"
        onClick={onView}
        aria-label={`${t('card.details')}: ${bookmark.title}`}
      >
        {screenshot.url ? (
          <img src={screenshot.url} alt={bookmark.title} />
        ) : (
          <div className="image-placeholder">
            {screenshot.error ? t('card.unavailable') : t('card.loading')}
          </div>
        )}
        {bookmark.screenshot.clippedToViewport ? (
          <span className="crop-label">{t('card.visible')}</span>
        ) : null}
        {bookmark.video ? (
          <span className="frame-label">
            <VideoIcon /> {t('card.video')} · {formatMediaTime(bookmark.video.currentTime)}
            {bookmark.video.duration === null
              ? ''
              : ` / ${formatMediaTime(bookmark.video.duration)}`}
          </span>
        ) : null}
      </button>
      <div className="bookmark-card__body">
        <div className="bookmark-card__meta">
          <span>{categoryLabel(bookmark.category, locale)}</span>
          <time dateTime={bookmark.createdAt}>
            {dateLabel(
              bookmark.createdAt,
              locale === 'ja' ? 'ja-JP' : locale === 'zh' ? 'zh-CN' : 'en-US',
            )}
          </time>
        </div>
        <button className="bookmark-card__title" onClick={onView}>
          {bookmark.title}
        </button>
        <div className="bookmark-card__domain">
          <span>{domain(bookmark.sourceUrl).slice(0, 1).toUpperCase()}</span>
          {domain(bookmark.sourceUrl)}
        </div>
        {bookmark.video?.captureLimitation ? (
          <div className="bookmark-card__warning" title={bookmark.video.captureLimitation}>
            {t('card.limitation')}
          </div>
        ) : null}
        {bookmark.tags.length > 0 ? (
          <div className="tag-list">
            {bookmark.tags.slice(0, 3).map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        ) : null}
        <div className="bookmark-card__actions">
          <Button onClick={onView}>{t('card.details')}</Button>
          <Button onClick={onEdit}>{t('card.edit')}</Button>
          <PromptCopyButton prompt={reproductionPrompt} short />
          <Button
            variant="icon"
            aria-label={t('card.open')}
            title={t('card.open')}
            onClick={() => void chrome.tabs.create({ url: bookmark.sourceUrl })}
          >
            <ExternalIcon />
          </Button>
          <Button
            variant="icon"
            className="danger-icon"
            aria-label={t('card.delete')}
            title={t('card.delete')}
            onClick={onDelete}
          >
            ×
          </Button>
        </div>
      </div>
    </article>
  );
}
