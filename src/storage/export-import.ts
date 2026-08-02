import JSZip from 'jszip';
import type { DesignBookmark, StoredScreenshot } from '../shared/types';
import { getBookmarks, setBookmarks } from './bookmark-storage';
import { deleteScreenshot, getScreenshot, saveScreenshot } from './screenshot-db';
import { resolveImportedBookmarks, validateImportArchive } from './validation';

export async function createExportZip(): Promise<Blob> {
  const bookmarks = await getBookmarks();
  const zip = new JSZip();
  zip.file(
    'bookmarks.json',
    JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), bookmarks }, null, 2),
  );
  const images = zip.folder('images');
  const thumbnails = zip.folder('thumbnails');
  await Promise.all(
    bookmarks.map(async (bookmark) => {
      const screenshot = await getScreenshot(bookmark.screenshot.screenshotId);
      if (!screenshot) return;
      images?.file(`${bookmark.id}.webp`, screenshot.fullImageBlob);
      thumbnails?.file(`${bookmark.id}.webp`, screenshot.thumbnailBlob);
    }),
  );
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export async function importFromZip(file: Blob): Promise<{ imported: number; skipped: number }> {
  if (file.size > 250 * 1024 * 1024) {
    throw new Error('The ZIP archive is larger than the 250 MB import limit.');
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error('ZIPファイルを読み込めませんでした。');
  }
  const jsonFile = zip.file('bookmarks.json');
  if (!jsonFile) throw new Error('bookmarks.json が見つかりません。');
  let raw: unknown;
  try {
    raw = JSON.parse(await jsonFile.async('string')) as unknown;
  } catch {
    throw new Error('bookmarks.json が正しいJSONではありません。');
  }
  const validation = validateImportArchive(raw);
  if (!validation.ok) throw new Error(`インポートデータが不正です: ${validation.errors[0]}`);
  if (validation.value.bookmarks.length > 1000) {
    throw new Error('The archive contains more than the 1,000 bookmark import limit.');
  }

  const existing = await getBookmarks();
  const resolved = resolveImportedBookmarks(
    validation.value.bookmarks,
    new Set(existing.map((bookmark) => bookmark.id)),
  );
  const imported: DesignBookmark[] = [];
  const savedScreenshotIds: string[] = [];
  let skipped = 0;

  try {
    for (const [index, bookmark] of resolved.bookmarks.entries()) {
      const sourceId = resolved.sourceIds[index];
      const fullFile = zip.file(`images/${sourceId}.webp`);
      if (!fullFile) {
        skipped += 1;
        continue;
      }
      const thumbnailFile = zip.file(`thumbnails/${sourceId}.webp`);
      const [fullImageBlob, thumbnailBlob] = await Promise.all([
        fullFile.async('blob'),
        thumbnailFile ? thumbnailFile.async('blob') : fullFile.async('blob'),
      ]);
      const screenshot: StoredScreenshot = {
        id: bookmark.id,
        bookmarkId: bookmark.id,
        fullImageBlob,
        thumbnailBlob,
        width: bookmark.screenshot.width,
        height: bookmark.screenshot.height,
        mimeType: 'image/webp',
        createdAt: bookmark.createdAt,
      };
      await saveScreenshot(screenshot);
      savedScreenshotIds.push(screenshot.id);
      imported.push(bookmark);
    }

    await setBookmarks([...imported, ...existing]);
  } catch (caught) {
    const rollback = await Promise.allSettled(savedScreenshotIds.map((id) => deleteScreenshot(id)));
    const rollbackFailed = rollback.some((result) => result.status === 'rejected');
    if (rollbackFailed)
      console.error('Import rollback could not remove every screenshot.', rollback);
    throw caught;
  }
  return { imported: imported.length, skipped };
}
