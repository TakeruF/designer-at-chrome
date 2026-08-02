# UI Lens — Design Inspector

[日本語](./README.md) | [English](./README.en.md) | [简体中文](./README.zh-CN.md)

UI Lens is a local-first Chrome extension for learning UI design from real websites. Select an element on any page to inspect its UI pattern, typography, colors, spacing, appearance, layout, and HTML structure in the Chrome Side Panel. Save elements you like with screenshots and notes to build your own searchable UI reference library.

## Features

- `Inspect` and `Bookmarks` tabs in the Chrome Side Panel
- Hover highlighting, click-to-select, and `Escape` to exit inspection mode
- Navigate from a selected element to its parent and return to children through selection history
- Automatically clear selections and outlines when the URL changes through regular or SPA navigation
- Extract Basic, Typography, Colors, Spacing, Appearance, Layout, and Structure details
- List fonts used by text-bearing elements within the selected area
- Local, rule-based UI pattern detection using HTML, ARIA, CSS, position, and child elements
- High-DPI screenshots cropped to the visible portion of the selected element and stored as WebP
- Capture a `video` element or video-containing area as the current frame, entire player, or selected region
- Save video timecode, resolution, captions, controls, and capture limitations
- Estimate custom player bounds, navigate capture bounds through parent and child elements, optionally pause playback, and restore its original state
- Detect likely protected black or transparent video frames and save surrounding UI or a placeholder instead
- Local bookmarks with a title, category, tags, and notes
- Search, category filters, newest/oldest sorting, details, editing, and deletion
- Export and import bookmarks, original images, and thumbnails as ZIP archives
- System, light, and dark color themes selectable in Settings
- Accent colors that follow the browser or OS `AccentColor`, with Chrome blue as a fallback
- Japanese, English, and Simplified Chinese UI; the initial language follows Chrome's UI language
- Switch between per-site permission (default) and one-time all-sites permission in Settings
- Copy AI reconstruction prompts containing the extracted structure and styles from Inspect or the design library
- Local Japanese and English glossary entries for beginner-friendly CSS explanations and UI classification reasons

## Tech Stack

- Chrome Extension Manifest V3
- React 19 / TypeScript (strict mode)
- Vite (Side Panel) + esbuild (self-contained Service Worker and Content Script bundles)
- Chrome Side Panel API / Content Scripts / Service Worker
- `chrome.storage.local` (metadata and UI state)
- IndexedDB (original screenshot and thumbnail blobs)
- JSZip (ZIP export and import)
- Vitest / jsdom / ESLint / Prettier

## Setup

Node.js 20 or later is recommended.

```bash
npm install
```

## Development Server

```bash
npm run dev
```

The Vite development server is intended for styling the Side Panel UI. To test selection, capture, and storage features that use Chrome APIs, load the built extension in Chrome as described below.

## Build

```bash
npm run build
```

This generates an unpacked Manifest V3 extension in `dist/`.

## Load in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** in the top-right corner.
4. Select **Load unpacked**.
5. Choose this repository's `dist/` directory.
6. Open a regular `http://` or `https://` page and click the UI Lens icon in the toolbar.
7. If needed, select **Allow this site**. Permission is scoped to the current site and saved after Chrome confirms it.
8. Select **Select element** in the Side Panel, then choose an element on the page.

After changing the code, run `npm run build` again and reload the extension from `chrome://extensions`.

## Tests and Quality Checks

```bash
npm test
npm run typecheck
npm run lint
npm run format:check
```

Unit tests cover:

- RGB / RGBA / CSS Color 4 conversion to HEX, including alpha values
- Rule-based UI pattern detection
- CSS selector generation
- Bookmark and import data validation
- ID collision resolution during import
- Video frame time formatting, player-bound scoring, and protected-content pixel heuristics
- Japanese and English AI reconstruction prompt generation from selected elements and saved bookmarks

## Permissions and Rationale

