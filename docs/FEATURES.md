# Geyma — full feature reference

Everything the file manager can do, from the basics to the unusual bits. Geyma's tagline
is "a file manager that remembers" — alongside the standard browse/copy/paste core it
keeps a persistent memory of where files came from, where they went, and what you did to
them.

For architecture (how these features are implemented) see `CLAUDE.md`; for known gaps
and audit findings see `docs/AUDIT.md`.

---

## Browsing & navigation

- **Folder browsing** with two views: **grid** (tiles) and **list** (rows). The list
  view has toggleable columns: kind, size, modified.
- **Sorting** by name, kind, size, or modified date, ascending or descending.
- **Breadcrumb location bar** — each path segment is clickable; right-clicking a crumb
  offers Open, Open in new tab, Open in lower pane, and Copy path.
- **Back / Forward / Up** navigation with full per-tab history. Backspace goes up a
  folder; "Up" knows to disable itself at `/`, at an SMB share root, etc.
- **Places** sidebar — Home, Desktop, Documents, Downloads, Pictures, Videos, Music,
  plus an optional Trash entry.
- **Devices** sidebar — mounted removable drives and media (from `/run/media` and
  `/media`).
- **Hidden files toggle** (dotfiles), off by default.
- **Startup mode** — either resume exactly the tabs you had open last session, or start
  fresh at Home (Settings → General).

## Tabs

- Multiple tabs, each with its own path, history, Trash-view flag, and active Working
  Set.
- New tab (`Ctrl+T`), close tab (`Ctrl+W`), duplicate tab, close other tabs, close tabs
  to the right, drag to reorder.
- `Ctrl+Tab` / `Ctrl+Shift+Tab` cycles tabs; `Ctrl+1`–`Ctrl+9` jumps straight to a tab.
- "New tabs open at Home" is a settings toggle (otherwise they inherit the current
  folder).

## Dual-pane browsing

- A **second file pane** ("lower pane") can be toggled into the center split. Any
  folder can be sent to it from a context menu ("Open in lower pane"), and the split
  ratio between the two panes is draggable and persisted.

## Selection & keyboard control

- Click, `Ctrl`-click (toggle), and `Shift`-click (range) selection; `Ctrl+A` select
  all; `Escape` clears.
- **Full keyboard navigation**: arrow keys move through the grid (aware of the actual
  number of columns on screen), `Shift`+arrows extends the selection from the anchor,
  `Enter` opens (folders navigate, files open in the OS default app), `F2` renames,
  `Space` opens Quick Look, `S` stars.
- The **status bar** shows the item count, selection count + combined size, current
  clipboard contents, and the full current path.

## Core file operations

Every operation works on multi-selections, shows human-readable error toasts when
something fails (see "Explain errors" below), and — where meaningful — registers an
undo action.

- **Copy / Cut / Paste** (`Ctrl+C` / `Ctrl+X` / `Ctrl+V`) with automatic
  "name (2)"-style uniquing on collision.
- **Move by drag-and-drop** — drop onto any folder tile/row in either pane. Existing
  targets are never silently overwritten.
- **Rename** inline (`F2` or context menu), with overwrite protection.
- **Batch rename** — select multiple files → "Batch rename…" opens a template modal:
  `{name}` expands to the original base name and runs of `#` become zero-padded
  sequence numbers, with a live preview of every resulting name. Extensions are
  preserved for files. Optionally, local AI can suggest a naming scheme (see AI below).
- **Duplicate** (single or many) with unique-name generation.
- **New Folder / New Text File / New Markdown Note** from the blank-space context menu;
  the new entry is created selected and already in rename mode.
- **Open with default app** — files open via the OS handler (`Enter` or double-click).
- **Copy path(s)** to the system clipboard from any file's context menu.
- **Symlinks** — "Create Symlink Here" makes a sibling symlink to the selected file
  (local folders, Unix only). Symlink targets are shown in Properties.
- **Properties dialog** — kind, size, timestamps, owner (uid) and group (gid), symlink
  target, and a **permissions editor**: a 3×3 read/write/execute checkbox matrix with
  the live octal mode (e.g. `644`), applied immediately via chmod.

## Trash, deletion & safety

- **Trash** is app-managed and recoverable: trashed items move to Geyma's own trash
  folder, and Geyma records each item's **origin** so Restore puts it back exactly
  where it came from — even across restarts (origins are persisted).
- A dedicated **Trash view** lists trashed items with Restore and Delete-permanently
  actions.
- **Permanent delete is double-press-to-confirm**: the first invocation arms the
  action, and only a second confirmation within a configurable time window (Settings →
  Confirmations) actually deletes. Optional confirmation can also be required for
  ordinary trashing.
