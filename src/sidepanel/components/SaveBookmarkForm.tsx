import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMediaTime } from '../../shared/media-utils';
import { ExtensionRuntimeError, sendRuntimeMessage } from '../../shared/messages';
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
import { isCapturePermissionError, requestCaptureAccess } from '../host-permissions';
import { categoryLabel, useI18n } from '../i18n';

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

const captureModes: VideoCaptureMode[] = ['current-frame', 'video-player', 'selected-element'];

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
  const { locale, t } = useI18n();
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
  const [needsCapturePermission, setNeedsCapturePermission] = useState(false);
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
      setError(t('detail.titleRequired'));
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
      if (
        (caught instanceof ExtensionRuntimeError &&
          caught.code === 'CAPTURE_PERMISSION_REQUIRED') ||
        isCapturePermissionError(caught)
      ) {
        setNeedsCapturePermission(true);
        setError(null);
      } else {
        setError(caught instanceof Error ? caught.message : 'ブックマークを保存できませんでした。');
      }
    } finally {
      setSaving(false);
    }
  };

  const grantCapturePermissionAndSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const granted = await requestCaptureAccess();
      if (!granted) {
        setError(t('capturePermission.denied'));
        return;
      }
      setNeedsCapturePermission(false);
      await save();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('capturePermission.denied'));
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
          <div className="section-label">{t('save.eyebrow')}</div>
          <h2 id="save-bookmark-title">{isVideo ? t('save.videoTitle') : t('save.title')}</h2>
        </div>
        <span>
          {selection.viewportRect.width} × {selection.viewportRect.height}
        </span>
      </div>

      {selection.media ? (
        <section className="video-capture-settings" aria-labelledby="video-settings-title">
          <div className="video-settings__head">
            <div>
              <span className="video-badge">{t('inspect.video')}</span>
              <h3 id="video-settings-title">{t('save.range')}</h3>
            </div>
            <code>
              {formatMediaTime(selection.media.currentTime)}
              {selection.media.duration === null
                ? ''
                : ` / ${formatMediaTime(selection.media.duration)}`}
            </code>
          </div>
          <div className="capture-mode-list">
            {captureModes.map((mode) => {
              const labelKey =
                mode === 'current-frame'
                  ? 'save.currentFrame'
                  : mode === 'video-player'
                    ? 'save.player'
                    : 'save.selected';
              const helpKey =
                mode === 'current-frame'
                  ? 'save.currentFrameHelp'
                  : mode === 'video-player'
                    ? 'save.playerHelp'
                    : 'save.selectedHelp';
              return (
                <label key={mode} className="capture-mode">
                  <input
                    type="radio"
                    name="capture-mode"
                    value={mode}
                    checked={captureMode === mode}
                    onChange={() => void changeCaptureMode(mode)}
                  />
                  <span>
                    <strong>{t(labelKey)}</strong>
                    <small>{t(helpKey)}</small>
                  </span>
                </label>
              );
            })}
          </div>
          {capturePreview ? (
            <div className="capture-preview">
              <div>
                <span>{t('save.outlined')}</span>
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
                  {t('inspect.parent')}
                </Button>
                <Button
                  disabled={!capturePreview.canSelectChild}
                  onClick={() => void moveCaptureTarget('child')}
                >
                  {t('inspect.child')}
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
              <strong>{t('save.pause')}</strong>
              <small>{t('save.pauseHelp')}</small>
            </span>
          </label>
          <label className="setting-toggle">
            <input
              type="checkbox"
              checked={includePlayerControls}
              onChange={(event) => setIncludePlayerControls(event.target.checked)}
            />
            <span>
              <strong>{t('save.controls')}</strong>
              <small>{t('save.controlsHelp')}</small>
            </span>
          </label>
        </section>
      ) : null}

      {pendingProtected ? (
        <div className="protected-warning" role="alert">
          <strong>{t('save.protectedTitle')}</strong>
          <p>{t('save.protectedDescription')}</p>
          <div>
            <Button onClick={() => void resolveProtectedContent('player-ui')} disabled={saving}>
              {t('save.playerOnly')}
            </Button>
            <Button onClick={() => void resolveProtectedContent('placeholder')} disabled={saving}>
              {t('save.placeholder')}
            </Button>
            <Button onClick={() => void resolveProtectedContent('cancel')} disabled={saving}>
              {t('save.cancelProtected')}
            </Button>
          </div>
        </div>
      ) : null}

      <label className="field">
        <span>{t('field.title')}</span>
        <input
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          autoFocus={!isVideo}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>{t('field.category')}</span>
          <select
            value={draft.category}
            onChange={(event) =>
              setDraft({ ...draft, category: event.target.value as BookmarkCategory })
            }
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {categoryLabel(category, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('field.tags')}</span>
          <input
            value={tagText}
            onChange={(event) => setTagText(event.target.value)}
            placeholder="saas, clean"
          />
        </label>
      </div>
      <label className="field">
        <span>{t('field.memo')}</span>
        <textarea
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
          placeholder={t('field.memoPlaceholder')}
          rows={3}
        />
      </label>
      {needsCapturePermission ? (
        <div className="capture-permission" role="alert">
          <strong>{t('capturePermission.title')}</strong>
          <p>{t('capturePermission.description')}</p>
          <div>
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void grantCapturePermissionAndSave()}
            >
              {saving ? t('save.capture') : t('capturePermission.action')}
            </Button>
            <Button
              disabled={saving}
              onClick={() => {
                setNeedsCapturePermission(false);
                setError(t('capturePermission.denied'));
              }}
            >
              {t('capturePermission.notNow')}
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!pendingProtected && !needsCapturePermission ? (
        <div className="form-actions">
          <Button onClick={() => void cancelForm()} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? t('save.capture') : isVideo ? t('save.videoTitle') : t('inspect.save')}
          </Button>
        </div>
      ) : null}
      <p className="privacy-note">{isVideo ? t('save.videoPrivacy') : t('save.privacy')}</p>
    </section>
  );
}
