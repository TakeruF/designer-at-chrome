import { useEffect, useState } from 'react';
import { formatMediaTime } from '../../shared/media-utils';
import { ExtensionRuntimeError, sendRuntimeMessage } from '../../shared/messages';
import { buildSelectionReproductionPrompt } from '../../shared/reproduction-prompt';
import type { DesignBookmark, ExtensionError, SelectedElementInfo } from '../../shared/types';
import { localizedPatternName } from '../../shared/ui-pattern-labels';
import { PromptCopyButton } from '../components/PromptCopyButton';
import { SaveBookmarkForm } from '../components/SaveBookmarkForm';
import { StructureSection } from '../components/StructureSection';
import { StyleSections } from '../components/StyleSections';
import { Button, EmptyState, Notice } from '../components/UI';
import { activeTabHostPattern, requestHostAccess } from '../host-permissions';
import { useI18n } from '../i18n';

function errorFrom(caught: unknown, fallback: string): ExtensionError {
  return {
    code: caught instanceof ExtensionRuntimeError ? caught.code : 'UNKNOWN',
    message: caught instanceof Error ? caught.message : fallback,
  };
}

export function InspectPage({
  selection,
  error: initialError,
  onSelection,
  onError,
  onPermissionGranted,
  onSaved,
}: {
  selection: SelectedElementInfo | null;
  error: ExtensionError | null;
  onSelection: (selection: SelectedElementInfo) => void;
  onError: (error: ExtensionError | null) => void;
  onPermissionGranted: () => Promise<void>;
  onSaved: (bookmark: DesignBookmark) => void;
}) {
  const { locale, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<ExtensionError | null>(null);
  const [showSave, setShowSave] = useState(false);
  const [permissionOrigin, setPermissionOrigin] = useState<string | null>(null);
  const visibleError = localError ?? initialError;

  useEffect(() => {
    let active = true;
    if (visibleError?.code === 'HOST_PERMISSION_REQUIRED') {
      void activeTabHostPattern().then((origin) => {
        if (active) setPermissionOrigin(origin);
      });
    }
    return () => {
      active = false;
    };
  }, [visibleError?.code]);

  const request = async (type: 'START_SELECTION' | 'RESELECT_ELEMENT') => {
    setBusy(true);
    setLocalError(null);
    onError(null);
    try {
      await sendRuntimeMessage<void>({ type });
    } catch (caught) {
      setLocalError(errorFrom(caught, t('error.start')));
    } finally {
      setBusy(false);
    }
  };

  const grantAccess = async () => {
    setBusy(true);
    setLocalError(null);
    try {
      const granted = permissionOrigin ? await requestHostAccess(permissionOrigin) : false;
      if (!granted) {
        setLocalError({ code: 'HOST_PERMISSION_REQUIRED', message: t('permission.denied') });
        return;
      }
      await onPermissionGranted();
      await sendRuntimeMessage<void>({ type: 'START_SELECTION' });
    } catch (caught) {
      setLocalError(errorFrom(caught, t('error.start')));
    } finally {
      setBusy(false);
    }
  };

  const move = async (direction: 'parent' | 'child') => {
    setLocalError(null);
    try {
      const next = await sendRuntimeMessage<SelectedElementInfo>({
        type: 'MOVE_SELECTION',
        direction,
      });
      onSelection(next);
    } catch (caught) {
      setLocalError(errorFrom(caught, t('error.move')));
    }
  };

  if (!selection) {
    const needsPermission = visibleError?.code === 'HOST_PERMISSION_REQUIRED';
    return (
      <div className="page page--empty">
        {needsPermission ? (
          <section className="access-card" aria-labelledby="access-title">
            <div className="access-card__icon" aria-hidden="true">
              <span />
            </div>
            <div>
              <h2 id="access-title">{t('permission.title')}</h2>
              <p>{t('permission.description')}</p>
            </div>
            <Button
              variant="primary"
              disabled={busy || !permissionOrigin}
              onClick={() => void grantAccess()}
            >
              {busy ? t('inspect.starting') : t('permission.action')}
            </Button>
          </section>
        ) : (
          <>
            {visibleError ? (
              <Notice tone="error">
                {visibleError.code === 'RESTRICTED_PAGE'
                  ? t('error.unavailable')
                  : visibleError.message}
              </Notice>
            ) : null}
            <EmptyState
              title={t('inspect.emptyTitle')}
              description={t('inspect.emptyDescription')}
              action={
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => void request('START_SELECTION')}
                >
                  {busy ? t('inspect.starting') : t('inspect.select')}
                </Button>
              }
            />
            <div className="shortcut-hint">
              <kbd>Esc</kbd>
              <span>{t('inspect.escape')}</span>
            </div>
          </>
        )}
      </div>
    );
  }

  const description =
    locale !== 'ja'
      ? (selection.pattern.descriptionEn ?? selection.pattern.description)
      : selection.pattern.description;
  const reasons =
    locale !== 'ja'
      ? (selection.pattern.reasonsEn ?? selection.pattern.reasons)
      : selection.pattern.reasons;
  const confidence =
    selection.pattern.confidence >= 0.85
      ? t('inspect.high')
      : selection.pattern.confidence >= 0.6
        ? t('inspect.likely')
        : t('inspect.guess');
  const localizedName = localizedPatternName(
    selection.pattern.name,
    selection.pattern.japaneseName,
    locale,
  );
  const reproductionPrompt = buildSelectionReproductionPrompt(selection, locale);

  return (
    <div className="page">
      {visibleError ? <Notice tone="error">{visibleError.message}</Notice> : null}
      <div className="selection-actions" aria-label={t('inspect.actions')}>
        <Button onClick={() => void move('parent')}>{t('inspect.parent')}</Button>
        <Button onClick={() => void move('child')}>{t('inspect.child')}</Button>
        <Button onClick={() => void request('RESELECT_ELEMENT')}>{t('inspect.reselect')}</Button>
      </div>

      <section className="summary" aria-labelledby="selection-name">
        <div className="summary__eyebrow">
          <span className="status-dot" /> {t('inspect.selected')}
          {selection.media ? <span className="video-badge">{t('inspect.video')}</span> : null}
        </div>
        <h1 id="selection-name">{selection.pattern.name}</h1>
        {localizedName !== selection.pattern.name ? (
          <div className="summary__japanese">{localizedName}</div>
        ) : null}
        <p className="summary__description">{description}</p>
        <div className="confidence">
          <div className="confidence__line">
            <span>{confidence}</span>
            <strong>{Math.round(selection.pattern.confidence * 100)}%</strong>
          </div>
          <div className="confidence__track">
            <span style={{ width: `${selection.pattern.confidence * 100}%` }} />
          </div>
        </div>
        <ul className="reason-list">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div className="summary__facts">
          <div>
            <span>{t('inspect.size')}</span>
            <strong>
              {Math.round(selection.width)} × {Math.round(selection.height)}
            </strong>
          </div>
          <div>
            <span>{t('inspect.font')}</span>
            <strong>
              {selection.computedStyle.typography.fontSize} /{' '}
              {selection.computedStyle.typography.fontWeight}
            </strong>
          </div>
          {selection.media ? (
            <>
              <div>
                <span>{t('inspect.time')}</span>
                <strong>
                  {formatMediaTime(selection.media.currentTime)}
                  {selection.media.duration === null
                    ? ''
                    : ` / ${formatMediaTime(selection.media.duration)}`}
                </strong>
              </div>
              <div>
                <span>{t('inspect.videoSource')}</span>
                <strong>
                  {selection.media.videoWidth || '—'} × {selection.media.videoHeight || '—'} ·{' '}
                  {selection.media.paused ? t('inspect.paused') : t('inspect.playing')}
                </strong>
              </div>
            </>
          ) : null}
          <div className="summary__color">
            <span>{t('inspect.primaryColor')}</span>
            <strong>
              <i style={{ backgroundColor: selection.computedStyle.colors.text.css }} />
              {selection.computedStyle.colors.text.hex ?? selection.computedStyle.colors.text.css}
            </strong>
          </div>
        </div>
      </section>

      <div className="inspect-primary-actions">
        {!showSave ? (
          <Button variant="primary" className="save-button" onClick={() => setShowSave(true)}>
            {selection.media ? t('inspect.saveVideo') : t('inspect.save')}
          </Button>
        ) : null}
        <PromptCopyButton prompt={reproductionPrompt} />
      </div>
      {showSave ? (
        <SaveBookmarkForm
          selection={selection}
          onCancel={() => setShowSave(false)}
          onSaved={onSaved}
        />
      ) : null}
      <StyleSections style={selection.computedStyle} />
      <StructureSection selection={selection} />
    </div>
  );
}
