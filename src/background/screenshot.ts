import type {
  CapturePreparation,
  CaptureStoredResult,
  MessageResponse,
  StoredScreenshot,
  VideoCaptureOptions,
} from '../shared/types';
import { saveScreenshot } from '../storage/screenshot-db';
import { analyzeProtectedFramePixels } from './protected-content';

async function sendToTab<T>(tabId: number, message: object): Promise<T> {
  const response: MessageResponse<T> = await chrome.tabs.sendMessage(tabId, message);
  if (!response.ok) throw new Error(response.error.message);
  return response.data;
}

interface CroppedImage {
  full: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
  protectedContentSuspected: boolean;
}

function videoRectInCrop(preparation: CapturePreparation, ratio: number) {
  if (!preparation.videoVisibleRect) return null;
  const left = Math.max(
    0,
    Math.round((preparation.videoVisibleRect.left - preparation.visibleRect.left) * ratio),
  );
  const top = Math.max(
    0,
    Math.round((preparation.videoVisibleRect.top - preparation.visibleRect.top) * ratio),
  );
  const right = Math.min(
    Math.round(preparation.visibleRect.width * ratio),
    Math.round((preparation.videoVisibleRect.right - preparation.visibleRect.left) * ratio),
  );
  const bottom = Math.min(
    Math.round(preparation.visibleRect.height * ratio),
    Math.round((preparation.videoVisibleRect.bottom - preparation.visibleRect.top) * ratio),
  );
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function detectProtectedVideo(
  canvas: OffscreenCanvas,
  videoRect: { x: number; y: number; width: number; height: number } | null,
): boolean {
  if (!videoRect) return false;
  const sampleWidth = Math.min(64, videoRect.width);
  const sampleHeight = Math.min(64, videoRect.height);
  if (sampleWidth <= 0 || sampleHeight <= 0) return false;
  const sample = new OffscreenCanvas(sampleWidth, sampleHeight);
  const context = sample.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(
    canvas,
    videoRect.x,
    videoRect.y,
    videoRect.width,
    videoRect.height,
    0,
    0,
    sampleWidth,
    sampleHeight,
  );
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
  return analyzeProtectedFramePixels(pixels).suspected;
}

function drawProtectedPlaceholder(
  context: OffscreenCanvasRenderingContext2D,
  videoRect: { x: number; y: number; width: number; height: number },
  label: string,
): void {
  context.save();
  context.fillStyle = '#18181B';
  context.fillRect(videoRect.x, videoRect.y, videoRect.width, videoRect.height);
  context.strokeStyle = '#3F3F46';
  context.lineWidth = 2;
  context.strokeRect(videoRect.x + 1, videoRect.y + 1, videoRect.width - 2, videoRect.height - 2);
  context.fillStyle = '#A1A1AA';
  context.font = `${Math.max(12, Math.min(18, videoRect.width / 24))}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, videoRect.x + videoRect.width / 2, videoRect.y + videoRect.height / 2);
  context.restore();
}

async function cropToWebP(
  dataUrl: string,
  preparation: CapturePreparation,
  options?: VideoCaptureOptions,
): Promise<CroppedImage> {
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

  const videoRect = videoRectInCrop(preparation, ratio);
  const protectedContentSuspected = detectProtectedVideo(canvas, videoRect);
  if (
    protectedContentSuspected &&
    videoRect &&
    options?.protectedContentHandling !== undefined &&
    options.protectedContentHandling !== 'prompt'
  ) {
    drawProtectedPlaceholder(
      context,
      videoRect,
      options.protectedContentHandling === 'player-ui'
        ? 'Protected video frame omitted'
        : 'Video frame unavailable',
    );
  }

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
  return { full, thumbnail, width, height, protectedContentSuspected };
}

export async function captureAndStore(
  tab: chrome.tabs.Tab,
  bookmarkId: string,
  options?: VideoCaptureOptions,
): Promise<CaptureStoredResult> {
  if (tab.id === undefined || tab.windowId === undefined)
    throw new Error('撮影対象のタブがありません。');
  let prepared = false;
  let result: Omit<CaptureStoredResult, 'restoreWarnings'> | null = null;
  const restoreWarnings: string[] = [];
  try {
    const preparation = await sendToTab<CapturePreparation>(tab.id, {
      type: 'CAPTURE_PREPARE',
      options,
    });
    prepared = true;
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const image = await cropToWebP(dataUrl, preparation, options);
    const protectedLimitation = image.protectedContentSuspected
      ? '動画フレームを取得できませんでした。この動画はブラウザまたは配信サービスによって保護されている可能性があります。'
      : null;
    const viewportLimitation = preparation.clippedToViewport
      ? '対象がviewportからはみ出していたため、表示されている範囲だけを保存しました。'
      : null;
    const videoVisibilityLimitation =
      preparation.videoMetadata &&
      (!preparation.videoVisibleRect ||
        preparation.videoVisibleRect.width <= 0 ||
        preparation.videoVisibleRect.height <= 0)
        ? '動画領域がviewport内にないため、周辺のUIだけを保存しました。'
        : null;
    const videoMetadata = preparation.videoMetadata
      ? {
          ...preparation.videoMetadata,
          captureLimitation:
            [
              preparation.videoMetadata.captureLimitation,
              protectedLimitation,
              viewportLimitation,
              videoVisibilityLimitation,
            ]
              .filter(Boolean)
              .join(' ') || null,
        }
      : null;
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
    result = {
      screenshotId: record.id,
      width: record.width,
      height: record.height,
      clippedToViewport: preparation.clippedToViewport,
      videoMetadata,
      protectedContentSuspected: image.protectedContentSuspected,
    };
  } finally {
    if (prepared) {
      try {
        const restored = await sendToTab<{ warnings: string[] }>(tab.id, {
          type: 'CAPTURE_RESTORE',
        });
        restoreWarnings.push(...restored.warnings);
      } catch (caught) {
        restoreWarnings.push(
          caught instanceof Error ? caught.message : '動画の再生状態を復元できませんでした。',
        );
      }
    }
  }
  if (!result) throw new Error('スクリーンショットを保存できませんでした。');
  if (result.videoMetadata && restoreWarnings.length > 0) {
    result.videoMetadata.captureLimitation = [
      result.videoMetadata.captureLimitation,
      ...restoreWarnings,
    ]
      .filter(Boolean)
      .join(' ');
  }
  return { ...result, restoreWarnings };
}
