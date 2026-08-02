import type { SelectedElementInfo } from '../../shared/types';
import { Accordion } from './UI';

export function StructureSection({ selection }: { selection: SelectedElementInfo }) {
  return (
    <div className="section-stack section-stack--advanced">
      <div className="section-label">Advanced</div>
      <Accordion title="Structure" description="HTMLとアクセシビリティの詳細">
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
          <span>Text preview</span>
          <p>{selection.text || 'テキストは含まれていません。'}</p>
        </div>
        <div className="code-block">
          <span>HTML summary</span>
          <code>{selection.htmlSummary}</code>
        </div>
      </Accordion>
    </div>
  );
}
