import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMediaTime } from '../../shared/media-utils';
import { sendRuntimeMessage } from '../../shared/messages';
import type {
  BookmarkCategory,
  BookmarkDraft,
  CaptureStoredResult,
  CaptureTargetPreview,
  DesignBookmark,
  ProtectedContentHandling,
  SelectedElementInfo,
  VideoCaptureMode,
  VideoCaptureOptions,
} from '../../shared/types';
import { addBookmark } from '../../storage/bookmark-storage';
import { deleteScreenshot } from '../../storage/screenshot-db';
import { Button, Notice } from './UI';

const categories: BookmarkCategory[] = [
  'Header',
  'Hero',
  'Navigation',
  'Button',
  'Card',
  'Form',
  'Modal',
  'Footer',
  'Typography',
  'Other',
];

const captureModes: Array<{
  value: VideoCaptureMode;
  label: string;
  description: string;
}> = [
  {
    value: 'current-frame',
    label: 'Current frame',
    description: 'video要素の表示領域だけ',
  },
  {
    value: 'video-player',
    label: 'Video player',
    description: '動画とカスタムコントロール',
  },
  {
    value: 'selected-element',
    label: 'Entire selected element',
    description: '現在選択中のセクション全体',
  },
];

function initialCategory(pattern: string): BookmarkCategory {
  if (/header/i.test(pattern)) return 'Header';
  if (/hero/i.test(pattern)) return 'Hero';
  if (/navigation|breadcrumb|tabs/i.test(pattern)) return 'Navigation';
  if (/button/i.test(pattern)) return 'Button';
  if (/card|list item/i.test(pattern)) return 'Card';
  if (/field|select|checkbox|radio|search|form/i.test(pattern)) return 'Form';
  if (/modal|dialog|drawer|sheet/i.test(pattern)) return 'Modal';
  if (/footer/i.test(pattern)) return 'Footer';
  return 'Other';
}

