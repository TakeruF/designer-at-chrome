import type { ExtensionError, ExtensionMessage, MessageResponse } from './types';

export class ExtensionRuntimeError extends Error {
  readonly code: ExtensionError['code'];

  constructor(error: ExtensionError) {
    super(error.message);
    this.name = 'ExtensionRuntimeError';
    this.code = error.code;
  }
}

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) return false;
  return typeof value.type === 'string';
}

export async function sendRuntimeMessage<T>(message: ExtensionMessage): Promise<T> {
  const response: MessageResponse<T> | undefined = await chrome.runtime.sendMessage(message);
  if (!response) throw new Error('The extension did not return a response.');
  if (!response.ok) throw new ExtensionRuntimeError(response.error);
  return response.data;
}
