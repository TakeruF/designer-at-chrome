import type {
  CapturePreparation,
  CaptureStoredResult,
  MessageResponse,
  StoredScreenshot,
} from '../shared/types';
import { saveScreenshot } from '../storage/screenshot-db';

async function sendToTab<T>(tabId: number, message: object): Promise<T> {
  const response: MessageResponse<T> = await chrome.tabs.sendMessage(tabId, message);
  if (!response.ok) throw new Error(response.error.message);
  return response.data;
}

async function cropToWebP(
  dataUrl: string,
  preparation: CapturePreparation,
): Promise<{ full: Blob; thumbnail: Blob; width: number; height: number }> {
  const sourceBlob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(sourceBlob);
  const ratio = preparation.devicePixelRatio;
  const sourceX = Math.max(0, Math.round(preparation.visibleRect.left * ratio));
  const sourceY = Math.max(0, Math.round(preparation.visibleRect.top * ratio));
  const width = Math.min(bitmap.width - sourceX, Math.round(preparation.visibleRect.width * ratio));
  const height = Math.min(
    bitmap.height - sourceY,
    Math.round(preparation.visibleRect.height * ratio),
  );
  if (width <= 0 || height <= 0) throw new Error('選択要素は現在の表示領域にありません。');

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvasを初期化できませんでした。');
  context.drawImage(bitmap, sourceX, sourceY, width, height, 0, 0, width, height);
  bitmap.close();
  const full = await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });

  const thumbnailWidth = Math.min(400, width);
  const thumbnailHeight = Math.max(1, Math.round((height / width) * thumbnailWidth));
  const thumbnailCanvas = new OffscreenCanvas(thumbnailWidth, thumbnailHeight);
  const thumbnailContext = thumbnailCanvas.getContext('2d');
  if (!thumbnailContext) throw new Error('サムネイル用Canvasを初期化できませんでした。');
  const fullBitmap = await createImageBitmap(full);
  thumbnailContext.drawImage(fullBitmap, 0, 0, thumbnailWidth, thumbnailHeight);
  fullBitmap.close();
  const thumbnail = await thumbnailCanvas.convertToBlob({ type: 'image/webp', quality: 0.82 });
  return { full, thumbnail, width, height };
}

export async function captureAndStore(
  tab: chrome.tabs.Tab,
  bookmarkId: string,
): Promise<CaptureStoredResult> {
  if (tab.id === undefined || tab.windowId === undefined)
    throw new Error('撮影対象のタブがありません。');
  let prepared = false;
  try {
    const preparation = await sendToTab<CapturePreparation>(tab.id, { type: 'CAPTURE_PREPARE' });
    prepared = true;
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const image = await cropToWebP(dataUrl, preparation);
    const record: StoredScreenshot = {
      id: bookmarkId,
      bookmarkId,
      fullImageBlob: image.full,
      thumbnailBlob: image.thumbnail,
      width: image.width,
      height: image.height,
      mimeType: 'image/webp',
      createdAt: new Date().toISOString(),
    };
    await saveScreenshot(record);
    return {
      screenshotId: record.id,
      width: record.width,
      height: record.height,
      clippedToViewport: preparation.clippedToViewport,
    };
  } finally {
    if (prepared) {
      await chrome.tabs.sendMessage(tab.id, { type: 'CAPTURE_RESTORE' }).catch(() => undefined);
    }
  }
}
