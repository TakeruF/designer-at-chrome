import { toColorValue } from './color-utils';
import { collectFontFamilies } from './font-utils';
import type { BoxEdges, ComputedStyleInfo } from './types';

const edges = (style: CSSStyleDeclaration, prefix: 'margin' | 'padding'): BoxEdges => ({
  top: style.getPropertyValue(`${prefix}-top`),
  right: style.getPropertyValue(`${prefix}-right`),
  bottom: style.getPropertyValue(`${prefix}-bottom`),
  left: style.getPropertyValue(`${prefix}-left`),
});

export function extractComputedStyle(element: Element): ComputedStyleInfo {
  const style = getComputedStyle(element);
  return {
    typography: {
      fontFamilies: collectFontFamilies(element),
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textAlign: style.textAlign,
      color: toColorValue(style.color),
    },
    colors: {
      text: toColorValue(style.color),
      background: toColorValue(style.backgroundColor),
      border: toColorValue(style.borderColor),
    },
    spacing: {
      margin: edges(style, 'margin'),
      padding: edges(style, 'padding'),
      rowGap: style.rowGap,
      columnGap: style.columnGap,
    },
    appearance: {
      border: style.border,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      opacity: style.opacity,
    },
    layout: {
      display: style.display,
      position: style.position,
      flexDirection: style.flexDirection,
      justifyContent: style.justifyContent,
      alignItems: style.alignItems,
      gridTemplateColumns: style.gridTemplateColumns,
      overflow: style.overflow,
      zIndex: style.zIndex,
    },
  };
}
