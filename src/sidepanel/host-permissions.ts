export function hostPatternForUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? `${url.origin}/*` : null;
  } catch {
    return null;
  }
}

export async function activeTabHostPattern(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab.url ? hostPatternForUrl(tab.url) : null;
}

export function requestHostAccess(origin: string): Promise<boolean> {
  // Keep this call synchronous with the button gesture; Chrome requires a user gesture.
  return chrome.permissions.request({ origins: [origin] });
}

export function requestCaptureAccess(): Promise<boolean> {
  // captureVisibleTab requires the activeTab grant or the literal <all_urls> permission.
  // This optional permission is requested only after the user chooses to enable capture.
  return chrome.permissions.request({ origins: ['<all_urls>'] });
}

export function hasAllSitesAccess(): Promise<boolean> {
  return chrome.permissions.contains({ origins: ['<all_urls>'] });
}

export function removeAllSitesAccess(): Promise<boolean> {
  return chrome.permissions.remove({ origins: ['<all_urls>'] });
}

export function isCapturePermissionError(caught: unknown): boolean {
  return (
    caught instanceof Error &&
    /<all_urls>|activeTab.*permission is required|additional permission to capture/i.test(
      caught.message,
    )
  );
}
