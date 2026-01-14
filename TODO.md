# Geyma (Fedora KDE) – Extensive TODO List

**Stack:** Python 3 + **PySide6 (Qt 6)** + (initially) `pathlib/os/shutil` + optional `watchdog` + optional `GIO` later for GVfs

## Phase 0: Scope + Rules

* [x] Define v1 scope (KDE-first, local filesystem):

  * [x] Browse local filesystems
  * [x] Basic operations: rename, delete (trash), copy/move with progress
  * [x] Sorting, filtering, hidden files toggle
  * [x] File open via default apps
* [x] Decide v1 non-goals:

  * [x] Network browsing (smb/sftp) unless using GVfs later
  * [x] Full thumbnail system (do minimal first)
  * [x] Plugin system

---

## Phase 1: Project Setup

* [x] Create repo layout:

  * [x] `geyma/`
  * [x] `geyma/ui/`
  * [x] `geyma/fs/`
  * [x] `geyma/models/`
  * [x] `geyma/ops/`
  * [x] `geyma/utils/`
* [x] Set up PySide6 dev environment
* [x] Add lint/format (ruff/black) if you’re being responsible
* [x] Logging:

  * [x] `~/.cache/geyma/logs/`
* [x] Config:

  * [x] `~/.config/geyma/config.json` (or QSettings)

---

## Phase 2: UI Shell (KDE-friendly)

* [x] MainWindow layout:

  * [x] Top toolbar (Back/Forward/Up/Refresh/Search)
  * [x] Breadcrumb path bar
  * [x] Splitter:

    * [x] Left: Places/Bookmarks/Devices
    * [x] Right: File view (list/grid toggle)
  * [x] Bottom status bar (items count, selection size)
* [x] Global shortcuts:

  * [x] Back: Alt+Left
  * [x] Forward: Alt+Right
  * [x] Up: Alt+Up
  * [x] Refresh: F5
  * [x] Delete to trash: Del
  * [x] Permanent delete: Shift+Del (confirm)
  * [x] New folder: Ctrl+Shift+N
  * [x] Search focus: Ctrl+F
  * [x] Rename: F2

---

## Phase 3: Navigation System (don’t wing it)

* [x] Implement navigation history stack
* [x] Implement `go_to(path)`
* [x] Implement breadcrumbs:

  * [x] clickable segments
  * [x] editable path entry (type a path, press Enter)
* [x] Implement sidebar Places:

  * [x] Home, Desktop, Downloads, Documents, Pictures, Videos, Music
  * [x] Root `/`
  * [x] Trash
* [ ] Device detection (v1: minimal):

  * [x] Read `/run/media/$USER` for mounted removable drives
  * [ ] Later: integrate Solid/UDisks via DBus if you want it proper

---

## Phase 4: Directory Listing (performance matters early)

* [ ] Create `DirectoryModel`:

  * [ ] returns list of `FileItem`
  * [ ] supports sorting/filtering
* [x] Use `QFileSystemModel` (recommended for v1 browsing):

  * [x] handles file info, icons, updates reasonably well
  * [x] integrates naturally with Qt views
* [ ] Implement views:

  * [x] List view (details): name, size, type, modified
  * [x] Grid/icon view (optional v1.1, but plan it)
* [ ] Add sort options:

  * [x] Name, Size, Type, Modified
  * [x] Asc/Desc
* [ ] Hidden files toggle:

  * [x] show dotfiles

---

## Phase 5: Selection + Context Menus

* [x] Selection model:

  * [x] multi-select
  * [x] status bar updates (count + total size)
* [ ] Right-click context menu:

  * [x] Open
  * [x] Open with…
  * [x] Copy, Cut, Paste
  * [x] Rename
  * [x] Move to Trash
  * [x] Properties
* [ ] Blank-area context menu:

  * [x] New folder
  * [x] New file (optional)
  * [x] Paste
  * [x] Sort by
  * [x] Show hidden

---

## Phase 6: File Operations (the part where bugs breed)

### Clipboard operations

* [x] Implement internal clipboard for:

  * [x] copy list of paths
  * [x] cut list of paths
* [x] Paste into current folder:

  * [x] resolves collisions (replace/skip/rename)
  * [x] supports directories recursively
  * [x] preserves permissions/timestamps (best-effort)

### Copy/Move engine (must be async)

* [x] Implement operation runner:

  * [x] runs in worker thread (QThread/QRunnable)
  * [x] emits progress signals
  * [x] supports cancel