| Permission                         | Why it is needed                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `sidePanel`                        | Open the Chrome Side Panel from the extension icon                                                  |
| `storage`                          | Store bookmark metadata, settings, and UI state locally                                             |
| `activeTab`                        | Inspect and capture only the current tab after the user opens the extension                         |
| `scripting`                        | Inject the Inspector Content Script into the current tab after a user action                        |
| `tabs`                             | Read the active tab, capture its viewport, and open a bookmark's source page in a new tab           |
| `<all_urls>` (optional permission) | Capture screenshots during an explicit save operation after the temporary `activeTab` grant expires |

`optional_host_permissions` declares `<all_urls>`, but the extension does not request access to every site during installation. The declaration allows it to request only the origin it needs. Normally, UI Lens uses the temporary `activeTab` permission granted when the user clicks its toolbar icon. If the user navigates to another domain while keeping the Side Panel open, UI Lens asks for access only to the current origin when the user selects **Allow this site**. Users who prefer it can grant access to all sites at once from Settings. Per-site permission is the default.

Chrome requires either a temporary `activeTab` grant or literal `<all_urls>` permission for `captureVisibleTab()`. If the user saves an element after the temporary grant has expired, for example after navigating, UI Lens explains why it needs permission before requesting optional screenshot access. The user may decline and instead click the UI Lens toolbar icon again on the target tab to renew temporary access. Even after permission is granted, capture runs only when the user explicitly saves an item.

The extension has no permanently granted `host_permissions`. Its Content Script is not declared to run continuously on every page; it is injected only into the current tab after a user action. Optional permissions and previously allowed sites can be revoked at any time in Chrome's extension settings.

## Local Storage Architecture

### `chrome.storage.local`

- Bookmark metadata
- Extracted styles, structure, and UI pattern detection results
- Theme, display language, and last-opened tab

### IndexedDB (`ui-lens-images`)

The `screenshots` object store contains:

- `fullImageBlob`: original `image/webp` image at quality 0.85
- `thumbnailBlob`: list thumbnail up to 400 px wide
- Image dimensions, MIME type, creation date, and bookmark ID

Images are never converted to Base64 and stored in `chrome.storage.local`. The temporary PNG data URL created during capture is used only to load the image into a Canvas in the Service Worker, then converted to a WebP Blob before storage.

Deleting a bookmark removes both its IndexedDB images and `chrome.storage.local` metadata. Exported ZIP archives have this structure:

```text
bookmarks.json
images/{bookmarkId}.webp
thumbnails/{bookmarkId}.webp
```

During import, JSON is validated and a new UUID is issued if an ID conflicts with an existing bookmark or another entry in the same archive. Records with missing images are skipped, and invalid JSON never replaces existing data. The MVP limits ZIP files to 250 MB and each import to 1,000 items. If an import fails partway through, images added by that operation are rolled back.

## Screenshot Pipeline

1. The Content Script reads the selected element's `getBoundingClientRect()` and `devicePixelRatio`.
2. If the selection contains video, it records the capture bounds and current playback position, then pauses playback if configured to do so.
3. Selection and hover overlays are temporarily hidden.
4. `chrome.tabs.captureVisibleTab()` captures the current viewport.
5. The Service Worker crops the image with `OffscreenCanvas`, accounting for DPR.
6. It generates a WebP image at quality 0.85 and a thumbnail up to 400 px wide.
7. Blobs are saved to IndexedDB, overlays are restored, and video playback returns to its original state.

If an element extends outside the viewport, UI Lens saves only the visible portion and records a `clippedToViewport` flag with a note in the UI. For video, users can choose the current frame, the entire player UI, or the selected section. A video paused only for capture returns to its previous playback state afterward.

Video capture does not draw a `video` element directly onto a Canvas. It captures and crops the full tab just like any other element, preserving the current frame, captions, custom controls, and surrounding layout exactly as displayed. **Include player controls** does not alter DOM attributes; it only tries to reveal existing controls with a mouse-move event. UI Lens does not save video URLs or files.

If most of the captured video area is black or transparent, UI Lens warns that the content may be protected and offers to save only the surrounding player UI, replace the video area with a placeholder, or cancel. It does not attempt to bypass DRM or Encrypted Media Extensions.

## Privacy

