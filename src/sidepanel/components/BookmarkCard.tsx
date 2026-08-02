import { formatMediaTime } from '../../shared/media-utils';
import type { DesignBookmark } from '../../shared/types';
import { useScreenshotUrl } from '../hooks/useScreenshotUrl';
import { ExternalIcon, VideoIcon } from './Icons';
import { Button } from './UI';

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
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
  const screenshot = useScreenshotUrl(bookmark.screenshot.screenshotId, 'thumbnail');
  return (
    <article className="bookmark-card">
      <button
        className="bookmark-card__image"
        onClick={onView}
        aria-label={`${bookmark.title}の詳細を表示`}
      >
        {screenshot.url ? (
          <img src={screenshot.url} alt={`${bookmark.title}の保存画像`} />
        ) : (
          <div className="image-placeholder">
            {screenshot.error ? 'Image unavailable' : 'Loading image…'}
          </div>
        )}
        {bookmark.screenshot.clippedToViewport ? (
          <span className="crop-label">Visible area</span>
        ) : null}
        {bookmark.video ? (
          <span className="frame-label">
            <VideoIcon /> Video frame · {formatMediaTime(bookmark.video.currentTime)}
            {bookmark.video.duration === null
              ? ''
              : ` / ${formatMediaTime(bookmark.video.duration)}`}
          </span>
        ) : null}
      </button>
      <div className="bookmark-card__body">
        <div className="bookmark-card__meta">
          <span>{bookmark.category}</span>
          <time dateTime={bookmark.createdAt}>{dateLabel(bookmark.createdAt)}</time>
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
            Capture limitation
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
          <Button onClick={onView}>Details</Button>
          <Button onClick={onEdit}>Edit</Button>
          <Button
            variant="icon"
            aria-label="元ページを新しいタブで開く"
            title="Open source page"
            onClick={() => void chrome.tabs.create({ url: bookmark.sourceUrl })}
          >
            <ExternalIcon />
          </Button>
          <Button
            variant="icon"
            className="danger-icon"
            aria-label="ブックマークを削除"
            title="Delete bookmark"
            onClick={onDelete}
          >
            ×
          </Button>
        </div>
      </div>
    </article>
  );
}
