import { parseCssColor } from '../shared/color-utils';
import type { UIPatternResult } from '../shared/types';

export interface PatternFeatures {
  tag: string;
  role: string;
  type: string;
  classText: string;
  ariaLabel: string;
  ariaHasPopup: boolean;
  text: string;
  top: number;
  left: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  linkCount: number;
  buttonCount: number;
  headingCount: number;
  imageCount: number;
  inputCount: number;
  hasLogoLikeImage: boolean;
  hasIconChild: boolean;
  hasFilledBackground: boolean;
  display: string;
  position: string;
  flexDirection: string;
  borderRadius: number;
  hasBorder: boolean;
  hasShadow: boolean;
}

interface Candidate {
  name: string;
  japaneseName: string;
  description: string;
  score: number;
  reasons: string[];
}

const patternCopy: Record<string, [string, string]> = {
  Header: ['ヘッダー', 'ページ上部でブランドや主要操作をまとめる領域です。'],
  'Navigation Bar': ['ナビゲーションバー', 'ページ内や他ページへの主要な移動手段です。'],
  'Hero Section': ['ヒーローセクション', 'ページの価値を最初に伝える大きな導入領域です。'],
  Footer: ['フッター', 'ページ末尾の補助リンクや情報をまとめる領域です。'],
  Sidebar: ['サイドバー', '画面端に配置される補助ナビゲーションや情報領域です。'],
  'Primary Button': ['プライマリボタン', '画面で最も重要な操作を促すボタンです。'],
  'Secondary Button': ['セカンダリボタン', '補助的な操作に使われるボタンです。'],
  'Icon Button': ['アイコンボタン', 'アイコンを中心にした省スペースな操作です。'],
  'Dropdown Button': ['ドロップダウンボタン', '追加の選択肢を開くボタンです。'],
  Card: ['カード', '関連する情報や操作をひとまとまりにした領域です。'],
  Modal: ['モーダル', '背後の画面より優先して表示される一時的な領域です。'],
  Dialog: ['ダイアログ', '確認や入力のために表示される対話領域です。'],
  Drawer: ['ドロワー', '画面端から現れる補助パネルです。'],
  'Bottom Sheet': ['ボトムシート', '画面下部から現れる操作パネルです。'],
  Tooltip: ['ツールチップ', '対象の補足説明を一時的に表示します。'],
  Tabs: ['タブ', '同じ領域内の複数ビューを切り替えます。'],
  Accordion: ['アコーディオン', '見出しを操作して内容を開閉します。'],
  'Search Bar': ['検索バー', 'キーワードで内容を探すための入力欄です。'],
  'Text Field': ['テキストフィールド', '短い文字列を入力するフォーム要素です。'],
  Select: ['セレクト', '候補から値を1つ選ぶフォーム要素です。'],
  Checkbox: ['チェックボックス', '複数選択可能なオン・オフ入力です。'],
  'Radio Button': ['ラジオボタン', '候補から1つだけを選ぶ入力です。'],
  Badge: ['バッジ', '状態や件数を短く示す小さなラベルです。'],
  Avatar: ['アバター', 'ユーザーや組織を表す画像です。'],
  Breadcrumb: ['パンくずリスト', '現在位置までの階層を示すナビゲーションです。'],
  Table: ['テーブル', '行と列で構造化されたデータを表示します。'],
  'List Item': ['リスト項目', 'リストを構成する1つの項目です。'],
  'Video Frame': ['動画フレーム', '動画の現在の再生位置を静止画として記録する対象です。'],
  Section: ['セクション', 'ページ内容を意味のある単位に分ける領域です。'],
  'Unknown Element': ['不明な要素', '既知のUIパターンとして強く判定できない要素です。'],
};

function candidate(name: string, score: number, reasons: string[]): Candidate {
  const [japaneseName, description] = patternCopy[name];
  return { name, japaneseName, description, score, reasons };
}

const hasToken = (features: PatternFeatures, pattern: RegExp) =>
  pattern.test(`${features.classText} ${features.ariaLabel}`.toLowerCase());