- **Undo** (`Ctrl+Z`) — a 20-deep undo stack. Every mutating operation (move, rename,
  trash, restore, paste, duplicate, batch rename…) pushes its own inverse, so undo
  really moves things back, re-trashes copies, restores names, etc.
- **Per-event undo** — beyond the global stack, each entry in a file's activity
  timeline (Details panel) that changed the file's path can be undone individually.

## Archives

- **Preview without extracting** — Quick Look on an archive lists its contents (names,
  sizes, compressed sizes where the format provides them) without writing anything to
  disk.
- **Extract Here** for ZIP, TAR (plain, `.tar.gz`/`.tgz`, `.tar.bz2`/`.tbz2`/`.tbz`,
  `.tar.xz`/`.txz`), and 7z — all via pure-Rust readers, no system dependencies.
  Compound suffixes are understood, so `project.tar.gz` suggests the folder name
  `project`.
- **Compress to ZIP** — any selection (files and folders, recursively) into a new ZIP.
- **Safety limits** baked into extraction: zip-slip path-escape protection, an entry
  count cap, and a total-bytes-written cap so a hostile archive ("zip bomb") can't
  fill the disk. RAR is deliberately unsupported (no mature pure-Rust reader).

## Search & filtering

- **Search-as-you-type** over the current folder, or **"All" scope** which recursively
  searches from Home.
- **Kind filter chips** — Docs / Images / Audio / Code — and a **starred-only** filter,
  combinable with the text query.
- **Natural-language search (local AI, optional)** — with a local model running, a
  query like "starred photos from last week" is converted into the structured
  query/kind/starred filters and applied.
- **Save as Set** — the current query + filters can be saved as a Smart Working Set in
  one click (see Working Sets below).
- Search, filters, sort, and hidden-file visibility all funnel through one
  `visibleEntries()` pipeline, so the grid, item counts, keyboard navigation,
  select-all, and Quick Look stepping always agree on what's visible.

## Quick Look (previews)

`Space` opens a large in-app preview; arrow keys step through the current folder's
visible files without closing it.

- **Images** — PNG, JPEG, GIF, WebP, SVG.
- **Audio / video** — MP3, FLAC, WAV, OGG, MP4, WebM, MOV, MKV, streamed through a
  token-guarded localhost media server (WebKitGTK can't stream media through Tauri's
  asset protocol). Before opening a media element, Geyma **preflights the GStreamer
  pipeline** — if the needed plugin is missing it shows a friendly explanation with the
  exact install command for your distro (Arch, Debian/Ubuntu, Fedora, openSUSE) instead
  of freezing the webview.
- **PDF** — embedded page preview.
- **Text & code** — with syntax highlighting for common languages, plus a
  truncation notice for very large files.
- **Archives** — entry listing (see Archives above).
- **Folders** — a quick listing of the folder's contents.

The Details panel has a smaller inline preview of the selected file (image thumbnail or
first ~1,600 characters of text).

## A file manager that remembers

The signature features — three distinct "memories", all persisted across restarts:

- **File journey (activity timeline)** — every file keeps its own event log (created,
  renamed, moved here from X, copied, trashed, restored…), shown in the Details panel,
  capped at 200 events per file. Events that changed the file's location can be
  individually undone from the timeline.
- **Ghost trails** — when a file leaves a folder, it leaves a "ghost" tile behind
  (capped at 3 per folder) showing where it went; clicking the ghost follows it to its
  new home. Ghosts clear automatically if the file comes back.
- **Timeline / Recent activity** — a global, disk-wide feed of the last 60 operations
  (Timeline module), with a compact "Recent activity" widget variant (3/6/10 items).
- **Stars** — mark any file or folder (`S`); starred items get a badge, a filter, and
  can drive smart sets.
- **Duplicates spotter** — a sidebar module that flags files with identical name + size
  seen across the folders you've visited, so you can jump to and clean them up.

## Working Sets

Cross-folder collections of file *references* (never copies) — like playlists for
files.

- **Manual sets** — add any files from any folders via the context menu ("Add to …").
- **Smart sets** — rule-driven, recomputed live. Rules are built in a **visual rule
  editor**: file kind, extension list, name-contains, min/max size,
  modified-within-N-days, and starred, combined as **ALL** or **ANY**.
- **Scope roots** — a rule can be limited to specific folders; those folders are
  scanned (recursively, bounded) every time the set opens, so matches don't depend on
  where you happen to have browsed. Without roots, a rule matches anywhere you've
  visited.
- **Hybrid sets** — any manual set can also carry a rule ("Add rule…" in its context
  menu): it then shows your hand-picked items *plus* the rule's live matches, deduped.
