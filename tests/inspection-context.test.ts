import { describe, expect, it } from 'vitest';
import {
  InspectionRequestGate,
  inspectionActionForTabUpdate,
} from '../src/sidepanel/inspection-context';

describe('inspection tab context', () => {
  it('rejects a response after the active tab context has changed', () => {
    const gate = new InspectionRequestGate();
    const restrictedPageRequest = gate.begin();

    gate.invalidate();
    const regularPageRequest = gate.begin();

    expect(gate.isCurrent(restrictedPageRequest)).toBe(false);
    expect(gate.isCurrent(regularPageRequest)).toBe(true);
  });

  it('clears state while a new document loads and refreshes when ready', () => {
    expect(inspectionActionForTabUpdate({ status: 'loading' }, true)).toBe('reset');
    expect(inspectionActionForTabUpdate({ status: 'complete' }, true)).toBe('refresh');
    expect(inspectionActionForTabUpdate({ url: 'https://example.com/next' }, true)).toBe('reset');
    expect(inspectionActionForTabUpdate({ status: 'complete' }, false)).toBe('none');
  });
});
