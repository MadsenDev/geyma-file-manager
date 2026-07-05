# Handoff: Geyma — a file manager that remembers

## Overview

Geyma (Old Norse: *to keep, to guard*) is a desktop-class file manager built around three differentiating ideas:

1. **Files remember.** Every file carries an event history (moved, renamed, starred, restored…). The UI surfaces this memory everywhere: per-file activity timelines in the Details panel, a disk-wide Timeline module, and "ghost trails" — faint markers left behind in a folder showing where recently-departed files went.
2. **Working Sets.** Playlist-like collections of file *references* (never copies). Files stay where they live; sets follow them through moves and renames. Sets support notes, rule-based "smart" variants, shareable export codes, and can be bound to a visual environment.
3. **Deep customizability.** The entire chrome is modular: every UI element (nav, search, sidebar panels, even the file grid itself) is a module the user can drag between six layout zones. Eight full color skins with token-level overrides, exportable as share codes.

Brand voice: calm, precise, a little warm. No emoji in UI chrome (mood glyphs are stroke-drawn SVG).

## About the Design Files

The files in this bundle are **design references created in HTML** — working prototypes showing intended look and behavior, not production code to ship. Your task is to **recreate this design in the target codebase's environment** (React, Svelte, Tauri/Electron shell, etc.) using its established patterns. If no environment exists yet, a sensible default is React + TypeScript in a Tauri or Electron shell (a real file manager needs FS access), with the prototype's inline-style token approach mapped to CSS custom properties.

`Geyma.dc.html` is the complete prototype. It contains an HTML template plus a single JavaScript class (~1,300 lines) holding all state, logic, and module renderers. The class is directly readable and is the authoritative spec for every behavior described below — when in doubt, read the source. `Audit Report.dc.html` and `Feature Ideas.dc.html` document the QA/feature history and are context, not designs to build.

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, interactions and copy are final. Recreate pixel-perfectly, using exact hex values and the type stack below. The only prototype-isms NOT to reproduce: `prompt()` dialogs (replace with proper modals/inline inputs — see Interactions), the in-memory fake filesystem (replace with real FS access), and localStorage persistence (replace with a settings store).

## Architecture overview

### The zone/module layout engine (core concept — build this first)

The window is divided into **six zones**: `top`, `left`, `center`, `center2` (lower center, present when the center is split), `right`, `bottom`. Every piece of UI is a **module** assigned to a zone. Users enter *edit mode* (pencil button) to drag modules between zones, reorder within a zone, or hide them; hidden modules sit in a horizontally scrolling chip strip on the floating edit bar and can be dragged back in.

Modules (20): `nav`, `location`, `search`, `viewswitch`, `title`, `files`, `files2` (second pane), `details`, `appearance`, `places`, `devices`, `sets`, `disk`, `recent`, `timeline`, `dupes`, `clock`, `visualizer`, `mood`, `status`.

Zone rules:
- Side zones (left/right) render modules as vertical cards; top/bottom render them as horizontal toolbar segments. Modules adapt to orientation (`orient` param: "h" / "v" / "c").
- Zone widths for left/right rails are user-draggable (rail drag handles).
- The center zone stacks its modules vertically and **scrolls** when content exceeds height. Stretch modules (`files`, `files2`, `details`, `appearance`) get `flex:1` with min-heights — `files` ≥ 200px (flex 2), others ≥ 140px. Never let the file grid be crushed below one visible row.
- Center split: `center`/`center2` divided by a draggable horizontal divider (ratio persisted). Split state derives from whether `center2` has modules, and must survive reload.
- Layout presets (Classic, Bottom dock, etc.) + named workspaces (full environment snapshots) are provided in the Appearance panel.

### Skin/token system

Every skin defines the same token set. All UI colors derive from tokens — nothing hard-coded. Users can override individual tokens (accent, fonts, radius, density, glow, icon style, background pattern) on top of any skin; skin + overrides exports as a share code (`GY.` + base64 JSON) and imports the same way.

## Screens / Views

There is one screen — the file manager window — composed of modules. Default layout: top = nav + location + search + viewswitch; left = places, devices, sets; center = title, files; right = details; bottom = status.

