import type { SupportedLocale } from './types';

const glossary: Record<SupportedLocale, Record<string, string>> = {
  ja: {
    'font-family': '文字の書体です。先頭から利用可能なフォントが選ばれます。',
    'font-size': '文字の大きさです。',
    'font-weight': '文字の太さです。400が標準、700が太字の目安です。',
    'line-height': '行と行の間隔を含む、1行分の高さです。',
    'letter-spacing': '文字同士の間隔です。',
    'text-align': '行の中で文字をどこに揃えるかを指定します。',
    color: '文字に使われる色です。',
    'background-color': '要素の背景に使われる色です。',
    'border-color': '境界線に使われる色です。',
    margin: '要素の外側に確保される余白です。',
    padding: '要素の内側、内容との間に確保される余白です。',
    gap: '行や列として並ぶ子要素同士の間隔です。',
    border: '要素の境界線の太さ、種類、色です。',
    'border-radius': '角の丸みです。値が大きいほど丸くなります。',
    'box-shadow': '要素の周囲に描画される影です。',
    opacity: '要素全体の透明度です。1が不透明、0が透明です。',
    display: '要素と子要素をどのレイアウト方式で配置するかを決めます。',
    position: '要素を通常の流れ、固定、追従などのどの方法で配置するかを決めます。',
    'flex-direction': 'Flexboxで子要素を並べる方向です。',
    'justify-content': '主軸方向で子要素をどう分配するかを指定します。',
    'align-items': '交差軸方向で子要素をどう揃えるかを指定します。',
    'grid-template-columns': 'Gridレイアウトの列幅と列数です。',
    overflow: '内容が要素の領域からはみ出したときの扱いです。',
    'z-index': '重なり順です。大きい値ほど手前に表示されます。',
  },
  en: {
    'font-family': 'The typeface stack. The browser uses the first available font.',
    'font-size': 'The rendered size of the text.',
    'font-weight': 'The thickness of the text; 400 is regular and 700 is typically bold.',
    'line-height': 'The height of each line, including space between lines.',
    'letter-spacing': 'The amount of space between characters.',
    'text-align': 'Where text is aligned within each line.',
    color: 'The color used to render text.',
    'background-color': 'The color painted behind the element.',
    'border-color': 'The color used for the element border.',
    margin: 'Space outside the element.',
    padding: 'Space inside the element between its edge and content.',
    gap: 'Space between children arranged in rows or columns.',
    border: 'The width, style, and color of the element boundary.',
    'border-radius': 'How rounded the corners are.',
    'box-shadow': 'The shadow painted around the element.',
    opacity: 'Transparency of the entire element; 1 is opaque and 0 is transparent.',
    display: 'The layout model used for the element and its children.',
    position: 'How the element is placed in normal flow or relative to the viewport.',
    'flex-direction': 'The direction children flow in Flexbox.',
    'justify-content': 'How children are distributed along the main axis.',
    'align-items': 'How children align along the cross axis.',
    'grid-template-columns': 'The number and size of columns in a grid.',
    overflow: 'What happens when content extends beyond the element.',
    'z-index': 'The stacking order; larger values usually appear in front.',
  },
};

export function explainProperty(name: string, value = '', locale: SupportedLocale = 'ja'): string {
  if (name === 'display' && value === 'flex')
    return locale === 'ja'
      ? '子要素をFlexboxで配置しています。'
      : 'Children are arranged with Flexbox.';
  if (name === 'display' && value === 'grid')
    return locale === 'ja'
      ? '子要素を行と列のGridで配置しています。'
      : 'Children are arranged in grid rows and columns.';
  if (name === 'position' && value === 'sticky')
    return locale === 'ja'
      ? 'スクロール中、指定位置に達するとその位置に留まる要素です。'
      : 'The element stays at a specified position while scrolling.';
  if (name === 'position' && value === 'fixed')
    return locale === 'ja'
      ? 'viewportを基準に固定され、スクロールしても同じ位置に表示されます。'
      : 'The element stays fixed to the viewport while scrolling.';
  return (
    glossary[locale][name] ??
    (locale === 'ja'
      ? 'ブラウザが最終的に適用したCSSの値です。'
      : 'The final computed CSS value used by the browser.')
  );
}
