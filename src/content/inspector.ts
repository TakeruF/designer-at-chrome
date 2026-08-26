import { isExtensionMessage } from '../shared/messages';
import type {
  CapturePreparation,
  CaptureTargetPreview,
  ExtensionMessage,
  MessageResponse,
  SelectedElementInfo,
  VideoBookmarkMetadata,
  VideoCaptureMode,
  VideoCaptureOptions,
} from '../shared/types';
import { analyzeElement, rectToViewportRect } from './element-analyzer';
import { InspectorOverlay } from './overlay';
import {
  analyzeVideo,
  captureTargetForMode,
  captureTargetPreview,
  findVideo,
  hasPlayerControls,
  visibleVideoRect,
} from './video-analyzer';

interface PlaybackSnapshot {
  video: HTMLVideoElement;
  wasPaused: boolean;
}

class InspectorController {
  private readonly overlay = new InspectorOverlay();
  private selecting = false;
  private selected: Element | null = null;
  private childHistory: Element[] = [];
  private captureTarget: Element | null = null;
  private captureTargetMode: VideoCaptureMode | null = null;
  private captureChildHistory: Element[] = [];
  private playbackSnapshots: PlaybackSnapshot[] = [];

  constructor() {
    document.addEventListener('pointermove', this.onPointerMove, true);
    document.addEventListener('click', this.onClick, true);
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('scroll', this.refreshSelected, true);
    window.addEventListener('resize', this.refreshSelected);
    chrome.runtime.onMessage.addListener(this.onMessage);
  }

  startSelection(): void {
    this.selecting = true;
    this.overlay.hideHover();
  }

  private stopSelection(): void {
    const wasSelecting = this.selecting;
    this.selecting = false;
    this.overlay.hideHover();
    if (wasSelecting) {
      void chrome.runtime
        .sendMessage({ type: 'SELECTION_MODE_EXITED' } satisfies ExtensionMessage)
        .catch(() => {
          // Selection mode also works when the side panel is closed.
        });
    }
  }

