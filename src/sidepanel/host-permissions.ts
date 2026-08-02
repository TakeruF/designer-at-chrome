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