export function SaveBookmarkForm({
  selection,
  onCancel,
  onSaved,
}: {
  selection: SelectedElementInfo;
  onCancel: () => void;
  onSaved: (bookmark: DesignBookmark) => void;
}) {
  const domain = useMemo(() => {
    try {
      return new URL(selection.pageUrl).hostname;
    } catch {
      return selection.pageTitle;
    }
  }, [selection.pageTitle, selection.pageUrl]);
  const [draft, setDraft] = useState<BookmarkDraft>({
    title: `${selection.pattern.name} · ${domain}`,
    category: initialCategory(selection.pattern.name),
    tags: [],
    note: '',
  });
  const [tagText, setTagText] = useState('');
  const [captureMode, setCaptureMode] = useState<VideoCaptureMode>('current-frame');
  const [pauseWhileCapturing, setPauseWhileCapturing] = useState(true);
  const [includePlayerControls, setIncludePlayerControls] = useState(true);
  const [capturePreview, setCapturePreview] = useState<CaptureTargetPreview | null>(null);
  const [pendingProtected, setPendingProtected] = useState<{ id: string } | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isVideo = selection.media !== null;

  useEffect(() => {
    let active = true;
    if (selection.media) {
      void sendRuntimeMessage<CaptureTargetPreview>({
        type: 'SET_CAPTURE_TARGET',
        captureMode: 'current-frame',
      })
        .then((preview) => {
          if (active) setCapturePreview(preview);
        })
        .catch((caught: unknown) => {
          if (active)
            setError(caught instanceof Error ? caught.message : '動画の撮影範囲を推定できません。');
        });
    }
    return () => {
      active = false;
      void sendRuntimeMessage<void>({ type: 'CLEAR_CAPTURE_TARGET' }).catch((caught: unknown) =>
        console.error('Failed to clear the video capture outline.', caught),
      );
      if (pendingIdRef.current) {
        void deleteScreenshot(pendingIdRef.current).catch((caught: unknown) =>
          console.error('Failed to remove a pending protected screenshot.', caught),
        );
      }
    };
  }, [selection.media]);

  const changeCaptureMode = async (mode: VideoCaptureMode) => {
    setCaptureMode(mode);
    setError(null);
    try {
      const preview = await sendRuntimeMessage<CaptureTargetPreview>({
        type: 'SET_CAPTURE_TARGET',
        captureMode: mode,
      });
      setCapturePreview(preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '撮影範囲を変更できませんでした。');
    }
  };

  const moveCaptureTarget = async (direction: 'parent' | 'child') => {
    setError(null);
    try {
      const preview = await sendRuntimeMessage<CaptureTargetPreview>({
        type: 'MOVE_CAPTURE_TARGET',
        direction,
      });
      setCapturePreview(preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '撮影範囲を変更できませんでした。');
    }
  };

  const captureOptions = (
    protectedContentHandling: ProtectedContentHandling,
    mode = captureMode,
    controls = includePlayerControls,
  ): VideoCaptureOptions | undefined =>
    isVideo
      ? {
          captureMode: mode,
          pauseWhileCapturing,
          includePlayerControls: controls,
          protectedContentHandling,
        }
      : undefined;

  const persistBookmark = async (id: string, capture: CaptureStoredResult) => {
    const now = new Date().toISOString();
    const bookmark: DesignBookmark = {
      id,
      title: draft.title.trim(),
      category: draft.category,
      tags: tagText
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      note: draft.note.trim(),
      sourceUrl: selection.pageUrl,
      pageTitle: selection.pageTitle,
      faviconUrl: selection.faviconUrl,
      createdAt: now,
      updatedAt: now,
      uiPattern: selection.pattern,
      cssSelector: selection.cssSelector,
      htmlSummary: selection.htmlSummary,
      element: {
        tagName: selection.tagName,
        role: selection.role,
        id: selection.id,
        classNames: selection.classNames,
        text: selection.text,
      },
      style: selection.computedStyle,
      video: capture.videoMetadata ?? undefined,
      screenshot: {
        screenshotId: capture.screenshotId,
        width: capture.width,
        height: capture.height,
        mimeType: 'image/webp',
        clippedToViewport: capture.clippedToViewport,
      },
    };
    try {
      await addBookmark(bookmark);
    } catch (storageError) {
      await deleteScreenshot(id).catch((caught: unknown) =>
        console.error('Failed to roll back a screenshot after bookmark storage failed.', caught),
      );
      throw storageError;
    }
    pendingIdRef.current = null;
    onSaved(bookmark);
  };

  const capture = async (
    id: string,
    handling: ProtectedContentHandling,
    mode = captureMode,
    controls = includePlayerControls,
  ) =>
    sendRuntimeMessage<CaptureStoredResult>({
      type: 'CAPTURE_AND_STORE',
      bookmarkId: id,
      options: captureOptions(handling, mode, controls),
    });

  const save = async () => {
    if (!draft.title.trim()) {
      setError('タイトルを入力してください。');
      return;
    }
    setSaving(true);
    setError(null);
    const id = crypto.randomUUID();
    try {
      const result = await capture(id, 'prompt');
      if (isVideo && result.protectedContentSuspected) {
        pendingIdRef.current = id;
        setPendingProtected({ id });
        return;
      }
      await persistBookmark(id, result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ブックマークを保存できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const resolveProtectedContent = async (choice: 'player-ui' | 'placeholder' | 'cancel') => {
    if (!pendingProtected) return;
    if (choice === 'cancel') {
      try {
        await deleteScreenshot(pendingProtected.id);
        pendingIdRef.current = null;
        setPendingProtected(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '一時画像を削除できませんでした。');
      }
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const mode = choice === 'player-ui' ? 'video-player' : captureMode;
      if (choice === 'player-ui') await changeCaptureMode(mode);
      const result = await capture(
        pendingProtected.id,
        choice,
        mode,
        choice === 'player-ui' ? true : includePlayerControls,
      );
      await persistBookmark(pendingProtected.id, result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '代替画像を保存できませんでした。');
    } finally {
      setSaving(false);
    }
  };

  const cancelForm = async () => {
    if (pendingIdRef.current) {
      try {
        await deleteScreenshot(pendingIdRef.current);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : '一時画像を削除できませんでした。');
        return;
      }
    }
    pendingIdRef.current = null;
    onCancel();
  };

  return (
    <section className="bookmark-form" aria-labelledby="save-bookmark-title">
      <div className="bookmark-form__head">
        <div>
          <div className="section-label">Local bookmark</div>
          <h2 id="save-bookmark-title">{isVideo ? 'Save video design' : 'Save this design'}</h2>
        </div>
        <span>
          {selection.viewportRect.width} × {selection.viewportRect.height}
        </span>
      </div>

      {selection.media ? (
        <section className="video-capture-settings" aria-labelledby="video-settings-title">
          <div className="video-settings__head">
            <div>
              <span className="video-badge">Video Content</span>
              <h3 id="video-settings-title">Capture range</h3>
            </div>
            <code>
              {formatMediaTime(selection.media.currentTime)}
              {selection.media.duration === null
                ? ''
                : ` / ${formatMediaTime(selection.media.duration)}`}
            </code>
          </div>
          <div className="capture-mode-list">
            {captureModes.map((mode) => (
              <label key={mode.value} className="capture-mode">
                <input
                  type="radio"
                  name="capture-mode"
                  value={mode.value}
                  checked={captureMode === mode.value}
                  onChange={() => void changeCaptureMode(mode.value)}
                />
                <span>
                  <strong>{mode.label}</strong>
                  <small>{mode.description}</small>
                </span>
              </label>
            ))}
          </div>
          {capturePreview ? (
            <div className="capture-preview">
              <div>
                <span>Outlined range</span>
                <code>
                  &lt;{capturePreview.tagName}&gt; · {Math.round(capturePreview.rect.width)} ×{' '}
                  {Math.round(capturePreview.rect.height)}
                </code>
              </div>
              <div className="capture-preview__actions">
                <Button
                  disabled={!capturePreview.canSelectParent}
                  onClick={() => void moveCaptureTarget('parent')}
                >
                  Parent
                </Button>
                <Button
                  disabled={!capturePreview.canSelectChild}
                  onClick={() => void moveCaptureTarget('child')}
                >
                  Child
                </Button>
              </div>
            </div>
          ) : null}
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={pauseWhileCapturing}
              onChange={(event) => setPauseWhileCapturing(event.target.checked)}
            />
            <span>
              <strong>Pause while capturing</strong>
              <small>撮影後は元の再生状態へ戻します</small>
            </span>
          </label>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={includePlayerControls}
              onChange={(event) => setIncludePlayerControls(event.target.checked)}
            />
            <span>
              <strong>Include player controls</strong>
              <small>マウス移動イベントで表示を試みます</small>
            </span>
          </label>
        </section>
      ) : null}

      {pendingProtected ? (
        <div className="protected-warning" role="alert">
          <strong>動画フレームを取得できませんでした</strong>
          <p>
            この動画はブラウザまたは配信サービスによって保護されている可能性があります。プレイヤー周辺のUIは保存できます。
          </p>
          <div>
            <Button onClick={() => void resolveProtectedContent('player-ui')} disabled={saving}>
              プレイヤーUIだけ保存
            </Button>
            <Button onClick={() => void resolveProtectedContent('placeholder')} disabled={saving}>
              プレースホルダーで保存
            </Button>
            <Button onClick={() => void resolveProtectedContent('cancel')} disabled={saving}>
              保存をキャンセル
            </Button>
          </div>
        </div>
      ) : null}

      <label className="field">
        <span>Title</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          autoFocus={!isVideo}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Category</span>
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value as BookmarkCategory })
            }
          >
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Tags</span>
          <input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="saas, clean"
          />
        </label>
      </div>
      <label className="field">
        <span>Memo</span>
        <textarea
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          placeholder="このデザインから学びたいこと"
          rows={3}
        />
      </label>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!pendingProtected ? (
        <div className="form-actions">
          <Button onClick={() => void cancelForm()} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Capturing…' : isVideo ? 'Save video design' : 'Save bookmark'}
          </Button>
        </div>
      ) : null}
      <p className="privacy-note">
        {isVideo
          ? '現在フレームの静止画とメタデータだけを保存します。動画URLや動画ファイルは保存しません。'
          : 'Screenshot and metadata stay in this browser.'}
      </p>
    </section>
  );
}
