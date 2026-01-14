# Geyma File Manager

**Geyma** is a deliberate, local-first file manager focused on clarity, speed, and user control. It provides a clean, responsive desktop experience with powerful search tools and optional BYOK AI helpers that never act without approval.

Geyma is built with **Python + PySide6** and is designed to feel predictable, fast, and respectful of your data.

---

## Highlights

* Local-first file management with explicit, previewed actions
* Clean, polished UI with optional custom title bar and modern theming
* List and icon views with breadcrumbs and a sidebar for Places, Devices, Bookmarks, and Network
* Inline search with configurable scope (current folder / recursive / system)
* Context menus, rename, copy/cut/paste, and trash handling
* Properties dialog with permissions and detailed metadata
* Optional BYOK AI tools:

  * Natural language filters
  * Folder summaries
  * Rename suggestions
  * Image generation and variations

---

## Quick start

```bash
python -m geyma
```

---

## Install dependencies

```bash
python -m pip install -r requirements.txt
```

You need **PySide6**.

For AI key storage, installing `keyring` is recommended.
Without it, API keys can be stored locally **only if explicitly enabled** in Settings.

## Fedora (RPM)

Local RPM build instructions live at `packaging/fedora/README.md`.

---

## Settings and data locations

* Config: `~/.config/geyma/config.json`
* Logs: `~/.cache/geyma/logs/geyma.log`

If upgrading from a previous internal prototype, Geyma will migrate existing configuration automatically on first run.

---

## AI (BYOK)

AI features are optional and disabled by default. You bring your own API key.

Available AI helpers include:

* Natural language filters (preview and edit before execution)
* Folder summaries (metadata only)
* Rename suggestions (preview with per-item approval)
* Image generation and image-based variations

AI helpers suggest actions. **Geyma executes them**.

Geyma always shows a preview of data being sent and never performs file operations without your explicit approval.

---

## Useful shortcuts

* `Ctrl+F`: inline search
* `Ctrl+Shift+F`: inline search (recursive)
* `F2`: rename
* `Del`: move to trash
* `Shift+Del`: permanent delete
* `Ctrl+Shift+N`: new folder
* `F5`: refresh

---

## Development notes

* `geyma/` contains the application code
* `geyma.desktop` defines the desktop entry
* `assets/` contains the application icon and visual resources

---

## License

To be finalized before first release.
