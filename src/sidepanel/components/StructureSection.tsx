import type { SelectedElementInfo } from '../../shared/types';
import { Accordion } from './UI';
import { useI18n } from '../i18n';

export function StructureSection({ selection }: { selection: SelectedElementInfo }) {
  const { t } = useI18n();
  return (
    <div className="section-stack section-stack--advanced">
      <div className="section-label">{t('section.advanced')}</div>
      <Accordion title={t('section.structure')} description={t('section.structureHelp')}>
        <dl className="definition-list">
          <div>
            <dt>HTML tag</dt>
            <dd>
              <code>&lt;{selection.tagName}&gt;</code>
            </dd>
          </div>
          <div>
            <dt>ARIA role</dt>
            <dd>
              <code>{selection.role ?? '—'}</code>
            </dd>
          </div>
          <div>
            <dt>ID</dt>
            <dd>
              <code>{selection.id ?? '—'}</code>
            </dd>
          </div>
          <div>
            <dt>Class</dt>
            <dd>
              <code>{selection.classNames.join(' ') || '—'}</code>
            </dd>
          </div>
          <div>
            <dt>CSS Selector</dt>
            <dd>
              <code>{selection.cssSelector}</code>
            </dd>
          </div>
        </dl>
        <div className="code-block">
          <span>{t('structure.text')}</span>
          <p>{selection.text || t('structure.noText')}</p>
        </div>
        <div className="code-block">
          <span>{t('structure.html')}</span>
          <code>{selection.htmlSummary}</code>
        </div>
      </Accordion>
    </div>
  );
}
