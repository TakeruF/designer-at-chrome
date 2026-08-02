import { useState } from 'react';
import { explainProperty } from '../../shared/glossary';
import type { BoxEdges, ColorValue, ComputedStyleInfo } from '../../shared/types';
import { CopyIcon } from './Icons';
import { Accordion, Button } from './UI';

interface PropertyRowProps {
  label: string;
  value: string;
  propertyName?: string;
}

function PropertyRow({ label, value, propertyName = label }: PropertyRowProps) {
  return (
    <div className="property-row">
      <div className="property-row__line">
        <span className="property-row__label">{label}</span>
        <code>{value || '—'}</code>
      </div>
      <p>{explainProperty(propertyName, value)}</p>
    </div>
  );
}

function ColorRow({ label, color }: { label: string; color: ColorValue }) {
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
        <code>{color.hex ?? 'Not convertible'}</code>
        <small>
          {color.css}
          {color.alpha < 1 ? ` · ${Math.round(color.alpha * 100)}% opacity` : ''}
        </small>
      </div>
      <Button
        variant="icon"
        aria-label={`${label}の色をコピー`}
        title={copied ? 'Copied' : 'Copy color'}
        onClick={() => void copy()}
      >
        <CopyIcon />
      </Button>
    </div>
  );
}

function BoxRows({ name, values }: { name: 'margin' | 'padding'; values: BoxEdges }) {
  return (
    <div className="box-values">
      <div className="box-values__head">
        <span>{name}</span>
        <small>{explainProperty(name)}</small>
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
  const { typography, colors, spacing, appearance, layout } = style;
  return (
    <div className="section-stack">
      <div className="section-label">Design details</div>
      <Accordion title="Typography" description="文字の階層と読みやすさ" defaultOpen>
        <PropertyRow label="font-family" value={typography.fontFamily} />
        <PropertyRow label="font-size" value={typography.fontSize} />
        <PropertyRow label="font-weight" value={typography.fontWeight} />
        <PropertyRow label="line-height" value={typography.lineHeight} />
        <PropertyRow label="letter-spacing" value={typography.letterSpacing} />
        <PropertyRow label="text-align" value={typography.textAlign} />
      </Accordion>
      <Accordion title="Colors" description="役割ごとの色と透明度">
        <div className="color-list">
          <ColorRow label="Text" color={colors.text} />
          <ColorRow label="Background" color={colors.background} />
          <ColorRow label="Border" color={colors.border} />
        </div>
      </Accordion>
      <Accordion title="Spacing" description="外側・内側・要素間の余白">
        <BoxRows name="margin" values={spacing.margin} />
        <BoxRows name="padding" values={spacing.padding} />
        <PropertyRow label="row-gap" propertyName="gap" value={spacing.rowGap} />
        <PropertyRow label="column-gap" propertyName="gap" value={spacing.columnGap} />
      </Accordion>
      <Accordion title="Layout" description="配置方式と子要素の整列">
        <PropertyRow label="display" value={layout.display} />
        <PropertyRow label="position" value={layout.position} />
        <PropertyRow label="flex-direction" value={layout.flexDirection} />
        <PropertyRow label="justify-content" value={layout.justifyContent} />
        <PropertyRow label="align-items" value={layout.alignItems} />
        <PropertyRow label="grid-template-columns" value={layout.gridTemplateColumns} />
        <PropertyRow label="overflow" value={layout.overflow} />
        <PropertyRow label="z-index" value={layout.zIndex} />
      </Accordion>
      <Accordion title="Appearance" description="境界・角丸・影・透明度">
        <PropertyRow label="border" value={appearance.border} />
        <PropertyRow label="border-radius" value={appearance.borderRadius} />
        <PropertyRow label="box-shadow" value={appearance.boxShadow} />
        <PropertyRow label="opacity" value={appearance.opacity} />
      </Accordion>
    </div>
  );
}