  private eventElement(event: Event): Element | null {
    const target = event.composedPath().find((node): node is Element => node instanceof Element);
    if (!target || target.closest('[data-ui-lens-overlay="true"]')) return null;
    return target;
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.selecting) return;
    const target = this.eventElement(event);
    if (target) this.overlay.showHover(target);
  };

  private readonly onClick = (event: MouseEvent): void => {
    if (!this.selecting) return;
    const target = this.eventElement(event);
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    this.childHistory = [];
    this.setSelected(target);
    this.stopSelection();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.selecting && event.key === 'Escape') {
      event.preventDefault();
      this.stopSelection();
    }
  };

  private readonly refreshSelected = (): void => {
    if (this.selected?.isConnected) this.overlay.showSelected(this.selected);
    if (this.captureTarget?.isConnected) this.overlay.showCapture(this.captureTarget);
  };

  private clearCaptureTarget(): void {
    this.captureTarget = null;
    this.captureTargetMode = null;
    this.captureChildHistory = [];
    this.overlay.hideCapture();
  }

  private async clearSelection(): Promise<void> {
    this.stopSelection();
    this.selected = null;
    this.childHistory = [];
    this.clearCaptureTarget();
    this.overlay.hideSelected();
    // Capture may have temporarily paused a video. Restore its original state
    // before discarding the selection and capture bookkeeping.
    await this.restoreAfterCapture();
  }

  private setSelected(element: Element): SelectedElementInfo {
    this.selected = element;
    this.clearCaptureTarget();
    this.overlay.showSelected(element);
    const info = analyzeElement(element);
    void chrome.runtime
      .sendMessage({ type: 'ELEMENT_SELECTED', payload: info } satisfies ExtensionMessage)
      .catch(() => {
        // The selection remains usable even when the side panel is closed.
      });
    return info;
  }

  private move(direction: 'parent' | 'child'): SelectedElementInfo | null {
    if (!this.selected) return null;
    if (direction === 'parent') {
      const parent = this.selected.parentElement;
      if (!parent) return analyzeElement(this.selected);
      this.childHistory.push(this.selected);
      return this.setSelected(parent);
    }
    const child = this.childHistory.pop();
    if (!child?.isConnected) return analyzeElement(this.selected);
    return this.setSelected(child);
  }

  private setCaptureTarget(mode: VideoCaptureMode): CaptureTargetPreview | null {
    if (!this.selected) return null;
    const target = captureTargetForMode(this.selected, mode);
    if (!target) return null;
    this.captureTarget = target;
    this.captureTargetMode = mode;
    this.captureChildHistory = [];
    this.overlay.showCapture(target);
    return captureTargetPreview(target, mode, false);
  }

  private moveCaptureTarget(direction: 'parent' | 'child'): CaptureTargetPreview | null {
    if (!this.captureTarget || !this.captureTargetMode) return null;
    if (direction === 'parent') {
      const parent = this.captureTarget.parentElement;
      if (parent) {
        this.captureChildHistory.push(this.captureTarget);
        this.captureTarget = parent;
      }
    } else {
      const child = this.captureChildHistory.pop();
      if (child?.isConnected) this.captureTarget = child;
    }
    this.overlay.showCapture(this.captureTarget);
    return captureTargetPreview(
      this.captureTarget,
      this.captureTargetMode,
      this.captureChildHistory.length > 0,
    );
  }

  private async attemptToShowControls(target: Element, video: HTMLVideoElement): Promise<boolean> {
    const rect = video.getBoundingClientRect();
    const init: MouseEventInit = {
      bubbles: true,
      composed: true,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    };
    target.dispatchEvent(new PointerEvent('pointermove', init));
    target.dispatchEvent(new MouseEvent('mousemove', init));
    video.dispatchEvent(new MouseEvent('mouseover', init));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return video.controls || hasPlayerControls(target);
  }

  private snapshotAndPauseVideos(target: Element): void {
    const videos = [
      ...(target instanceof HTMLVideoElement ? [target] : []),
      ...target.querySelectorAll<HTMLVideoElement>('video'),
    ].filter((video, index, all) => all.indexOf(video) === index);
    this.playbackSnapshots = videos.map((video) => ({
      video,
      wasPaused: video.paused || video.ended,
    }));
    for (const { video, wasPaused } of this.playbackSnapshots) {
      if (!wasPaused) video.pause();
    }
  }

  private async restoreAfterCapture(): Promise<string[]> {
    const snapshots = this.playbackSnapshots;
    this.playbackSnapshots = [];
    const warnings: string[] = [];
    for (const { video, wasPaused } of snapshots) {
      if (wasPaused || !video.isConnected || !video.paused) continue;
      try {
        await video.play();
      } catch {
        warnings.push(
          '撮影後に動画の再生を自動で再開できませんでした。ページ上で再生してください。',
        );
      }
    }
    this.overlay.restore();
    this.refreshSelected();
    return warnings;
  }

  private async prepareCapture(options?: VideoCaptureOptions): Promise<CapturePreparation | null> {
    if (!this.selected) return null;
    await this.restoreAfterCapture();

    const video = findVideo(this.selected);
    let target = this.selected;
    let videoMetadata: VideoBookmarkMetadata | null = null;
    if (video && options) {
      if (!this.captureTarget || this.captureTargetMode !== options.captureMode) {
        this.setCaptureTarget(options.captureMode);
      }
      target = this.captureTarget ?? this.selected;
      let controlsIncluded = video.controls || hasPlayerControls(target);
      let captureLimitation: string | null = null;
      if (options.includePlayerControls) {
        controlsIncluded = await this.attemptToShowControls(target, video);
        if (!controlsIncluded) {
          captureLimitation =
            'プレイヤーのコントロールを表示できなかったため、見えている動画フレームを保存しました。';
        }
      }
      const currentVideo = analyzeVideo(this.selected);
      if (options.pauseWhileCapturing) this.snapshotAndPauseVideos(this.selected);
      if (currentVideo) {
        videoMetadata = {
          ...currentVideo,
          captureMode: options.captureMode,
          controlsIncluded,
          captureLimitation,
        };
      }
    }

    this.overlay.hideAll();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const rect = target.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    const visible = new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
    return {
      rect: rectToViewportRect(rect),
      visibleRect: rectToViewportRect(visible),
      devicePixelRatio: window.devicePixelRatio || 1,
      clippedToViewport:
        left !== rect.left || top !== rect.top || right !== rect.right || bottom !== rect.bottom,
      videoVisibleRect: video ? visibleVideoRect(video) : null,
      videoMetadata,
    };
  }

  private readonly onMessage = (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse<unknown>) => void,
  ): boolean | undefined => {
    if (!isExtensionMessage(message)) return undefined;
    if (message.type === 'START_SELECTION' || message.type === 'RESELECT_ELEMENT') {
      this.startSelection();
      sendResponse({ ok: true, data: undefined });
      return false;
    }
    if (message.type === 'STOP_SELECTION') {
      this.stopSelection();
      sendResponse({ ok: true, data: undefined });
      return false;
    }
    if (message.type === 'MOVE_SELECTION') {
      const info = this.move(message.direction);
      sendResponse(
        info
          ? { ok: true, data: info }
          : { ok: false, error: { code: 'NO_SELECTION', message: '先に要素を選択してください。' } },
      );
      return false;
    }
    if (message.type === 'GET_SELECTION') {
      sendResponse({ ok: true, data: this.selected ? analyzeElement(this.selected) : null });
      return false;
    }
    if (message.type === 'CLEAR_SELECTION') {
      void this.clearSelection()
        .then(() => sendResponse({ ok: true, data: undefined }))
        .catch((caught: unknown) =>
          sendResponse({
            ok: false,
            error: {
              code: 'UNKNOWN',
              message:
                caught instanceof Error ? caught.message : '選択状態を解除できませんでした。',
            },
          }),
        );
      return true;
    }
    if (message.type === 'SET_CAPTURE_TARGET') {
      const preview = this.setCaptureTarget(message.captureMode);
      sendResponse(
        preview
          ? { ok: true, data: preview }
          : { ok: false, error: { code: 'NO_SELECTION', message: '動画要素が見つかりません。' } },
      );
      return false;
    }
    if (message.type === 'MOVE_CAPTURE_TARGET') {
      const preview = this.moveCaptureTarget(message.direction);
      sendResponse(
        preview
          ? { ok: true, data: preview }
          : { ok: false, error: { code: 'NO_SELECTION', message: '撮影範囲がありません。' } },
      );
      return false;
    }
    if (message.type === 'CLEAR_CAPTURE_TARGET') {
      this.clearCaptureTarget();
      sendResponse({ ok: true, data: undefined });
      return false;
    }
    if (message.type === 'CAPTURE_PREPARE') {
      void this.prepareCapture(message.options)
        .then((capture) => {
          sendResponse(
            capture
              ? { ok: true, data: capture }
              : {
                  ok: false,
                  error: { code: 'NO_SELECTION', message: '保存する要素がありません。' },
                },
          );
        })
        .catch(async (caught: unknown) => {
          // A preparation error can happen after pausing playback. Always restore the
          // page before reporting the failure to the side panel.
          await this.restoreAfterCapture().catch(() => []);
          sendResponse({
            ok: false,
            error: {
              code: 'CAPTURE_FAILED',
              message: caught instanceof Error ? caught.message : '撮影準備に失敗しました。',
            },
          });
        });
      return true;
    }
    if (message.type === 'CAPTURE_RESTORE') {
      void this.restoreAfterCapture()
        .then((warnings) => sendResponse({ ok: true, data: { warnings } }))
        .catch((caught: unknown) =>
          sendResponse({
            ok: false,
            error: {
              code: 'CAPTURE_FAILED',
              message:
                caught instanceof Error ? caught.message : '動画状態を復元できませんでした。',
            },
          }),
        );
      return true;
    }
    return undefined;
  };
}

declare global {
  interface Window {
    __uiLensInspector?: InspectorController;
  }
}

if (!window.__uiLensInspector) window.__uiLensInspector = new InspectorController();