export function detectPatternFromFeatures(features: PatternFeatures): UIPatternResult {
  const candidates: Candidate[] = [];
  const add = (name: string, score: number, reasons: string[]) =>
    candidates.push(candidate(name, score, reasons));

  if (features.tag === 'header' || features.role === 'banner') {
    add('Header', 0.98, ['header要素またはbannerロールを持つ']);
  } else if (
    features.top < 120 &&
    features.width > features.viewportWidth * 0.7 &&
    features.linkCount >= 2
  ) {
    const reasons = ['ページ上部に存在する', '幅広い領域である', '複数のリンクを含む'];
    if (features.hasLogoLikeImage) reasons.push('ロゴらしい画像を含む');
    add('Header', 0.78, reasons);
  }

  if (features.tag === 'nav' || features.role === 'navigation') {
    add('Navigation Bar', 0.98, ['nav要素またはnavigationロールを持つ']);
  } else if (features.linkCount >= 3 && ['flex', 'grid'].includes(features.display)) {
    add('Navigation Bar', 0.68, ['複数のリンクを含む', 'リンクがレイアウトで整列されている']);
  }

  if (features.tag === 'footer' || features.role === 'contentinfo') {
    add('Footer', 0.98, ['footer要素またはcontentinfoロールを持つ']);
  }

  if (features.tag === 'video') {
    add('Video Frame', 0.99, ['video要素である', '現在の再生フレームを撮影できる']);
  }

  if (
    (features.tag === 'section' ||
      features.tag === 'main' ||
      hasToken(features, /hero|masthead/)) &&
    features.top < features.viewportHeight * 0.7 &&
    features.height >= 220 &&
    features.headingCount > 0
  ) {
    const reasons = ['ページ上部付近の大きな領域である', '見出しを含む'];
    if (features.buttonCount > 0) reasons.push('主要操作らしいボタンを含む');
    add('Hero Section', hasToken(features, /hero|masthead/) ? 0.92 : 0.74, reasons);
  }

  if (
    features.tag === 'aside' ||
    features.role === 'complementary' ||
    (features.height > features.viewportHeight * 0.55 &&
      features.width < features.viewportWidth * 0.45 &&
      (features.left < 40 || features.left + features.width > features.viewportWidth - 40))
  ) {
    add('Sidebar', features.tag === 'aside' ? 0.94 : 0.72, ['画面端にある縦長の補助領域である']);
  }

  const isButton = features.tag === 'button' || features.role === 'button';
  if (isButton && (features.ariaHasPopup || hasToken(features, /dropdown|menu|select/))) {
    add('Dropdown Button', 0.94, ['ポップアップメニューを開く属性または名称を持つ']);
  } else if (isButton && features.hasIconChild && features.text.length <= 2) {
    add('Icon Button', 0.92, ['ボタン内が主にアイコンで構成されている']);
  } else if (isButton) {
    const namedPrimary = hasToken(features, /primary|cta|submit|confirm|buy|start/);
    const primary = namedPrimary || features.hasFilledBackground;
    add(primary ? 'Primary Button' : 'Secondary Button', primary ? 0.9 : 0.72, [
      'button要素またはbuttonロールを持つ',
      primary
        ? namedPrimary
          ? '主要操作を示す名前やクラスを持つ'
          : '塗りの背景を持ち、視覚的に強調されている'
        : '主要操作を示す強い手掛かりがない',
    ]);
  }

  if (features.role === 'dialog' || features.tag === 'dialog') {
    add(hasToken(features, /modal/) ? 'Modal' : 'Dialog', 0.97, [
      'dialog要素またはdialogロールを持つ',
    ]);
  }
  if (features.position === 'fixed' && features.height > features.viewportHeight * 0.35) {
    if (features.top + features.height >= features.viewportHeight - 4 && features.width > 280) {
      add('Bottom Sheet', 0.76, ['画面下部に固定された広いパネルである']);
    } else if (features.width < features.viewportWidth * 0.75) {
      add('Drawer', 0.7, ['画面端に固定されたパネル状の領域である']);
    } else {
      add('Modal', 0.65, ['viewportに固定された大きな領域である']);
    }
  }

  if (features.role === 'tooltip' || hasToken(features, /tooltip/)) {
    add('Tooltip', 0.96, ['tooltipロールまたは名称を持つ']);
  }
  if (features.role === 'tablist' || hasToken(features, /tabs?|tablist/)) {
    add('Tabs', 0.9, ['tablistロールまたはタブを示す名称を持つ']);
  }
  if (hasToken(features, /accordion/) || features.ariaHasPopup) {
    add('Accordion', 0.62, ['開閉式UIを示す属性または名称を持つ']);
  }

  const searchable = features.type === 'search' || hasToken(features, /search/);
  if (features.tag === 'input' && (searchable || features.role === 'searchbox')) {
    add('Search Bar', 0.95, ['検索用のinputまたは名称を持つ']);
  } else if (features.tag === 'input' || features.tag === 'textarea') {
    if (features.type === 'checkbox') add('Checkbox', 0.99, ['checkbox入力である']);
    else if (features.type === 'radio') add('Radio Button', 0.99, ['radio入力である']);
    else add('Text Field', 0.92, ['文字入力用のフォーム要素である']);
  }
  if (features.tag === 'select' || features.role === 'combobox') {
    add('Select', 0.98, ['select要素またはcomboboxロールを持つ']);
  }

  if (
    hasToken(features, /card|tile|panel/) ||
    ((features.hasBorder || features.hasShadow) &&
      features.borderRadius > 0 &&
      features.height > 80)
  ) {
    add('Card', hasToken(features, /card|tile/) ? 0.88 : 0.69, [
      '境界、角丸、影などで内容がまとまっている',
    ]);
  }
  if (
    features.role === 'status' ||
    (features.width < 160 && features.height < 40 && hasToken(features, /badge|pill|tag/))
  ) {
    add('Badge', 0.84, ['小さな状態ラベルらしい寸法と名称を持つ']);
  }
  if (
    features.tag === 'img' &&
    Math.abs(features.width - features.height) < 8 &&
    (features.borderRadius >= features.width / 3 || hasToken(features, /avatar|profile/))
  ) {
    add('Avatar', 0.9, ['正方形に近い人物・プロフィール画像らしい']);
  }
  if (features.role === 'navigation' && hasToken(features, /breadcrumb/)) {
    add('Breadcrumb', 0.97, ['navigationロールとbreadcrumb名称を持つ']);
  }
  if (features.tag === 'table' || features.role === 'table')
    add('Table', 0.99, ['table要素である']);
  if (features.tag === 'li' || features.role === 'listitem')
    add('List Item', 0.94, ['リスト項目である']);
  if (features.tag === 'section') add('Section', 0.64, ['section要素である']);

  if (candidates.length === 0) add('Unknown Element', 0.25, ['既知パターンの強い手掛かりがない']);
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    name: best.name,
    japaneseName: best.japaneseName,
    confidence: Math.max(0, Math.min(1, Number(best.score.toFixed(2)))),
    description: best.description,
    reasons: best.reasons,
  };
}

