# Geyma – Core Differentiators (Summary)

Geyma is a **deliberate file manager** that respects how people actually remember and work with files:

* by **paths and landmarks**, not names
* by **context**, not structure
* by **intent and recent actions**, not guesswork

Instead of trying to out-smart users, Geyma focuses on:

* preserving context
* surfacing history
* making recovery easy
* letting users re-enter workspaces intentionally

These features do **not** replace browsing.
They **support and extend it**.

---

## Feature 1: Working Sets (Context without relocation)

### What it is

A **Working Set** is a named, persistent collection of file references drawn from anywhere on the system.

* Files are **not moved**
* No new folder structure is imposed
* A working set represents *what you are working on*, not where things live

Think “project”, not “virtual folder”.

### Why it’s different from folders

Folders answer:

> “Where does this file belong?”

Working sets answer:

> “What files matter together right now?”

They preserve **situational context**, which folders can’t do without duplication or restructuring.

### What makes it special

* Explicit, user-created context
* Survives restarts
* Files can go missing or move and the set still tells the story
* Matches how people think about tasks

---

## Feature 2: File Operations with Memory (Accountability, not just undo)

### What it is

A visible, persistent **operation log** of file actions performed through Geyma.

Not just “Ctrl+Z while you’re lucky”, but:

> “What happened to my files?”

### Why existing file managers fall short

* Undo is short-lived
* History is invisible
* Once you miss the undo window, you’re on your own

Geyma treats file actions as **events worth remembering**.

### What makes it special

* You can answer “where did this go?”
* You can see *how* something changed
* You gain confidence to act because mistakes are traceable

This is not about automation.
It’s about **trust and recovery**.

---

## Feature 3: Search as Re-entry, not Replacement

### What it is

Search is a **support tool** for browsing, not a replacement for it.

Geyma assumes:

* users often don’t remember filenames
* users remember paths, areas, and movement
* browsing by feel is valid

### How search is used differently

Search is used to:

* locate an *anchor*
* reveal where something lives
* jump back into a familiar path

Not to “type magic words and be done”.

### What makes it special

* Search results always show full paths
* “Reveal in folder” is a first-class action
* Results behave like a temporary workspace, not a dead end

Search helps you **reconstruct context**, then gets out of the way.

---

# TODO LIST – IMPLEMENTATION PLAN

This is ordered intentionally. You don’t build all of this at once.

---

## Phase 1: Working Sets (v1, minimal but real)

### Data model

* [ ] WorkingSet:

  * [ ] id
  * [ ] name
  * [ ] optional description
  * [ ] list of file URIs/paths
  * [ ] created_at
  * [ ] last_used_at

* [ ] WorkingSetItem:

  * [ ] path/URI
  * [ ] last_known_location
  * [ ] exists flag
  * [ ] last_seen_at

### Core functionality

* [x] Create working set
* [x] Rename working set
* [x] Delete working set
* [x] Add file(s) to working set
* [x] Remove file(s) from working set
* [x] Open working set as a view

### UI

* [x] Sidebar section: “Working Sets”
* [x] Clear indicator when viewing a working set
* [x] Missing files shown explicitly (not silently removed)
* [x] “Reveal in folder” action per item

### Explicit non-goals (v1)

* No syncing
* No sharing
* No automation
* No tags

---

## Phase 2: Operation Log (read-only first)

### Data capture

* [x] Log file operations performed via Geyma:

  * [x] move
  * [x] rename
  * [x] delete
  * [x] copy
* [x] Store:

  * [x] timestamp
  * [x] action type
  * [x] source path(s)
  * [x] destination path(s)
  * [x] success/failure

### Storage

* [x] Append-only local log
* [x] Rotated or capped size
* [x] Human-readable format (JSON lines is fine)

### UI

* [x] “Recent activity” panel or view
* [x] Filter by:

  * [x] action type
  * [x] file name fragment
  * [x] time
* [x] Click entry → reveal file or destination

### Later (not v1)

* [ ] Partial undo / reverse when possible
* [ ] Highlight actions affecting current folder or working set

---

## Phase 3: Search as Re-entry Tool

### Search behavior

* [x] Search scoped to:

  * [x] current folder
  * [x] subtree
  * [x] whole system
* [x] Incremental results
* [x] Cancelable at any time
* [x] Clear progress indication

### Result presentation

* [x] Full path always visible
* [x] “Reveal in folder” primary action
* [x] “Add to working set” action
* [x] Result list behaves like a temporary view

### UX rules

* [x] Search never hides path context
* [x] Browsing is always one click away
* [x] No “search-only” dead ends

---

## Phase 4: Integration between features (this is where it clicks)

* [x] Add search results directly to a working set
* [x] Show recent operations affecting a working set
* [x] Jump from operation log → folder → working set
* [x] Working sets show last activity summary

This is where Geyma stops feeling like features and starts feeling cohesive.

---

## The guiding rule (pin this somewhere)

> **Geyma preserves context instead of guessing intent.**

If a feature:

* hides history
* automates without consent
* replaces user memory instead of supporting it

…it doesn’t belong.

---

## Final note (important)

This plan is special **because it’s restrained**.

Most file managers chase:

* automation
* AI
* cleverness

Geyma chases:

* continuity
* recoverability
* respect for how humans actually remember things

That’s a rarer and more durable differentiator.
