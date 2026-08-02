import { isExtensionMessage } from '../shared/messages';
import type {
  CapturePreparation,
  ExtensionMessage,
  MessageResponse,
  SelectedElementInfo,
} from '../shared/types';
import { analyzeElement, rectToViewportRect } from './element-analyzer';
import { InspectorOverlay } from './overlay';

class InspectorController {
  private readonly overlay = new InspectorOverlay();
  private selecting = false;
  private selected: Element | null = null;
  private childHistory: Element[] = [];

  constructor() {
    document.addEventListener('pointermove', this.onPointerMove, true);
    document.addEventListener('click', this.onClick, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('scroll', this.refreshSelected, true);
    window.addEventListener('resize', this.refreshSelected);
    chrome.runtime.onMessage.addListener(this.onMessage);
  }

  startSelection(): void {
    this.selecting = true;
    this.overlay.hideHover();
  }

  private stopSelection(): void {
    this.selecting = false;
    this.overlay.hideHover();
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
  };

  private setSelected(element: Element): SelectedElementInfo {
    this.selected = element;
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

  private async prepareCapture(): Promise<CapturePreparation | null> {
    if (!this.selected) return null;
    this.overlay.hideAll();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const rect = this.selected.getBoundingClientRect();
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
    if (message.type === 'CAPTURE_PREPARE') {
      void this.prepareCapture()
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
        .catch((error: unknown) => {
          sendResponse({
            ok: false,
            error: {
              code: 'CAPTURE_FAILED',
              message: error instanceof Error ? error.message : '撮影準備に失敗しました。',
            },
          });
        });
      return true;
    }
    if (message.type === 'CAPTURE_RESTORE') {
      this.overlay.restore();
      this.refreshSelected();
      sendResponse({ ok: true, data: undefined });
      return false;
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
