import { useCallback, useEffect, useState } from 'react';
import type { SupportedLocale, ThemePreference } from '../../shared/types';
import { hasAllSitesAccess, removeAllSitesAccess, requestCaptureAccess } from '../host-permissions';
import { useI18n } from '../i18n';
import { Button, Notice } from '../components/UI';

const locales: Array<{ value: SupportedLocale; nativeLabel: string }> = [
  { value: 'ja', nativeLabel: '日本語' },
  { value: 'en', nativeLabel: 'English' },
  { value: 'zh', nativeLabel: '简体中文' },
];

const themes: ThemePreference[] = ['system', 'light', 'dark'];

export function SettingsPage({
  locale,
  theme,
  onLocale,
  onTheme,
}: {
  locale: SupportedLocale;
  theme: ThemePreference;
  onLocale: (locale: SupportedLocale) => void;
  onTheme: (theme: ThemePreference) => void;
}) {
  const { t } = useI18n();
  const [allSitesEnabled, setAllSitesEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      setAllSitesEnabled(await hasAllSitesAccess());
    } catch (caught) {
      setStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : t('settings.loadError'),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const listener = () => void refresh();
    void refresh();
    chrome.permissions.onAdded.addListener(listener);
    chrome.permissions.onRemoved.addListener(listener);
    return () => {
      chrome.permissions.onAdded.removeListener(listener);
      chrome.permissions.onRemoved.removeListener(listener);
    };
  }, [refresh]);

  const allowAllSites = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const granted = await requestCaptureAccess();
      if (!granted) {
        setStatus({ tone: 'error', text: t('settings.permissionDenied') });
        return;
      }
      setAllSitesEnabled(true);
      setStatus({ tone: 'success', text: t('settings.allSitesEnabled') });
    } catch (caught) {
      setStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : t('settings.permissionDenied'),
      });
    } finally {
      setBusy(false);
    }
  };

  const revertToPerSiteAccess = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const removed = await removeAllSitesAccess();
      if (!removed) {
        setStatus({ tone: 'error', text: t('settings.removeError') });
        return;
      }
      setAllSitesEnabled(false);
      setStatus({ tone: 'success', text: t('settings.perSiteEnabled') });
    } catch (caught) {
      setStatus({
        tone: 'error',
        text: caught instanceof Error ? caught.message : t('settings.removeError'),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page settings-page">
      <header className="settings-heading">
        <div className="section-label">{t('settings.eyebrow')}</div>
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.description')}</p>
      </header>

      {status ? <Notice tone={status.tone}>{status.text}</Notice> : null}

      <section className="settings-section" aria-labelledby="appearance-title">
        <div className="settings-section__head">
          <div>
            <h2 id="appearance-title">{t('settings.appearance')}</h2>
            <p>{t('settings.appearanceDescription')}</p>
          </div>
        </div>

        <div className="preference-field">
          <div>
            <strong>{t('settings.language')}</strong>
            <p>{t('settings.languageDescription')}</p>
          </div>
          <div className="preference-options preference-options--language">
            {locales.map((item) => (
              <button
                key={item.value}
                className={locale === item.value ? 'is-selected' : ''}
                aria-pressed={locale === item.value}
                onClick={() => onLocale(item.value)}
              >
                <span>{item.nativeLabel}</span>
                <small>{t(`settings.language.${item.value}`)}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="preference-field">
          <div>
            <strong>{t('settings.theme')}</strong>
            <p>{t('settings.themeDescription')}</p>
          </div>
          <div className="preference-options preference-options--theme">
            {themes.map((item) => (
              <button
                key={item}
                className={theme === item ? 'is-selected' : ''}
                aria-pressed={theme === item}
                onClick={() => onTheme(item)}
              >
                <span className={`theme-preview theme-preview--${item}`} aria-hidden="true">
                  <i />
                  <i />
                </span>
                <strong>{t(`settings.theme.${item}`)}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="site-access-title">
        <div className="settings-section__head">
          <div>
            <h2 id="site-access-title">{t('settings.siteAccess')}</h2>
            <p>{t('settings.siteAccessDescription')}</p>
          </div>
          <span className={`permission-status ${allSitesEnabled ? 'is-enabled' : ''}`}>
            {loading
              ? t('settings.checking')
              : allSitesEnabled
                ? t('settings.allSites')
                : t('settings.perSite')}
          </span>
        </div>

        <div className="permission-choice">
          <div>
            <strong>
              {allSitesEnabled ? t('settings.allSitesTitle') : t('settings.perSiteTitle')}
            </strong>
            <p>
              {allSitesEnabled
                ? t('settings.allSitesDescription')
                : t('settings.perSiteDescription')}
            </p>
          </div>
          {allSitesEnabled ? (
            <Button disabled={busy || loading} onClick={() => void revertToPerSiteAccess()}>
              {busy ? t('settings.updating') : t('settings.usePerSite')}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={busy || loading}
              onClick={() => void allowAllSites()}
            >
              {busy ? t('settings.updating') : t('settings.allowAllSites')}
            </Button>
          )}
        </div>
      </section>

      <section className="settings-section settings-section--plain">
        <h2>{t('settings.privacy')}</h2>
        <p>{t('settings.privacyDescription')}</p>
        <ul>
          <li>{t('settings.privacyLocal')}</li>
          <li>{t('settings.privacyOnDemand')}</li>
          <li>{t('settings.privacyRevoke')}</li>
        </ul>
      </section>
    </div>
  );
}
