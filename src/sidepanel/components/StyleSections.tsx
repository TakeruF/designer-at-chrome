import { useState } from 'react';
import { explainProperty } from '../../shared/glossary';
import type { BoxEdges, ColorValue, ComputedStyleInfo } from '../../shared/types';
import { CopyIcon } from './Icons';
import { Accordion, Button } from './UI';
import { useI18n } from '../i18n';

interface PropertyRowProps {
  label: string;
  value: string;
  propertyName?: string;
}

function PropertyRow({ label, value, propertyName = label }: PropertyRowProps) {
  const { locale } = useI18n();
  return (
    <div className="property-row">
      <div className="property-row__line">
        <span className="property-row__label">{label}</span>
        <code>{value || '—'}</code>
      </div>
      <p>{explainProperty(propertyName, value, locale)}</p>
    </div>
  );
}

function ColorRow({ label, color }: { label: string; color: ColorValue }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(color.hex ?? color.css);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div className="color-row">
      <span
        className="color-row__swatch"
        style={{ backgroundColor: color.css }}
        aria-hidden="true"
      />
      <div className="color-row__value">
        <span>{label}</span>
        <code>{color.hex ?? t('common.notConvertible')}</code>
        <small>
          {color.css}
          {color.alpha < 1
            ? ` · ${t('color.opacity', { value: Math.round(color.alpha * 100) })}`
            : ''}
        </small>
      </div>
      <Button
        variant="icon"
        aria-label={`${t('common.copy')}: ${label}`}
        title={copied ? t('common.copied') : t('common.copy')}
        onClick={() => void copy()}
      >
        <CopyIcon />
      </Button>
    </div>
  );
}

function BoxRows({ name, values }: { name: 'margin' | 'padding'; values: BoxEdges }) {
  const { locale } = useI18n();
  return (
    <div className="box-values">
      <div className="box-values__head">
        <span>{name}</span>
        <small>{explainProperty(name, '', locale)}</small>
      </div>
      <div className="box-values__grid">
        {(['top', 'right', 'bottom', 'left'] as const).map((edge) => (
          <div key={edge}>
            <span>{edge}</span>
            <code>{values[edge]}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StyleSections({ style }: { style: ComputedStyleInfo }) {
  const { t } = useI18n();
  const { typography, colors, spacing, appearance, layout } = style;
  return (
    <div className="section-stack">
      <div className="section-label">{t('section.designDetails')}</div>
      <Accordion
        title={t('section.typography')}
        description={t('section.typographyHelp')}
        defaultOpen
      >
        <PropertyRow label="font-family" value={typography.fontFamily} />
        <PropertyRow label="font-size" value={typography.fontSize} />
        <PropertyRow label="font-weight" value={typography.fontWeight} />
        <PropertyRow label="line-height" value={typography.lineHeight} />
        <PropertyRow label="letter-spacing" value={typography.letterSpacing} />
        <PropertyRow label="text-align" value={typography.textAlign} />
      </Accordion>
      <Accordion title={t('section.colors')} description={t('section.colorsHelp')}>
        <div className="color-list">
          <ColorRow label={t('color.text')} color={colors.text} />
          <ColorRow label={t('color.background')} color={colors.background} />
          <ColorRow label={t('color.border')} color={colors.border} />
        </div>
      </Accordion>
      <Accordion title={t('section.spacing')} description={t('section.spacingHelp')}>
        <BoxRows name="margin" values={spacing.margin} />
        <BoxRows name="padding" values={spacing.padding} />
        <PropertyRow label="row-gap" propertyName="gap" value={spacing.rowGap} />
        <PropertyRow label="column-gap" propertyName="gap" value={spacing.columnGap} />
      </Accordion>
      <Accordion title={t('section.layout')} description={t('section.layoutHelp')}>
        <PropertyRow label="display" value={layout.display} />
        <PropertyRow label="position" value={layout.position} />
        <PropertyRow label="flex-direction" value={layout.flexDirection} />
        <PropertyRow label="justify-content" value={layout.justifyContent} />
        <PropertyRow label="align-items" value={layout.alignItems} />
        <PropertyRow label="grid-template-columns" value={layout.gridTemplateColumns} />
        <PropertyRow label="overflow" value={layout.overflow} />
        <PropertyRow label="z-index" value={layout.zIndex} />
      </Accordion>
      <Accordion title={t('section.appearance')} description={t('section.appearanceHelp')}>
        <PropertyRow label="border" value={appearance.border} />
        <PropertyRow label="border-radius" value={appearance.borderRadius} />
        <PropertyRow label="box-shadow" value={appearance.boxShadow} />
        <PropertyRow label="opacity" value={appearance.opacity} />
      </Accordion>
    </div>
  );
}
