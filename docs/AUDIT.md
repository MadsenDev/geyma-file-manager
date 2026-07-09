# Codebase audit — 2026-07

A full security / correctness / dead-code / feature-parity pass over the app. Two
data-loss bugs and three security gaps were fixed directly (see git history around this
file's introduction), and a follow-up pass resolved most of the remaining findings (see
"Resolved" below). Everything under "Open" is still unfixed — findings worth knowing
about, left for a deliberate follow-up.

## Open

### Security

- **`tauri.conf.json` sets `"csp": null`**, which removes Tauri's default
  script-injection hardening. The IPC boundary now validates name params (see Resolved),
  but there's one `dangerouslySetInnerHTML` sink (`src/overlays/QuickLook.tsx`, fed by
  `highlight.js` output, currently safe since hljs escapes source text) — worth
  revisiting if that sink ever changes. Enabling a real CSP needs testing in the actual
  webview (inline styles, the loopback media server, blob URLs), which is why it wasn't
  folded into the IPC-hardening pass.

- **No SFTP host-key verification.** `src-tauri/src/remote/sftp.rs` accepts any server
  key (no known_hosts store), so connections are not protected against
  man-in-the-middle. Acceptable for trusted home/office networks; needs a real host-key
  trust store before treating network places as hardened.

### Feature parity vs. `archive/pyside6-legacy`

The rewrite is at parity or a strict superset for the file-manager core, and a strict
superset overall for network places (SFTP/SMB didn't exist in the legacy app).

- **No user-editable Bookmarks list.** Legacy's sidebar had a fixed "Places" group (which
  the new `src/modules/Places.tsx` reproduces) plus a separate user-managed "Bookmarks"
  group — add/remove/reorder arbitrary folders. The new app has no equivalent; Working
  Sets are a different concept (multi-file reference collections, not pinned folders) and
  don't substitute.
- Legacy's AI subsystem (BYOK cloud LLM features) was replaced, not ported: the new app
  has an optional local-AI integration via Ollama instead. Remaining legacy-only AI
  features (natural-language search filters, AI image generation) are considered out of
  scope unless requested.

## Resolved (follow-up pass, 2026-07)

- **Path-traversal on IPC name params** — `fsops::validate_name()` now rejects empty
  names, `.`, `..`, and any name containing a path separator or NUL, and is enforced in
  every local and remote command that joins a caller-supplied name onto a base path
  (`create_folder`, `create_file`, `rename_path`, `copy_path`, `extract_archive`,
  `create_archive`, `create_symlink`, and the `remote_*`/`upload`/`download`
  equivalents). The unused `read_text_file` command (an unscoped file-read IPC endpoint
  with no frontend caller) was removed outright.
- **Loopback media server hardening** — `media.rs` now compares the session token in
  constant time, requires the request's Host header to be its own `127.0.0.1:{port}`
  origin (defeats DNS rebinding), and only serves the closed set of extensions the
  previewer actually renders instead of any file on disk.
- **`moveEntries` shared `srcDir`** — each moved item now tracks its own source
  directory, so multi-folder multi-select moves (e.g. from an "All"-scope search) keep
  working-set refs and undo targets correct.
- **`globalFeed` persistence** — persisted alongside `fileEvents` since the Settings/
  file-journey work; the Timeline module survives reload.
- **Dead code** — dropped the unused `trash` crate dependency, `isTextLike()`,
  and the dead `FsBackend.readTextFile()` method; internalized `splitBaseExt`,
  `applyRenameTemplate`, `langForExt`, and the mock remote-root constants.
- **Oversized files** — the four files the audit flagged were split without behavior
  changes: `src/state/store.ts` (~2400 lines) into domain slices under
  `src/state/slices/` plus `helpers.ts`/`persistence.ts` (still one `useStore`);
  `src/modules/Files.tsx` (~1570 lines) into `src/modules/files/` (tile, list view,
  ghosts, missing-items banner, context menus, search walker); `src/overlays/
  QuickLook.tsx` (~1190 lines) into `src/overlays/quicklook/` (content-loading hook +
  per-preview renderers); and `src/fs/mockBackend.ts` into the tree engine
  (`mockTree.ts`) and the SFTP/SMB demo fixtures (`mockRemote.ts`). The unused
  `ALL_MODULE_IDS`/`isPanelModule` re-exports from `store.ts` were dropped along the way.
