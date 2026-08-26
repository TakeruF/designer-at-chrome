import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionMessage, MessageResponse } from '../src/shared/types';
import { I18nProvider } from '../src/sidepanel/i18n';
import { InspectPage } from '../src/sidepanel/pages/InspectPage';

describe('InspectPage selection mode', () => {
  let container: HTMLDivElement;
  let root: Root;
  let messageListeners: Set<(message: unknown) => void>;
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    messageListeners = new Set();
    sendMessage = vi.fn((): Promise<MessageResponse<void>> =>
      Promise.resolve({ ok: true, data: undefined }),
    );
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage,
        onMessage: {
          addListener: (listener: (message: unknown) => void) => messageListeners.add(listener),
          removeListener: (listener: (message: unknown) => void) =>
            messageListeners.delete(listener),
        },
      },
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('forwards Escape from the focused side panel to the page inspector', async () => {
    act(() => {
      root.render(
        createElement(
          I18nProvider,
          { locale: 'en' },
          createElement(InspectPage, {
            selection: null,
            error: null,
            onSelection: vi.fn(),
            onError: vi.fn(),
            onPermissionGranted: vi.fn(() => Promise.resolve()),
            onSaved: vi.fn(),
          }),
        ),
      );
    });

    const selectButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Select element',
    );
    expect(selectButton).toBeDefined();

    act(() => selectButton?.click());
    await act(() => Promise.resolve());
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'START_SELECTION',
    } satisfies ExtensionMessage);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    });

    expect(sendMessage).toHaveBeenCalledWith({ type: 'STOP_SELECTION' } satisfies ExtensionMessage);
  });
});