* [x] Copy files:

  * [x] chunked copy for progress
* [x] Copy folders:

  * [x] recursive walk
  * [x] progress by total bytes (pre-scan) OR by item count (simpler)
* [x] Move:

  * [x] same filesystem: rename() fast path
  * [x] cross-device: copy+delete fallback

### Rename

* [x] Inline rename in view
* [x] F2 triggers rename
* [ ] Validation:

  * [x] empty names blocked
  * [x] existing collision prompts

### Delete / Trash

* [x] Implement Trash using **freedesktop.org Trash spec**

  * [x] Move file to `~/.local/share/Trash/files`
  * [x] Create `.trashinfo` in `~/.local/share/Trash/info`
* [x] “Empty Trash” action
* [x] Restore from Trash (later, but plan for it)

### Permanent delete

* [x] Shift+Del confirmation dialog
* [x] Secure delete is NOT a goal (don’t pretend)

---

## Phase 7: Progress + Conflicts UI

* [x] Operation progress dialog:

  * [x] current file name
  * [x] overall percent
  * [x] speed/ETA (optional)
  * [x] cancel button
* [x] Conflict resolution dialog:

  * [x] Replace
  * [x] Skip
  * [x] Rename (auto-increment)
  * [x] Apply to all
* [x] Error dialog:

  * [x] permission denied
  * [x] file in use
  * [x] path too long
  * [x] missing source mid-op

---

## Phase 8: File Opening + “Open With”

* [x] Open file using default app:

  * [x] Use system default opener (`kioclient`/`gio`/`xdg-open`)
* [x] Open folder in new tab/window (optional)
* [x] “Open with…”:

  * [ ] minimal: show system handler list (hard)
  * [x] v1 compromise: “Open with…” file picker to choose an app binary

---

## Phase 9: Properties Dialog

* [x] Show:

  * [x] name, path
  * [x] type (mime)
  * [x] size (files + folder total)
  * [x] created/modified/access times
  * [x] permissions (rwx)
  * [x] owner/group (read-only v1)
* [x] Folder size calculation async + cancellable

---

## Phase 10: Live Updates (don’t refresh like a caveman)

* [x] For v1 with `QFileSystemModel`, confirm it updates automatically
* [x] If gaps:

  * [x] add `QFileSystemWatcher` for current directory
  * [x] debounce refreshes during bulk operations

---

## Phase 11: Search (v1: simple, v1.5: real)

* [x] v1: filter current folder by name substring
* [x] v1.5: recursive search in subtree (async)
* [ ] v2: content search via `ripgrep` integration (optional)

---

## Phase 12: Visual Polish (KDE-ish, not clownish)

* [x] Use Qt’s default Fusion/Breeze integration where possible
* [x] Ensure spacing and icon sizes match Plasma expectations
* [x] Add toolbar icons using system icon theme (`QIcon.fromTheme`)
* [x] Add empty states:

  * [x] empty folder
  * [x] no results in filter
  * [x] permission denied

---

## Phase 13: Packaging for Fedora KDE

* [x] Create `.desktop` file
* [x] App icon (SVG + PNG sizes)
* [x] Build RPM spec (Fedora)
* [ ] AppImage (easy-ish)
* [ ] Decide if Flatpak is worth it for a file manager (sandbox friction, likely no for v1)

---

## Phase 14: Testing Scenarios (where file managers die)

* [ ] Folder with 50k files
* [ ] Deep nested directories
* [ ] Unicode filenames (Norwegian chars, emojis, combining marks)
* [ ] Permission denied folders (`/root`, system dirs)
* [ ] Symlink loops (don’t recurse infinitely)
* [ ] Copy across devices (`/run/media/...`)
* [ ] Conflicts on paste
* [ ] Cancel mid-copy and verify consistency

---

## Phase 15: v1 Release Checklist

* [ ] Browse reliably
* [ ] Copy/move with progress + cancel
* [ ] Trash works per spec
* [ ] Rename/delete/create folder stable
* [ ] Doesn’t freeze UI
* [ ] Logs useful errors
* [ ] Keyboard shortcuts implemented
* [ ] Ship

---

## Notes (so you don’t step on rakes)

* **QFileSystemModel** is your friend for v1. It gives you 70% of a file manager “for free”.
* Trash support is *not* built-in in a way that matches Plasma expectations, so implementing the freedesktop Trash spec is worth it.
* Network browsing on KDE usually goes through KIO. Doing real KIO integration from Python is possible but not “v1 friendly”. Start local.
