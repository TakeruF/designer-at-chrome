import type {
  CaptureTargetPreview,
  VideoCaptureMode,
  VideoElementInfo,
  ViewportRect,
} from '../shared/types';
import { generateCssSelector } from './selector-generator';

const CONTROL_WORDS = /play|pause|再生|停止|fullscreen|full screen|全画面|mute|volume|音量/i;
const TIME_TEXT = /(?:^|\s)\d{1,2}:\d{2}(?::\d{2})?(?:\s*\/\s*\d{1,2}:\d{2}(?::\d{2})?)?(?:\s|$)/;
const rounded = (value: number) => Math.round(value * 100) / 100;

function toViewportRect(rect: DOMRect): ViewportRect {
  return {
    x: rounded(rect.x),
    y: rounded(rect.y),
    top: rounded(rect.top),
    right: rounded(rect.right),
    bottom: rounded(rect.bottom),
    left: rounded(rect.left),
    width: rounded(rect.width),
    height: rounded(rect.height),
  };
}

export function findVideo(element: Element): HTMLVideoElement | null {
  if (element instanceof HTMLVideoElement) return element;
  const videos = [...element.querySelectorAll<HTMLVideoElement>('video')];
  const descendant =
    videos.find((video) => {
      const rect = video.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) ??
    videos[0] ??
    null;
  if (descendant) return descendant;

  // Player controls are commonly siblings of <video>. Walk a short ancestor chain
  // so selecting a play button or timeline still exposes video-frame capture.
  let ancestor = element.parentElement;
  let depth = 0;
  while (
    ancestor &&
    ancestor !== document.body &&
    ancestor !== document.documentElement &&
    depth < 8
  ) {
    const siblingVideo = [...ancestor.querySelectorAll<HTMLVideoElement>('video')].find((video) => {
      const rect = video.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    if (siblingVideo && scoreVideoPlayerCandidate(ancestor, siblingVideo) >= 2) {
      return siblingVideo;
    }
    ancestor = ancestor.parentElement;
    depth += 1;
  }
  return null;
}

function visible(element: Element): boolean {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number.parseFloat(style.opacity) > 0.02 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function hasPlayerControls(element: Element): boolean {
  const controls = [
    ...element.querySelectorAll(
      'button, [role="button"], [role="progressbar"], input[type="range"], [aria-label], [title]',
    ),
  ];
  return controls.some((control) => {
    const label = `${control.getAttribute('aria-label') ?? ''} ${control.getAttribute('title') ?? ''} ${control.textContent ?? ''}`;
    return (
      visible(control) &&
      (CONTROL_WORDS.test(label) || control.matches('[role="progressbar"], input[type="range"]'))
    );
  });
}

export function scoreVideoPlayerCandidate(candidate: Element, video: HTMLVideoElement): number {
  const rect = candidate.getBoundingClientRect();
  const videoRect = video.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || videoRect.width <= 0 || videoRect.height <= 0)
    return -1;
  const areaRatio = (rect.width * rect.height) / (videoRect.width * videoRect.height);
  if (areaRatio > 8) return -1;

  let score = 0;
  const labelledControls = candidate.querySelectorAll(
    'button, [role="button"], [aria-label], [title]',
  );
  const labelText = [...labelledControls]
    .map(
      (control) =>
        `${control.getAttribute('aria-label') ?? ''} ${control.getAttribute('title') ?? ''} ${control.textContent ?? ''}`,
    )
    .join(' ');
  if (/play|pause|再生|停止/i.test(labelText)) score += 2;
  if (/fullscreen|full screen|全画面/i.test(labelText)) score += 2;
  if (candidate.querySelector('[role="progressbar"], input[type="range"]')) score += 2;
  if (TIME_TEXT.test(candidate.textContent ?? '')) score += 1;
  if (areaRatio >= 1 && areaRatio <= 2.5) score += 2;
  else if (areaRatio <= 4) score += 1;
  return score;
}

export function estimateVideoPlayer(video: HTMLVideoElement): Element {
  let current = video.parentElement;
  let fallback: Element = video;
  let fallbackScore = -1;
  let depth = 0;
  while (
    current &&
    current !== document.body &&
    current !== document.documentElement &&
    depth < 8
  ) {
    const score = scoreVideoPlayerCandidate(current, video);
    if (score >= 4) return current;
    if (score > fallbackScore) {
      fallback = current;
      fallbackScore = score;
    }
    current = current.parentElement;
    depth += 1;
  }
  return fallback;
}

export function analyzeVideo(element: Element): VideoElementInfo | null {
  const video = findVideo(element);
  if (!video) return null;
  const rect = video.getBoundingClientRect();
  return {
    containsVideo: true,
    videoCount:
      (element instanceof HTMLVideoElement ? 1 : element.querySelectorAll('video').length) || 1,
    currentTime: Number.isFinite(video.currentTime) ? rounded(video.currentTime) : 0,
    duration: Number.isFinite(video.duration) ? rounded(video.duration) : null,
    paused: video.paused,
    muted: video.muted,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    displayedWidth: rounded(rect.width),
    displayedHeight: rounded(rect.height),
    aspectRatio:
      video.videoWidth > 0 && video.videoHeight > 0
        ? rounded(video.videoWidth / video.videoHeight)
        : rect.height > 0
          ? rounded(rect.width / rect.height)
          : null,
    nativeControls: video.controls,
    subtitlesDetected:
      video.textTracks.length > 0 ||
      Boolean(video.querySelector('track[kind="subtitles"], track[kind="captions"]')) ||
      Boolean(
        element.querySelector(
          '[class*="subtitle" i], [class*="caption" i], [aria-label*="subtitle" i], [aria-label*="caption" i]',
        ),
      ),
  };
}

export function captureTargetForMode(selected: Element, mode: VideoCaptureMode): Element | null {
  const video = findVideo(selected);
  if (!video) return null;
  if (mode === 'current-frame') return video;
  if (mode === 'selected-element') return selected;
  return estimateVideoPlayer(video);
}

export function captureTargetPreview(
  element: Element,
  mode: VideoCaptureMode,
  canSelectChild: boolean,
): CaptureTargetPreview {
  return {
    captureMode: mode,
    tagName: element.tagName.toLowerCase(),
    cssSelector: generateCssSelector(element),
    rect: toViewportRect(element.getBoundingClientRect()),
    canSelectParent: Boolean(element.parentElement),
    canSelectChild,
  };
}

export function visibleVideoRect(video: HTMLVideoElement): ViewportRect {
  const rect = video.getBoundingClientRect();
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(window.innerWidth, rect.right);
  const bottom = Math.min(window.innerHeight, rect.bottom);
  return toViewportRect(
    new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top)),
  );
}
