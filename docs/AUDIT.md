# Codebase audit — 2026-07

A full security / correctness / dead-code / feature-parity pass over the app. Two
data-loss bugs and three security gaps were fixed directly (see git history around this
file's introduction). Everything below is unfixed — findings worth knowing about, but
left for a deliberate follow-up rather than folded into that pass.

## Security

- **No path-traversal stripping on IPC name/target params.** `rename_path`, `copy_path`,
  `create_folder`/`create_file`, `extract_archive`/`extract_zip`, `create_archive`/
  `zip_paths`, and `create_symlink` in `src-tauri/src/fsops.rs`, plus the SFTP/SMB
  equivalents (`src-tauri/src/remote/sftp.rs`, `remote/smb.rs`), join attacker-suppliable
  name/target strings onto a base path without rejecting `..` or `/` first. Not reachable
  from the normal UI today (the rename/create flows just trim whitespace — see
  `commitRename` in `src/state/store.ts`), but it's only one `invoke()` call away, and
  `src-tauri/tauri.conf.json` sets `"csp": null`, which removes Tauri's default
  script-injection hardening. There's currently one `dangerouslySetInnerHTML` sink
  (`src/overlays/QuickLook.tsx:223`, fed by `highlight.js` output, currently safe since
  hljs escapes source text) — worth revisiting if that sink ever changes, since there'd
  be zero defense-in-depth at the IPC boundary behind it.

- **Loopback media server is an unscoped file-read oracle.** `src-tauri/src/media.rs`'s
  `handle()` opens *any* absolute path passed in the `path` query param (line ~251), not
  restricted to media files or any directory, gated only by a 128-bit per-session token
  compared with non-constant-time `!=` (line ~244) and no Origin/Referer check. Since it
  binds `127.0.0.1` (not uid-scoped on Linux), any other local OS user on a shared
  machine, or a page doing DNS-rebinding, could read arbitrary files accessible to the
  app's user if the token is ever recovered via timing or leaked/logged.

## Correctness

- **`moveEntries` computes `srcDir` once for the whole batch.** `src/state/store.ts`
  (~line 979) takes `backend.dirname(paths[0])` and reuses it for every item in a
  multi-select move. Reachable via a Search "All"-scope multi-select drag spanning
  folders: `updateSetRefs` gets called with the wrong `fromDir` for non-first items
  (orphaning working-set refs), and the undo entry moves every item back into
  `paths[0]`'s folder instead of each item's true origin. Fix should track
  `{ from, srcDir, to }` per item instead of one shared `srcDir`.

- **`globalFeed` isn't persisted while `fileEvents` is.** Neither is documented as
  intentional — `globalFeed` is absent from `PersistedShape`/`init()`'s restore in
  `src/state/store.ts`, so the Timeline module resets every reload. Confirm whether
  that's deliberate (session-only feed) and document it, or add it to persistence for
  consistency with `fileEvents`.

## Dead code / cleanup

- `trash = "5"` in `src-tauri/Cargo.toml` is an unused dependency — `fsops.rs`'s
  `app_trash_dir()` implements its own app-level trash folder instead of using the
  crate's OS-native trash integration. Either wire it in or drop the dependency.
- `isTextLike()` in `src/lib/format.ts:81-84` is exported but never called.
- `readTextFile()` on the `FsBackend` interface (`src/fs/types.ts`, implemented in both
  `tauriBackend.ts` and `mockBackend.ts`) has no live caller — `previewTextFile()` calls
  the underlying `remote_read_text_file`/`read_text_file` Tauri commands directly instead
  of going through it.
- Minor: `splitBaseExt`, `applyRenameTemplate` (`src/lib/batchRename.ts`), `langForExt`
  (`src/lib/highlight.ts`), `MOCK_SFTP_ROOT`/`MOCK_SMB_ROOT` (`src/fs/mockBackend.ts`) are
  `export`ed but only used within their own file.
- Largest files, not urgent but worth knowing before adding more to them:
  `src/state/store.ts` (~1700 lines, single Zustand store by design per CLAUDE.md),
  `src/modules/Files.tsx` (~600 lines), `src/overlays/QuickLook.tsx` (~500 lines),
  `src/fs/mockBackend.ts` (~490 lines, mixes the in-memory FS engine with SFTP/SMB demo
  fixtures — those could split cleanly).

## Feature parity vs. `archive/pyside6-legacy`

The rewrite is at parity or a strict superset for the file-manager core, and a strict
superset overall for network places (SFTP/SMB didn't exist in the legacy app). Two real
gaps:

- **The entire AI subsystem was dropped.** Legacy had a `geyma/ai/` package wired into
  the UI: natural-language search → structured filters, AI folder summaries, AI rename
  suggestions, AI image generation, all BYOK (bring-your-own-key) with the API key in the
  OS keyring and an explicit opt-in/disclosure dialog. Nothing in `src/` or
  `src-tauri/src/` references any LLM provider today. This looks like a deliberate scope
  cut for the rewrite rather than an oversight, but it's worth confirming that's still
  the intent before treating it as "missing."
- **No user-editable Bookmarks list.** Legacy's sidebar had a fixed "Places" group (which
  the new `src/modules/Places.tsx` reproduces) plus a separate user-managed "Bookmarks"
  group — add/remove/reorder arbitrary folders. The new app has no equivalent; Working
  Sets are a different concept (multi-file reference collections, not pinned folders) and
  don't substitute.
