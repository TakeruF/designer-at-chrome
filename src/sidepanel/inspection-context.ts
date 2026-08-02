/**
 * Prevents a slow response from a previously active tab from overwriting the
 * state of the tab the user is currently viewing.
 */
export class InspectionRequestGate {
  private version = 0;

  begin(): number {
    this.version += 1;
    return this.version;
  }

  invalidate(): void {
    this.version += 1;
  }

  isCurrent(requestVersion: number): boolean {
    return requestVersion === this.version;
  }
}

export type InspectionTabUpdateAction = 'none' | 'reset' | 'refresh';

/** Separates full navigations from SPA URL changes so injection waits for a loaded document. */
export function inspectionActionForTabUpdate(
  changeInfo: Pick<chrome.tabs.TabChangeInfo, 'status' | 'url'>,
  active: boolean,
): InspectionTabUpdateAction {
  if (!active) return 'none';
  if (changeInfo.status === 'loading') return 'reset';
  if (changeInfo.status === 'complete') return 'refresh';
  // A same-document SPA URL change has no subsequent loading/complete event.
  // Reset without reading the old selection because navigation intentionally
  // starts with no selected element.
  if (changeInfo.url) return 'reset';
  return 'none';
}
