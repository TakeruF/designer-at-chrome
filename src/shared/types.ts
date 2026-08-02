export type BookmarkCategory =
  | 'Header'
  | 'Hero'
  | 'Navigation'
  | 'Button'
  | 'Card'
  | 'Form'
  | 'Modal'
  | 'Footer'
  | 'Typography'
  | 'Other';

export interface UIPatternResult {
  name: string;
  japaneseName: string;
  confidence: number;
  description: string;
  reasons: string[];
}

export interface ColorValue {
  css: string;
  hex: string | null;
  alpha: number;
}

export interface BoxEdges {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export interface TypographyStyle {
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  textAlign: string;
  color: ColorValue;
}

export interface ColorStyle {
  text: ColorValue;
  background: ColorValue;
  border: ColorValue;
}

export interface SpacingStyle {
  margin: BoxEdges;
  padding: BoxEdges;
  rowGap: string;
  columnGap: string;
}

export interface AppearanceStyle {
  border: string;
  borderRadius: string;
  boxShadow: string;
  opacity: string;
}

export interface LayoutStyle {
  display: string;
  position: string;
  flexDirection: string;
  justifyContent: string;
  alignItems: string;
  gridTemplateColumns: string;
  overflow: string;
  zIndex: string;
}

export interface ComputedStyleInfo {
  typography: TypographyStyle;
  colors: ColorStyle;
  spacing: SpacingStyle;
  appearance: AppearanceStyle;
  layout: LayoutStyle;
}

export interface ViewportRect {
  x: number;
  y: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface SelectedElementInfo {
  pattern: UIPatternResult;
  tagName: string;
  role: string | null;
  id: string | null;
  classNames: string[];
  text: string;
  width: number;
  height: number;
  viewportRect: ViewportRect;
  cssSelector: string;
  htmlSummary: string;
  computedStyle: ComputedStyleInfo;
  pageUrl: string;
  pageTitle: string;
  faviconUrl: string | null;
}

export interface ScreenshotMetadata {
  screenshotId: string;
  width: number;
  height: number;
  mimeType: 'image/webp';
  clippedToViewport: boolean;
}

export interface DesignBookmark {
  id: string;
  title: string;
  category: BookmarkCategory;
  tags: string[];
  note: string;
  sourceUrl: string;
  pageTitle: string;
  faviconUrl: string | null;
  createdAt: string;
  updatedAt: string;
  uiPattern: UIPatternResult;
  cssSelector: string;
  htmlSummary: string;
  element: Pick<SelectedElementInfo, 'tagName' | 'role' | 'id' | 'classNames' | 'text'>;
  style: ComputedStyleInfo;
  screenshot: ScreenshotMetadata;
}

export interface StoredScreenshot {
  id: string;
  bookmarkId: string;
  fullImageBlob: Blob;
  thumbnailBlob: Blob;
  width: number;
  height: number;
  mimeType: 'image/webp';
  createdAt: string;
}

export interface CapturePreparation {
  rect: ViewportRect;
  visibleRect: ViewportRect;
  devicePixelRatio: number;
  clippedToViewport: boolean;
}

export interface CaptureStoredResult {
  screenshotId: string;
  width: number;
  height: number;
  clippedToViewport: boolean;
}

export interface ExtensionError {
  code:
    | 'RESTRICTED_PAGE'
    | 'NO_ACTIVE_TAB'
    | 'NO_SELECTION'
    | 'CAPTURE_FAILED'
    | 'STORAGE_FAILED'
    | 'INVALID_IMPORT'
    | 'UNKNOWN';
  message: string;
}

export type ExtensionMessage =
  | { type: 'START_SELECTION' }
  | { type: 'RESELECT_ELEMENT' }
  | { type: 'MOVE_SELECTION'; direction: 'parent' | 'child' }
  | { type: 'GET_SELECTION' }
  | { type: 'CAPTURE_PREPARE' }
  | { type: 'CAPTURE_RESTORE' }
  | { type: 'ELEMENT_SELECTED'; payload: SelectedElementInfo }
  | { type: 'CAPTURE_AND_STORE'; bookmarkId: string };

export type MessageResponse<T = undefined> =
  { ok: true; data: T } | { ok: false; error: ExtensionError };

export interface BookmarkDraft {
  title: string;
  category: BookmarkCategory;
  tags: string[];
  note: string;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface UIState {
  activeTab: 'inspect' | 'bookmarks';
  theme: ThemePreference;
}
