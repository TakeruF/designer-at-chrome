import { useState } from 'react';
import { formatMediaTime } from '../../shared/media-utils';
import { sendRuntimeMessage } from '../../shared/messages';
import type { DesignBookmark, SelectedElementInfo } from '../../shared/types';
import { SaveBookmarkForm } from '../components/SaveBookmarkForm';
import { StructureSection } from '../components/StructureSection';
import { StyleSections } from '../components/StyleSections';
import { Button, EmptyState, Notice } from '../components/UI';

function confidenceLabel(value: number): string {
  if (value >= 0.85) return 'High confidence';
  if (value >= 0.6) return 'Likely match';
  return 'Best guess';
}

export function InspectPage({
  selection,
  error: initialError,
  onSelection,
  onSaved,
}: {
  selection: SelectedElementInfo | null;
  error: string | null;
  onSelection: (selection: SelectedElementInfo) => void;
  onSaved: (bookmark: DesignBookmark) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);

  const request = async (type: 'START_SELECTION' | 'RESELECT_ELEMENT') => {
    setBusy(true);
    setError(null);
    try {
      await sendRuntimeMessage<void>({ type });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '要素選択を開始できませんでした。');
    } finally {
      setBusy(false);
    }
  };

  const move = async (direction: 'parent' | 'child') => {
    setError(null);
    try {
      const next = await sendRuntimeMessage<SelectedElementInfo>({
        type: 'MOVE_SELECTION',
        direction,
      });
      onSelection(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '選択範囲を変更できませんでした。');
    }
  };

  if (!selection) {
    return (
      <div className="page page--empty">
        {initialError || error ? <Notice tone="error">{error ?? initialError}</Notice> : null}
        <EmptyState
          title="Learn from any interface"
          description="ページ上の要素を選ぶと、役割・タイポグラフィ・色・余白・レイアウトを分解して表示します。"
          action={
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => void request('START_SELECTION')}
            >
              {busy ? 'Starting…' : 'Select element'}
            </Button>
          }
        />
        <div className="shortcut-hint">
          <kbd>Esc</kbd>
          <span>選択モードを終了</span>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="selection-actions" aria-label="選択範囲の操作">
        <Button onClick={() => void move('parent')}>Select parent</Button>
        <Button onClick={() => void move('child')}>Select child</Button>
        <Button onClick={() => void request('RESELECT_ELEMENT')}>Reselect</Button>
      </div>

      <section className="summary" aria-labelledby="selection-name">
        <div className="summary__eyebrow">
          <span className="status-dot" /> Selected element
          {selection.media ? <span className="video-badge">Video Content</span> : null}
        </div>
        <h1 id="selection-name">{selection.pattern.name}</h1>
        <div className="summary__japanese">{selection.pattern.japaneseName}</div>
        <p className="summary__description">{selection.pattern.description}</p>
        <div className="confidence">
          <div className="confidence__line">
            <span>{confidenceLabel(selection.pattern.confidence)}</span>
            <strong>{Math.round(selection.pattern.confidence * 100)}%</strong>
          </div>
          <div className="confidence__track">
            <span style={{ width: `${selection.pattern.confidence * 100}%` }} />
          </div>
        </div>
        <ul className="reason-list">
          {selection.pattern.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div className="summary__facts">
          <div>
            <span>Size</span>
            <strong>
              {Math.round(selection.width)} × {Math.round(selection.height)}
            </strong>
          </div>
          <div>
            <span>Font</span>
            <strong>
              {selection.computedStyle.typography.fontSize} /{' '}
              {selection.computedStyle.typography.fontWeight}
            </strong>
          </div>
          {selection.media ? (
            <>
              <div>
                <span>At selection</span>
                <strong>
                  {formatMediaTime(selection.media.currentTime)}
                  {selection.media.duration === null
                    ? ''
                    : ` / ${formatMediaTime(selection.media.duration)}`}
                </strong>
              </div>
              <div>
                <span>Video source</span>
                <strong>
                  {selection.media.videoWidth || '—'} × {selection.media.videoHeight || '—'}
                  {selection.media.paused ? ' · Paused' : ' · Playing'}
                </strong>
              </div>
            </>
          ) : null}
          <div className="summary__color">
            <span>Primary color</span>
            <strong>
              <i style={{ backgroundColor: selection.computedStyle.colors.text.css }} />
              {selection.computedStyle.colors.text.hex ?? selection.computedStyle.colors.text.css}
            </strong>
          </div>
        </div>
      </section>

      {showSave ? (
        <SaveBookmarkForm
          selection={selection}
          onCancel={() => setShowSave(false)}
          onSaved={onSaved}
        />
      ) : (
        <Button variant="primary" className="save-button" onClick={() => setShowSave(true)}>
          {selection.media ? 'Save video frame' : 'Save bookmark'}
        </Button>
      )}

      <StyleSections style={selection.computedStyle} />
      <StructureSection selection={selection} />
    </div>
  );
}