- **Save a search as a Smart Set** — the search bar's "Save as Set" chip opens the rule
  editor prefilled from the current query and filter chips.
- **Missing-file tracking** — a reference whose folder is loaded but whose file is gone
  is surfaced, not silently dropped: an amber `!n` badge in the sidebar and an
  expandable banner in the set view list each missing item with its last-known folder,
  plus **Locate…** (relinks by filename across browsed/scanned folders, with a picker
  menu when several candidates exist) and **Remove**.
- **Per-set metadata** — color, icon, pin (pinned sets sort to the top), archive
  (archived sets collapse into their own section), a free-text **note**, and
  created / last-used timestamps.
- Sets can be renamed, duplicated, and removed.
- **Portable sets** — export as a compact `GYSET.…` clipboard code or as a versioned
  **`.gyset` file** (written to your home folder). Import by pasting either form into
  "Import set…", or simply open a `.gyset` file in the file grid.
- References are **self-healing**: every move/rename/trash/restore updates set items to
  keep pointing at the right file; permanent deletion drops the reference.
- Opening a set shows its members as a virtual folder view.

## Network places (SFTP & SMB)

- **Saved connections** for SFTP (SSH) and SMB (Windows shares / NAS), with label,
  host, port, username, and share. Connection status (disconnected / connecting /
  connected / error) is shown live in the Network sidebar.
- **Passwords in the OS keyring**, strictly opt-in ("Remember password") — never stored
  in plain text. Otherwise a password prompt appears on connect.
- **SFTP server identity is pinned on first connect** (trust-on-first-use, like ssh):
  if the server's key later changes, the connection is refused and a "Server identity
  changed" prompt shows both fingerprints — trusting the new key (server reinstalled,
  key rotated) is an explicit choice, never automatic.
- Remote paths (`sftp://…`, `smb://…`) flow through the same navigation, tabs, working
  sets, and history as local paths — you browse a NAS the same way you browse Home.
- Supported remotely: **browse, rename, move/copy within a connection, permanent
  delete, upload/download and copy between local and remote** (drag-and-drop or
  copy/paste across panes), text preview.
- Deliberately unsupported remotely (clear error / hidden menu items rather than silent
  failure): Trash (remote delete is permanent, with the same double-press confirm),
  symlinks, permissions, archive extraction.
- Remote text previews are size-capped so a hostile server can't OOM the app.
- **SMB device discovery** — the Network sidebar's "Nearby devices" section scans the
  local network (mDNS/DNS-SD, `_smb._tcp`) and shows what it finds as a tree: expand a
  device, sign in (or browse as guest), and its disk shares list as children; clicking
  a share saves a connection, connects, and opens the share in a new tab. Hidden
  administrative shares (`C$`, `ADMIN$`, …) and printer/IPC shares are filtered out.
  Devices that only announce over WS-Discovery (stock Windows) won't appear in the
  scan — manual entry still covers those.
- In dev mode (plain browser), two simulated demo connections exist so the whole
  connect/browse/copy flow is clickable without a real server (password: `demo`), and
  the device scan finds two simulated devices ("Office NAS", "Studio Pi") whose shares
  enumerate with any username and password `demo`.

## Local AI (optional, via Ollama)

Everything is local — no cloud calls, no API keys. The whole subsystem is opt-in and
off until you set it up in Settings → AI.

- **Guided install** — detects whether Ollama is present and can install it via the
  official script (elevated through `pkexec`), streaming the install log into the UI.
- **Server control** — start/stop the Ollama server from Settings; status is polled.
- **Model management** — pull models by name (with live download progress), list, and
  delete them; pick the active model.
- Three independently toggleable features:
  - **Natural-language search** (Search module) — free-text request → structured
    filters.
  - **Rename suggestions** (Batch rename modal) — proposes a template for the selected
    files.
  - **Folder summaries** (Details panel) — a 2–3 sentence plain-language summary of
    what a folder contains, on demand.

## Disk & system info

- **Disk usage module** — total/used/free for the current location's filesystem.
- **Devices module** — removable media, clickable to browse.

## Layout: modular chrome

The entire UI is built from **21 modules** arranged in **6 zones** (top, left, center,
second-center, right, bottom):

Tabs, Navigation, Location bar, Search, View & sort, Folder title, Files, Second pane,
Details, Places, Devices, Network, Working Sets, Disk usage, Recent activity, Timeline,
Duplicates, Clock, Visualizer, Folder mood, Status bar.

- **Edit mode** — drag modules between zones, reorder them, hide them, and restore
  hidden ones from a chip strip.
