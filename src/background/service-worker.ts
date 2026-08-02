import { isExtensionMessage } from '../shared/messages';
import type { ExtensionError, ExtensionMessage, MessageResponse } from '../shared/types';
import { captureAndStore } from './screenshot';

const restrictedSchemes = ['chrome:', 'edge:', 'about:', 'view-source:', 'chrome-extension:'];

function error(code: ExtensionError['code'], message: string): MessageResponse<never> {
  return { ok: false, error: { code, message } };
}

function isRestricted(tab: chrome.tabs.Tab): boolean {
  if (!tab.url) return true;
  try {
    const url = new URL(tab.url);
    return (
      restrictedSchemes.includes(url.protocol) ||
      url.hostname === 'chromewebstore.google.com' ||
      (url.hostname === 'chrome.google.com' && url.pathname.startsWith('/webstore'))
    );
  } catch {
    return true;
  }
}

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('アクティブなタブが見つかりません。');
  if (isRestricted(tab)) {
    throw new Error('このページでは拡張機能を実行できません。通常のWebページでお試しください。');
  }
  return tab;
}

async function ensureInspector(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'GET_SELECTION' } satisfies ExtensionMessage);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  }
}

async function forwardToInspector<T>(message: ExtensionMessage): Promise<T> {
  const tab = await activeTab();
  await ensureInspector(tab.id as number);
  const response: MessageResponse<T> = await chrome.tabs.sendMessage(tab.id as number, message);
  if (!response.ok) throw new Error(response.error.message);
  return response.data;
}

async function handleMessage(message: ExtensionMessage): Promise<MessageResponse<unknown>> {
  if (
    message.type === 'ELEMENT_SELECTED' ||
    message.type === 'CAPTURE_PREPARE' ||
    message.type === 'CAPTURE_RESTORE'
  ) {
    return { ok: true, data: undefined };
  }
  try {
    if (message.type === 'CAPTURE_AND_STORE') {
      const tab = await activeTab();
      await ensureInspector(tab.id as number);
      return {
        ok: true,
        data: await captureAndStore(tab, message.bookmarkId, message.options),
      };
    }
    return { ok: true, data: await forwardToInspector(message) };
  } catch (caught) {
    const messageText = caught instanceof Error ? caught.message : '不明なエラーが発生しました。';
    const hostPermissionRequired =
      /Cannot access contents|manifest must request permission|Cannot access page/i.test(
        messageText,
      );
    if (hostPermissionRequired) {
      return error(
        'HOST_PERMISSION_REQUIRED',
        'This site needs permission before UI Lens can inspect it.',
      );
    }
    const restricted = messageText.includes('このページ');
    return error(restricted ? 'RESTRICTED_PAGE' : 'UNKNOWN', messageText);
  }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isExtensionMessage(message) || (sender.tab && message.type === 'ELEMENT_SELECTED'))
    return undefined;
  void handleMessage(message).then(sendResponse);
  return true;
});

void chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((caught: unknown) => {
    console.error('Failed to configure side panel behavior.', caught);
  });

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((caught: unknown) => {
      console.error('Failed to configure side panel behavior.', caught);
    });
});