- Browsing content is never sent outside the browser.
- Screenshots are stored only in the user's browser.
- No account is required.
- No external analytics, advertising SDKs, or cloud APIs are used.
- The extension itself makes no external network requests.
- AI reconstruction prompts are generated locally from already extracted data and copied to the clipboard only after a user action. They are not sent to any AI service.
- Page favicon URLs are recorded as metadata but are not fetched or displayed by the extension UI.

## Current Limitations

- Selecting elements inside iframes is outside the MVP scope; only the top frame is inspected.
- Open Shadow DOM is supported where possible through composed event paths and per-Shadow-Root selector expressions. The web platform prevents complete access to closed Shadow DOM internals.
- UI Lens does not stitch multiple scrolled captures into full-element or full-page screenshots.
- Script-restricted pages such as `chrome://` pages, the Chrome Web Store, browser internals, and other extension pages cannot be inspected. The Side Panel explains why.
- For standard HTML video, UI Lens records the current frame, timecode, intrinsic resolution, displayed dimensions, playback and mute state, caption detection, and related details. When a selection contains multiple videos, the first visible video is used as the primary target.
- DRM-protected video, Encrypted Media Extensions, hardware overlays, and WebGL-composited video may prevent capture of the video image. Black-frame detection is heuristic and can mistake a genuinely dark scene for protected content.
- Hidden native or custom controls may remain hidden depending on the site's implementation. UI Lens continues capturing the video frame without forcefully modifying the page DOM.
- UI Lens does not change `currentTime`, volume, or mute state before pausing. If browser autoplay policy prevents playback from resuming after capture, the limitation is recorded in the saved metadata.
- Rule-based classification is heuristic and returns the most likely candidate. Ambiguous elements are shown with lower confidence.
- Data is not synced between browsers and remains scoped to the Chrome profile. Use ZIP export to migrate it.
- SPA URL changes keep the current Content Script registered and continue inspecting the current DOM, but an element must be selected again if a rerender destroys it.

## Roadmap Ideas

- Stitched captures for large, scrollable elements
- iframe support and stronger selectors across Shadow DOM boundaries
- Style comparison between two bookmarks
- Automatic CSS token clustering and palette visualization
- Learning-note export in JSON or Markdown
- Keyboard-only element tree navigation
- Fully local similarity search for saved designs

## License

This project is released under the [MIT License](./LICENSE).

## Project Structure

```text
src/
  background/
    service-worker.ts       # Side Panel coordination, permission boundaries, Content Script injection
    screenshot.ts           # Viewport capture, DPR-aware cropping, and WebP generation
    protected-content.ts    # Detection of likely protected black or transparent video areas
  content/
    inspector.ts            # Selection mode, events, parent/child history, and message handling
    overlay.ts              # Hover and fixed outlines inside Shadow DOM
    element-analyzer.ts     # Basic properties and computed style extraction
    pattern-detector.ts     # Rule-based UI pattern classification
    selector-generator.ts   # CSS selector generation
    video-analyzer.ts       # Video metadata extraction and player-bound estimation
  sidepanel/
    App.tsx                 # Tabs, themes, languages, and selection event coordination
    i18n.tsx                # Local dictionaries and context for Japanese, English, and Simplified Chinese
    host-permissions.ts     # Optional permission requests scoped to the current site
    components/             # Summary, detail, card, and save-form components
    pages/                  # Inspect / Bookmarks / Settings
    hooks/                  # Object URLs for IndexedDB blobs
    styles.css              # Design tokens and responsive UI
  storage/
    bookmark-storage.ts     # chrome.storage.local CRUD
    screenshot-db.ts        # IndexedDB CRUD
    export-import.ts        # ZIP input and output
    validation.ts           # Defensive data validation and ID collision resolution
  shared/
    types.ts                # Type definitions and discriminated-union messages
    messages.ts             # Typed message sending
    color-utils.ts          # CSS color conversion
    media-utils.ts          # Video timecode formatting
    reproduction-prompt.ts  # Local Japanese and English AI reconstruction prompt generation
    glossary.ts             # Beginner-friendly local glossary
```
