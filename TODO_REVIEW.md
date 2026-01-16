# Review Fixes (Post-Audit)

## Critical

* [x] Fix trash restore crash when logging restore entries
* [x] Prevent same-folder paste from deleting original when replacing

## High / Medium

* [x] Make mount/unmount actions operate on real devices or hide when unavailable
* [x] Guard operation logging against unwritable log paths
* [x] Hide/disable Restore if `.trashinfo` metadata is not being written

## Cleanup

* [x] Align settings toggles with behavior (open_default_app, open_folders_new_window, restore_windows)
* [x] Modernize Settings dialog UI (search + left nav)
* [x] Redesign AI settings page layout
