import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookmarkCategory, DesignBookmark } from '../../shared/types';
import { addBookmark, getBookmarks, removeBookmark } from '../../storage/bookmark-storage';
import { createExportZip, importFromZip } from '../../storage/export-import';
import { deleteScreenshot } from '../../storage/screenshot-db';
import { BookmarkCard } from '../components/BookmarkCard';
import { BookmarkDetail } from '../components/BookmarkDetail';
import { SearchIcon } from '../components/Icons';
import { Button, EmptyState, Notice } from '../components/UI';
import { categoryLabel, useI18n } from '../i18n';

type SortOrder = 'newest' | 'oldest';
type CategoryFilter = BookmarkCategory | 'All';

const filterCategories: CategoryFilter[] = [
  'All',
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

function searchableText(bookmark: DesignBookmark): string {
  let domain = '';
  try {
    domain = new URL(bookmark.sourceUrl).hostname;
  } catch {
    domain = bookmark.sourceUrl;
  }
  return [bookmark.title, bookmark.tags.join(' '), bookmark.note, domain]
    .join(' ')
    .toLocaleLowerCase();
}

export function BookmarksPage({ refreshToken = 0 }: { refreshToken?: number }) {
  const { locale, t } = useI18n();
  const [bookmarks, setBookmarks] = useState<DesignBookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const [sort, setSort] = useState<SortOrder>('newest');
  const [selected, setSelected] = useState<DesignBookmark | null>(null);
  const [startEditing, setStartEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DesignBookmark | null>(null);
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getBookmarks()
      .then((items) => {
        if (active) setBookmarks(items);
      })
      .catch((caught: unknown) => {
        if (active)
          setStatus({
            tone: 'error',
            text: caught instanceof Error ? caught.message : t('library.loadError'),
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshToken, t]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return bookmarks
      .filter((bookmark) => category === 'All' || bookmark.category === category)
      .filter((bookmark) => !normalized || searchableText(bookmark).includes(normalized))
      .toSorted((a, b) =>
        sort === 'newest'
          ? b.createdAt.localeCompare(a.createdAt)
          : a.createdAt.localeCompare(b.createdAt),
      );
  }, [bookmarks, category, query, sort]);

  const exportAll = async () => {
    setStatus(null);
    try {
      const blob = await createExportZip();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ui-lens-bookmarks-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ tone: 'success', text: t('library.exported', { count: bookmarks.length }) });
    } catch (caught) {
      setStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : t('library.exportError'),
      });
    }
  };

  const importFile = async (file: File) => {
    setStatus(null);
    try {
      const result = await importFromZip(file);
      setBookmarks(await getBookmarks());
      setStatus({
        tone: 'success',
        text: `${t('library.imported', { count: result.imported })}${result.skipped ? t('library.importedSkipped', { count: result.skipped }) : ''}`,
      });
    } catch (caught) {
      setStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : t('library.importError'),
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setStatus(null);
    try {
      await removeBookmark(deleteTarget.id);
      try {
        await deleteScreenshot(deleteTarget.screenshot.screenshotId);
      } catch (imageError) {
        await addBookmark(deleteTarget);
        throw imageError;
      }
      setBookmarks((items) => items.filter((item) => item.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      setStatus({ tone: 'success', text: t('library.deleted') });
    } catch (caught) {
      setStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : t('library.deleteError'),
      });
    }
  };

  if (selected) {
    return (
      <>
        <BookmarkDetail
          key={`${selected.id}-${startEditing ? 'edit' : 'view'}`}
          bookmark={selected}
          startEditing={startEditing}
          onBack={() => setSelected(null)}
          onUpdated={(updated) => {
            setBookmarks((items) => items.map((item) => (item.id === updated.id ? updated : item)));
            setSelected(updated);
          }}
          onDelete={() => setDeleteTarget(selected)}
        />
        {deleteTarget ? (
          <ConfirmDelete
            bookmark={deleteTarget}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => void confirmDelete()}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="page bookmarks-page">
      <div className="bookmarks-heading">
        <div>
          <div className="section-label">{t('library.eyebrow')}</div>
          <h1>{t('library.title')}</h1>
          <p>{t('library.count', { count: bookmarks.length })}</p>
        </div>
        <div className="transfer-actions">
          <Button onClick={() => fileInput.current?.click()}>{t('library.import')}</Button>
          <Button onClick={() => void exportAll()} disabled={bookmarks.length === 0}>
            {t('library.export')}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>
      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}
      <div className="filters">
        <label className="search-field">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('library.search')}
          />
        </label>
        <div className="filter-row">
          <select
            aria-label={t('library.filter')}
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryFilter)}
          >
            {filterCategories.map((item) => (
              <option key={item} value={item}>
                {categoryLabel(item, locale)}
              </option>
            ))}
          </select>
          <select
            aria-label={t('library.sort')}
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOrder)}
          >
            <option value="newest">{t('library.newest')}</option>
            <option value="oldest">{t('library.oldest')}</option>
          </select>
        </div>
      </div>
      {loading ? (
        <div className="loading-state">{t('library.loading')}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={bookmarks.length === 0 ? t('library.emptyTitle') : t('library.noMatch')}
          description={
            bookmarks.length === 0 ? t('library.emptyDescription') : t('library.noMatchDescription')
          }
        />
      ) : (
        <div className="bookmark-grid">
          {filtered.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onView={() => {
                setStartEditing(false);
                setSelected(bookmark);
              }}
              onEdit={() => {
                setStartEditing(true);
                setSelected(bookmark);
              }}
              onDelete={() => setDeleteTarget(bookmark)}
            />
          ))}
        </div>
      )}
      {deleteTarget ? (
        <ConfirmDelete
          bookmark={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}

function ConfirmDelete({
  bookmark,
  onCancel,
  onConfirm,
}: {
  bookmark: DesignBookmark;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onCancel]);
  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onCancel();
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
      >
        <h2 id="delete-title">{t('library.deleteTitle')}</h2>
        <p id="delete-description">{t('library.deleteDescription', { title: bookmark.title })}</p>
        <div className="form-actions">
          <Button autoFocus onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button className="danger-button" onClick={onConfirm}>
            {t('library.deletePermanently')}
          </Button>
        </div>
      </section>
    </div>
  );
}