export function detectUIPattern(element: Element): UIPatternResult {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const background = parseCssColor(style.backgroundColor);
  const backgroundRange = background
    ? Math.max(background.r, background.g, background.b) -
      Math.min(background.r, background.g, background.b)
    : 0;
  const backgroundLuminance = background
    ? background.r * 0.2126 + background.g * 0.7152 + background.b * 0.0722
    : 255;
  const label = element.getAttribute('aria-label') ?? '';
  const classes = [...element.classList].join(' ');
  const images = [...element.querySelectorAll('img')];
  const input = element instanceof HTMLInputElement ? element : null;
  return detectPatternFromFeatures({
    tag: element.tagName.toLowerCase(),
    role: element.getAttribute('role')?.toLowerCase() ?? '',
    type: input?.type.toLowerCase() ?? '',
    classText: classes,
    ariaLabel: label,
    ariaHasPopup: element.hasAttribute('aria-haspopup'),
    text: (element.textContent ?? '').trim(),
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    linkCount: element.querySelectorAll('a').length,
    buttonCount: element.querySelectorAll('button,[role="button"]').length,
    headingCount: element.querySelectorAll('h1,h2,h3').length,
    imageCount: images.length,
    inputCount: element.querySelectorAll('input,textarea,select').length,
    hasLogoLikeImage: images.some((image) => /logo/i.test(`${image.alt} ${image.className}`)),
    hasIconChild: Boolean(element.querySelector('svg,img,[class*="icon" i]')),
    hasFilledBackground: Boolean(
      background && background.a > 0.05 && (backgroundRange > 24 || backgroundLuminance < 130),
    ),
    display: style.display,
    position: style.position,
    flexDirection: style.flexDirection,
    borderRadius: Number.parseFloat(style.borderRadius) || 0,
    hasBorder: style.borderStyle !== 'none' && Number.parseFloat(style.borderWidth) > 0,
    hasShadow: style.boxShadow !== 'none',
  });
}