### Files module (center)
- **Grid view**: tiles in `repeat(auto-fill, minmax(~120px,1fr))` grid; tile = icon box (rounded square, kind-tinted bg at ~10-14% alpha, kind-colored ext label in mono 7-8px caps or folder SVG), name (13-14px, weight 600), meta line (mono 9-10px, `inkFaint`). Selection = accent ring (`box-shadow: 0 0 0 1.5px accent` + accent bg at 8-14% alpha). Starred items show a small ★ badge, top-right of the icon box.
- **List view**: header row (mono 10.5px uppercase, letter-spacing .1em) + rows (13px). Active sort column renders in accent with ↑/↓ suffix. Columns: Kind, Size, Modified, Tags — each toggleable; columns drop out under container-width breakpoints (container queries in the prototype).
- **Ghost trails**: after a file leaves a folder (move/trash), the folder shows up to 3 ghosts at the end of the grid/list: dashed 1.5px border tile/row at 55% opacity, italic name, "→ {destination}" in mono. Click navigates to the destination and selects the file. A ghost disappears when its file returns or is undone. Ghosts are per-folder, newest first, never shown in Trash or during search.
- Empty state: centered `inkFaint` 12.5px text.

### Second pane module (`files2`)
Independent lower file pane: its own path (persisted), header (up button 24px, folder label 13px/700, "N items · lower pane" mono caption), grid of the same tiles, drop target for drags from the main pane (moves files). Empty state = dashed border "Empty — drop files here". "Open in lower pane" (context menu on folders and Places) auto-places this module into `center2` and navigates it.

### Quick Look overlay
Space opens; Space/Esc closes; ←/→ (also ↑/↓) steps through the current folder order, updating selection. Dialog: `min(560px, 100vw−48px)` wide, max-height `min(74vh, 640px)`, centered fixed, card bg, 1px border, radius ~18px, heavy shadow, over a backdrop (black at 28% light / 50% dark). Header: kind tile (26px), filename 13.5px/700, ‹ › × buttons (26px square, 1px border, radius 8px). Body: text/markdown/code files render content in mono 12.5px/1.7 pre-wrap; other kinds show a 120px poster tile with the extension. Footer: meta (size · modified) left, "N of M · SPACE to close" right, mono 10px `inkFaint`.

### Search module
Input with left search icon, right-embedded segmented scope toggle (Here / All). While a query or filter is active, a chip row appears under the field (5px gap, horizontally scrollable): **Docs, Images, Audio, Code, ★ Starred**. Chip: 22px tall, pill, mono 9.5px; inactive = 1px `border` transparent bg `inkSoft`; active = accent border at 50%, accent bg at 14%, accent text, weight 700. Chips AND the query (name+kind+ext+tags, case-insensitive); kind chips are mutually exclusive; Starred stacks with any.

### Working Sets module (left rail)
Rows: folder/lightning icon, name, count badge right (mono). Sets with a note or smart status render a second line (10px, `inkFaint`, ellipsized): the note text, or "smart · fills itself". Smart sets use a lightning-bolt stroke icon.
- **Manual sets** hold `{dir, name}` refs. Add via item context menu ("Add to …" — smart sets excluded from this list).
- **Smart sets** hold a rule (`{ext?, kind?, starred?, minMt?}`; `mt` is a sortable date int) and compute membership live across the whole disk (folders and dotfiles excluded).
- **Reference integrity (critical)**: every move / rename / trash / restore / permanent delete updates set refs; every undo reverses that. A set item whose file vanished renders as a "missing" ghost row.
- Opening a set shows its items as a virtual folder (kicker: "Working set · references, not copies" or "Smart set · fills itself from rules"; sub line includes count and the note in quotes).
- Header context menu: New working set…, New smart set…, Import set code…. Set context menu: Open, Add/Edit note…, Bind/Rebind current look & layout (stores an environment snapshot; opening the set then applies it), Unbind, Copy set code (`GYSET.` + base64 JSON of {name, note, smart, rule, items}), Rename, Duplicate, Remove.

### Timeline module
Disk-wide journal grouped by day ("TODAY / YESTERDAY / THIS WEEK", mono 9.5px caps 700). Row: 7px colored dot (kind tint / accent), "**Action** target" 12px (action 600 in `ink`, rest `inkSoft`), time right-aligned mono 9px `inkFaint`. Rows click through to the file. Feed = live session events + seeded history.

