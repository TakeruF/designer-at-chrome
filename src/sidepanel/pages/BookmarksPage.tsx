import { useEffect, useMemo, useRef, useState } from 'react';
import type { BookmarkCategory, DesignBookmark } from '../../shared/types';
import { getBookmarks, removeBookmark } from '../../storage/bookmark-storage';
import { createExportZip, importFromZip } from '../../storage/export-import';
import { deleteScreenshot } from '../../storage/screenshot-db';
import { BookmarkCard } from '../components/BookmarkCard';
import { BookmarkDetail } from '../components/BookmarkDetail';
import { SearchIcon } from '../components/Icons';
import { Button, EmptyState, Notice } from '../components/UI';

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
            text: caught instanceof Error ? caught.message : '読み込めませんでした。',
          });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

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
      setStatus({ tone: 'success', text: `${bookmarks.length}件をZIPへエクスポートしました。` });
    } catch (caught) {
      setStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'エクスポートに失敗しました。',
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
        text: `${result.imported}件をインポートしました${result.skipped ? `（画像不足で${result.skipped}件をスキップ）` : ''}。`,
      });
    } catch (caught) {
      setStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : 'インポートに失敗しました。',
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setStatus(null);
    try {
      await deleteScreenshot(deleteTarget.screenshot.screenshotId);
      await removeBookmark(deleteTarget.id);
      setBookmarks((items) => items.filter((item) => item.id !== deleteTarget.id));
      if (selected?.id === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      setStatus({ tone: 'success', text: 'ブックマークと画像を削除しました。' });
    } catch (caught) {
      setStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : '削除に失敗しました。',
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
          <div className="section-label">Local collection</div>
          <h1>Bookmarks</h1>
          <p>{bookmarks.length} saved designs</p>
        </div>
        <div className="transfer-actions">
          <Button onClick={() => fileInput.current?.click()}>Import</Button>
          <Button onClick={() => void exportAll()} disabled={bookmarks.length === 0}>
            Export
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
            placeholder="Search title, tags, notes…"
          />
        </label>
        <div className="filter-row">
          <select
            aria-label="カテゴリで絞り込み"
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryFilter)}
          >
            {filterCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="保存日時で並べ替え"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortOrder)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>
      {loading ? (
        <div className="loading-state">Loading bookmarks…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={
            bookmarks.length === 0 ? 'Your reference library is empty' : 'No matching bookmarks'
          }
          description={
            bookmarks.length === 0
              ? 'Inspect a design you like and save it here. Images and notes remain local to this browser.'
              : '検索語またはカテゴリを変更してください。'
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
        <h2 id="delete-title">Delete bookmark?</h2>
        <p id="delete-description">
          「{bookmark.title}」のメタデータ、元画像、サムネイルをこのブラウザから削除します。
        </p>
        <div className="form-actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button className="danger-button" onClick={onConfirm}>
            Delete permanently
          </Button>
        </div>
      </section>
    </div>
  );
}