- **8 layout presets** — Classic, Focus, Minimal, Commander, Right rail, Dashboard,
  Bottom dock, Stacked — plus full reset.
- **Resizable rails** (left/right sidebar widths) and center split ratio, all
  persisted.
- **Per-module options** via each module's ⋯ menu — e.g. the Clock's 24-hour/seconds/
  date toggles, Recent's item count, whether Places shows Trash, which toolbar buttons
  View & sort displays, the Files module's own default view, Details' preview/memory/
  activity sections, the Visualizer's bar count.

### Ambient / fun modules

- **Clock** — time and date widget.
- **Visualizer** — a decorative animated bar visualizer.
- **Folder mood** — a playful read on the current folder ("Empty", "Organised",
  "Bursting") with a matching quip.

## Appearance & theming

- **8 built-in skins**: Parchment (light), Obsidian (dark), Phosphor (green terminal),
  Nord (frost dark), Amber CRT, Plasma (light breeze), Synthwave (outrun dark), and
  Paper (minimal light). Each defines the full palette, font stack, corner radius,
  tile style, icon treatment, and background pattern.
- **Per-token overrides** on top of any skin: accent color, font family, corner
  radius, tile style (flat/card), monochrome icons, background pattern (none/grid/
  dots).
- **Motion setting** and a **glow** toggle for reduced/extra visual flair.
- Everything is theme-token driven, so all skins and overrides apply across every
  module consistently.

## Settings

A Settings modal with four tabs:

- **Appearance** — skins, style overrides, layout presets (same controls as the
  Appearance module).
- **Confirmations** — confirm-before-trash, confirm-before-permanent-delete, and the
  arm/confirm time window for the double-press flow.
- **General** — show hidden files, new-tabs-at-Home, startup mode (resume last session
  vs. start at Home).
- **AI** — the whole local-AI stack described above.

Nearly all state — layout, skin, overrides, columns, sort, stars, sets, tabs, trash
origins, file journeys, timeline, confirmations, AI toggles — persists across
restarts (localStorage under the `geyma-v1` key).

## Feedback & resilience

- **Structured errors end to end** — every backend operation reports a stable error code
  (`permission_denied`, `disk_full`, `already_exists`, `auth_failed`, …) that's translated
  into a plain-language explanation; the raw technical message is kept as a smaller detail
  line, never the headline.
- **Error toasts that don't fight you** — failures show as a short headline ("Rename
  failed") with the explanation underneath, stay up longer than info toasts, stack (up to
  three) instead of overwriting each other, dedupe repeats, and can be clicked away. Long
  messages wrap and clamp, so a noisy error can never stretch or break the layout.
- **Failed folder loads look like failures** — a folder that can't be read shows
  "This folder couldn't be loaded" with the reason and a Retry button, instead of
  pretending to be empty.
- **Panels degrade, the app survives** — if a module crashes, only that panel shows an
  error state (with "Reload panel"); the rest of the app keeps working. Unhandled errors
  anywhere still surface as an error toast rather than dying silently.
- **Toasts** for operation successes and confirmations.

## Keyboard shortcuts (summary)

| Shortcut | Action |
| --- | --- |
| `Space` | Quick Look selected file / close preview |
| `←→↑↓` | Move selection (grid-aware); step preview while Quick Look is open |
| `Shift+arrows` | Extend selection from anchor |
| `Enter` | Open folder / open file in default app |
| `F2` | Rename |
| `S` | Star / unstar selection |
| `Backspace` | Go up a folder |
| `Delete` | Trash (or permanent delete in Trash view / on remote) |
| `Escape` | Clear selection / close overlay |
| `Ctrl+A` | Select all |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / cut / paste |
| `Ctrl+Z` | Undo |
| `Ctrl+T` / `Ctrl+W` | New / close tab |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | Next / previous tab |
| `Ctrl+1`–`9` | Jump to tab |

(`Cmd` works in place of `Ctrl` on macOS.)

## Platform & under the hood (user-visible bits)

- **Desktop app** built on Tauri 2 (Rust backend + webview UI); packaged as `.deb`,
  `.rpm`, an Arch `.pkg.tar.zst`, a Flatpak, and a Snap.
- **Browser dev mode** — running the frontend outside Tauri automatically switches to
  an in-memory mock filesystem, so the full UI (including simulated network places) is
  explorable in a plain browser.
- **Security guards** users benefit from without seeing: IPC name parameters are
  validated against path traversal, the media server only serves previewable media
  types to the app itself (constant-time token check + anti-DNS-rebinding host check),
  archive extraction is sandboxed against zip-slip and bombs, and remote passwords only
  ever live in the OS keyring.