### Duplicates module
Same-name + same-size pairs across folders (max 8 groups). Row: filename 12.5px/600 + orange `#D9773F` count badge ("2×", mono 9.5px/700), second line with locations (mono 9.5px, `~`-abbreviated, "·"-joined). Click navigates to the first copy and selects it. Empty state: "No duplicates found — the keeper is tidy."

### Details panel
Selected file: big kind icon (70px), name, kind label, property rows (mono labels), per-file activity timeline ("what this file remembers"), related-file links, preview snippet. Multi-select: count + total size summary. Nothing selected: folder summary. No tab bar.

### Other modules
Places/Devices (nav lists; places and crumbs are drag-drop targets with accent-tint highlight + inset accent ring), Location bar (breadcrumbs, ellipsized at 190px max per crumb), Nav (back/forward/up, history-aware dimming), Viewswitch (grid/list + sort), Title (folder name + kicker + item count), Disk usage (stacked bar), Recent (compact activity list), Clock, Visualizer (decorative), Folder mood (stroke-drawn SVG glyph in a 40px rounded tile tinted by a "tidiness" score + quip line), Status bar, Appearance (full panel: Skins / Style / Layout tabs — skin cards, accent swatches, font/tile/density/icon/motion segments, background patterns, list-column chips, layout presets, workspaces, export/import codes).

## Interactions & Behavior

### Keyboard map (global; suppressed while typing in inputs)
| Key | Action |
|---|---|
| Space | Quick Look toggle (in overlay: close) |
| ← → ↑ ↓ | Move selection; grid is column-aware (computed from tile offsets); Shift extends range from anchor; scrolls cursor into view (±10px margin). In Quick Look: step preview |
| S | Toggle star on selection (multi-aware: all-on → unstar all) |
| Enter | Open; F2 rename; Backspace go up |
| Ctrl/Cmd+Z | Undo (20-step stack) |
| Ctrl/Cmd+X / C / V / A | Cut / copy / paste / select all |
| Delete | Trash (in Trash view: permanent delete, guarded) |
| Escape | Staged: 1st closes menu, 2nd clears selection |

### Selection
Click = single; Ctrl/Cmd+click = toggle; Shift+click = range from anchor; drag any selected item drags the whole selection. Multi-drag shows an "N items" drag badge (dark pill, `ink` bg / `bg` text, 12px/600).

### File operations & memory
Every operation logs an event to the file's history and the global feed. Moves/renames/trash/restore update: set references, ghost trails (add at source / remove on return), and folder subtrees (a trashed folder's contents travel with it and come back on restore). **Permanent delete** requires the action twice within 4 seconds (first attempt shows a warning toast); it is the only unrecoverable operation. Undo reverses every operation completely, including set refs and ghosts.

### Context menus
Context-aware by target: item (Open, Quick Look, Star/Remove star, Open in lower pane [folders], Cut/Copy/Duplicate, Add to set…, Rename, Trash), blank (New Folder / New Text File / New Markdown Note, Paste, Select all, view toggles), trash item (Restore, Delete permanently), place, device, set, sets-header, crumb, module (settings, edit layout, hide). Danger actions in red, separated group.

### Prototype-isms to replace
The prototype uses `prompt()` for: set name, smart-set name, set note, rename set, import codes. Build proper inline inputs or small modal forms in the design language (card bg, 1px border, radius ~12px, mono section labels).

### Motion
Menus/overlays: ~120-140ms ease scale-fade (`gy-in`). Respect the user's motion setting (a token: full / reduced). Toast: bottom-center pill, auto-dismisses.

## State Management

Core state: `path`, `path2`, `hist`/`hi` (navigation history), `selected[]`, `anchor`, `view` (grid/list), `sortKey`/`sortDir`, `query`, `searchScope`, `filters {kind, starred}`, `preview` (Quick Look id), `setId`, `trashView`, `renaming`, `clip {mode, items}`, `menu`, `toast`, `editMode`, layout (`layout {6 zones}`, `centerSplit`, ratios, rail widths), appearance (`skin`, `ov` overrides, `glow`, `motion`, `columns`, `density`…), `workspaces[]`.

