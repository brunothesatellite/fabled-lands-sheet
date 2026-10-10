# Changelog

## v1.22

This release delivers the first offline Android application for the project (the `android-v1.0` milestone) along with a set of webapp improvements: a new fullscreen map viewer, a repaired JSON export, a header that adapts to any system font scale, WebP map images, and release tooling (signed APK + deployable webapp zip).

> **Note:** the changelog was last updated at v1.14. The interim tags v1.15 → v1.21 shipped the following changes: default locking of adventure sheet fields with improved locked-field readability (v1.15–v1.16), dark theme and dice randomized at page load (v1.17), the adventure log panel with an "empty log" action and ship-table fixes (v1.18), removal of the +/− stepper buttons in favor of read-only mode (v1.19), fast jump in codewords (v1.20), and book/map recall indicators persisted to the database plus a codewords filter showing only checked codewords (v1.21).

### Android application (offline APK)
- Added a native Android wrapper (Gradle project, WebView) that serves the webapp entirely from local assets under the `/fl-sheet/` origin through a dedicated `AssetRouter` — no network is required at runtime.
- Integrated a local PHP runtime: `php-cgi-wasm` executes inside a Service Worker (CGI bridge) with SQLite support, so authentication sessions and preference sync keep working fully offline (state persisted in IndexedDB filesystem).
- Vendored the webfonts locally for the APK (Barlow Condensed + Space Grotesk, SIL OFL) and Font Awesome 6.5.2 (CSS + woff2 + licences), replacing the CDN references used on the web.
- Converted the eight map images to WebP (lossy q80) and shrunk the asset payload (≈24 MB of assets, ≈12 MB signed APK).
- JSON export now writes a real file to `/sdcard/Download` via MediaStore; this repairs a bridge defect that had made every in-app export fail silently since commit `8d3c76e` (fixed at the Java layer, verified by the device recette).
- Hardened the release build script (two-step APK signing — `dist/` can never hold an unsigned artifact) and added launcher icons.
- Added automated quality gates: 14/14 offline POC gates, plus the §6.2 device recette (D0–D9, **12/12** on a Pixel 7a) covering install, boot, offline fonts, login, server preferences, theme, export, force-stop restart with session/preferences/theme preservation, and map decoding.

### Fullscreen map viewer
- Replaced the legacy fullscreen map treatment with a dedicated overlay viewer: tap a map to open it, close with the single ✕ button, the Escape key, or a backdrop tap (drag-guarded to avoid accidental closes).
- Zoom interactions: mouse wheel anchored on the cursor (desktop) and two-finger pinch anchored mid-fingers (mobile); one-finger drag to pan.
- The map can never leave the screen — pan and zoom are hard-bounded so some part of the map always remains visible, in both light and dark themes.

### Header robustness
- The masthead now stays on a single line at any system font scale: an auto-fit routine shrinks the title when needed instead of relying on a forced `textZoom` (verified on device at `font_scale=1.15`).
- Fixed header overlap issues (avatar covering the second die) on narrow widths.

### Testing, tooling and release artifacts
- New device benches: `_check-mapviewer.mjs` (desktop CDP: fit, bounds, wheel anchor, pinch model, close paths) and `_check-mapviewer-device.mjs` (real two-finger touch pinch, bounded drag, close, dark theme on the actual WebView).
- New `installeur/_build-webapp.mjs` script producing the deployable webapp artifact `dist/fabled-lands-sheet-1.22-webapp.zip` (22 files, only what the webapp needs — shared filter `_www-filter.mjs` with the Android asset sync, SQLite runtime data excluded).
- Android release build: `installeur/android/_build-android.ps1 -Version 1.22 -VersionCode 2` → signed `fabled-lands-sheet-1.22-android.apk` in `installeur/android/dist/`.

---

With v1.22 the project can now be played two ways: hosted on any PHP 8.2+ web server (webapp zip artifact) or fully offline on a phone (signed APK artifact) — both from the same codebase, with the same data format (`fl-local-storage` v1) travelling between them through export/import.

---

## v1.14

This release continues the evolution of the project from the v1.13 baseline, focusing on visual identity, screen-size usability, compact interface polish, and stronger consistency between the adventure sheet, encounter panels, and the book/map navigation flow.

### New brand and visual identity
- Added a stronger fantasy RPG brand presence through a new sword-and-shield style iconography and an updated favicon set.
- Introduced new favicon assets aligned with the project’s fantasy adventure identity:
  - a combined fantasy/RPG favicon,
  - a magic-book variation,
  - a sword-and-shield mark,
  - and a refreshed default favicon.
- Updated the visual screenshot used by the project to match the newer interface treatment.

### UI and mobile experience improvements
- Improved the interface for smaller screens and compact mobile layouts, making the sheet more readable and less crowded on smartphones.
- Added Android-focused interface refinements, especially in the interaction flow and layout density for mobile touch usage.
- Simplified and improved the menu and top-level navigation behavior for a better overall user experience.

### UX and menu evolution
- Continued the interface evolution around the menu and tab system.
- Improved dropdown/tab active-state synchronization so book and map navigation selections stay visually coherent.
- Added click-memory behavior for book and map recall indicators, making the tab/subtab switching story clearer for the player.
- Updated the tab switching flow to keep book and map dropdown controls in sync with active panels.

### Form and sheet structure changes
- Reworked the adventure sheet form layout to better organize identity and progression fields.
- Added or reorganized the adventure fields for:
  - Profession,
  - God,
  - Money,
  - Rank.
- Clarified the adventure metadata structure by aligning the field placement with the fantasy sheet workflow rather than the older row order.
- Improved the consistency of the encounter box layout by aligning the Me and Foe combat/defence fields in matching row containers.
- Added proper border and layout treatment to the readonly encounter fields so the Me and Foe columns visually align more cleanly.

### Styling and layout consistency fixes
- Applied CSS refinements to harmonize the compact layout on mobile and regular desktop sizing.
- Adjusted the stepper and field containers to preserve visual alignment across adventure and encounter zones.
- Updated page styling so the new icons, form-row organization and dropdown behavior are reflected consistently across both the interface and the active UI states.

### JavaScript behavior and state synchronization
- Extended the tab-switching logic to clear and restore active dropdown toggles for book and map menus.
- Improved the handling of book/map recall labels and map/book dataset indicators during tab actions.
- Added event-driven recall updates so user moves across books and maps are represented in the UI more clearly.
- Preserved and improved the interaction mapping for the existing stepper controls and form inputs.

### Fixes and quality work applied
- Corrected interface consistency problems caused by uneven field container structure across the “Me” and “Foe” encounter panels.
- Repaired layout harmonization issues between combat and defence fields by matching the row structure in both visual columns.
- Fixed the mobile/menu usability drawbacks by removing overflow-prone behavior and by constraining the visual structure where necessary.
- Improved the overall arrangement of the user-facing form so the visual grammar of the adventure sheet is more coherent and less cluttered.

---

This current state thus represents a UI/UX stabilization and visual refresh cycle after v1.13: stronger fantasy branding, more responsive compact/mobile design, a refined menu interplay, stronger layout consistency across the sheet and encounter surfaces, and a series of interface and styling corrections that align the project with the current visual language.
