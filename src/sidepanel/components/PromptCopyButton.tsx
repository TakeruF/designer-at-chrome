import { useEffect, useState } from 'react';
import { CopyIcon } from './Icons';
import { Button } from './UI';
import { useI18n } from '../i18n';

type CopyState = 'idle' | 'copied' | 'error';

export function PromptCopyButton({
  prompt,
  short = false,
  className = '',
}: {
  prompt: string;
  short?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<CopyState>('idle');

  useEffect(() => {
    if (state === 'idle') return;
    const timeout = window.setTimeout(() => setState('idle'), 2200);
    return () => window.clearTimeout(timeout);
  }, [state]);

  const label =
    state === 'copied'
      ? t('prompt.copied')
      : state === 'error'
        ? t('prompt.copyError')
        : short
          ? t('prompt.copyShort')
          : t('prompt.copy');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setState('copied');
    } catch {
      setState('error');
    }
  };

  return (
    <Button
      className={`prompt-copy-button ${state === 'copied' ? 'is-copied' : ''} ${className}`.trim()}
      aria-label={label}
      title={t('prompt.help')}
      onClick={() => void copy()}
    >
      <CopyIcon />
      <span>{label}</span>
    </Button>
  );
}