Instance (non-render) state: `fs` (dir → entries map), `fileEvents` (per-file history), `setDefs[]` (`{id, name, note?, smart?, rule?, snap?, items[]}`), `ghosts` (dir → up to 3 `{name, to, toDir}`), undo stack (last 20 `{label, fn}`).

Persisted: appearance + layout + workspaces + `path2` (prototype: localStorage key; production: settings store). File data comes from the real filesystem; events/sets/ghosts need a small local database (SQLite fits Tauri/Electron).

## Design Tokens

**Type stack** (Google Fonts): Hanken Grotesk (UI, 400-800), JetBrains Mono (meta/labels/code, 400-700), Spectral (optional serif font setting). Scale: UI text 12.5-14px; module titles mono ~10px uppercase +.12em; big title ~20-26px/800; meta 9-10.5px mono.

**Token set per skin**: `bg, surface, main, card, ink, inkSoft, inkFaint, border, accent` + kind tints. The eight skins (name — mode — bg / card / ink / accent):
- **Parchment** (default) — light — `#EFE9DE` / `#FBF8F2` / `#211D17` / `#2C6E49`; surface `#E7E0D2`, main `#F3EEE4`, inkSoft `#5F5849`, inkFaint `#7E7359`
- **Obsidian** — dark — `#0B0D10` / `#171B21` / `#E8ECF1`; surface `#101318`, inkSoft `#9AA4B0`, inkFaint `#5C6672`
- **Phosphor** — dark green terminal — `#050A06` / `#0C160E` / `#8CF5A6`; inkSoft `#4A9E63`, inkFaint `#2E6440`
- **Nord** — dark — `#2E3440` / `#3B4252` / `#ECEFF4`; inkSoft `#AEB6C6`, inkFaint `#6D7488`
- **Amber CRT** — dark — `#140F08` / `#20180F` / `#F5C877`; inkSoft `#B0812F`, inkFaint `#9A7B36`
- **Plasma** — light — `#EEF1F6` / `#FFFFFF` / `#1D2733`; inkSoft `#566072`, inkFaint `#98A2B3`
- **Synthwave** — dark — `#17091F` / `#2A1139` / `#F6E7FF`; inkSoft `#BC93D8`, inkFaint `#7C5C97`
- (One more skin plus full accent/tint values: read `SKINS` in `Geyma.dc.html`, ~line 325.)

Accent palette (user-selectable on any skin): `#2C6E49 #2C7DD6 #B4562E #7A4B8C #C6427A #D89B2B #35D0C0 #E4572E`. Duplicate-count badge: `#D9773F`.

**Radii**: user-tweakable radius token; defaults ≈ tiles/cards 10-16px, chips/pills 99px, buttons 7-8px, overlay 18px. **Borders**: 1px token `border`; dashed 1.5px at 25-30% ink alpha for ghosts/empty drop targets. **Alpha conventions**: accent tint bg 8-16%, selection ring 1.5px solid accent, kind tint bg ~10-14%.

**Accessibility**: `:focus-visible` = 2px `currentColor` outline, offset 2px (never remove without replacement). Placeholders = `currentColor` at 45% opacity. `inkFaint` must stay ≥ ~4:1 against `card` for data-bearing text (sizes, dates).

## Assets

None external. All icons are inline stroke SVGs (round caps/joins, stroke ~1.7-1.9, 24×24 viewBox) drawn in the prototype — lift the path data directly from the source. Fonts load from Google Fonts. Background patterns (dots/grid/none) are generated CSS.

## Files

- `Geyma.dc.html` — the complete prototype: template (markup) + `Component` class (all logic, module renderers, skins, seeded data). **The authoritative reference.**
- `Audit Report.dc.html` — QA audit (20 findings, all fixed) documenting subtle behaviors worth preserving: undo semantics, set-reference integrity, trash subtree handling, layout guardrails.
- `Feature Ideas.dc.html` — feature rationale with visual mockups of Quick Look, Timeline, Smart sets, and Ghost trails.
- `support.js` — prototype runtime shim. Not part of the design; do not port.
