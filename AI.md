# Geyma – AI Features Summary (BYOK-first, optional, restrained)

## Core philosophy (non-negotiable)

* **AI is optional**. Geyma is fully usable without it.
* **BYOK only**. No bundled keys. No default provider. (BYOK = Bring Your Own Key)
* **User-initiated only**. No background analysis. No silent uploads.
* **Preview-first**. AI suggests. User approves. App executes.
* **Deterministic first**. If rules/heuristics can do it, they do it.
* **No AI core logic**. AI never decides file operations.

If any feature violates these, it doesn’t ship.

---

## What AI is used for (and only this)

### 1. Natural language → filters (optional)

**Purpose**: Reduce UI friction, not add intelligence.

* User types:
  “photos from last winter in Oslo”
* Geyma:

  * locally resolves what it can (dates, file types)
  * optionally asks AI to translate intent → structured filters
  * **shows filters before running**
* No file contents sent. Ever.

Fallback: advanced filter UI works without AI.

---

### 2. Folder summaries (metadata only)

**Purpose**: Explain what Geyma already computed.

Input to AI:

* file counts
* size breakdowns
* age buckets
* file type histogram

Output:

* human-readable explanation

No guessing. No scanning. No creativity required.

---

### 3. Rename suggestions (preview-only)

**Purpose**: Save time on bulk renaming.

* Input:

  * filenames
  * metadata (EXIF if enabled)
* Output:

  * proposed new names
* User reviews diffs and approves

Geyma performs the rename. AI never touches the filesystem.

---

### 4. Image generation (the actually good idea)

#### A) “Generate image in this folder…”

* Context: right-click folder background
* Opens dialog:

  * prompt
  * size / aspect ratio
  * output format
  * filename template
* Generates image
* Saves **new file** into the folder
* Selects it in the file view

#### B) “Generate variation using this image…”

* Context: right-click an image
* Uses selected image as reference
* Prompt + strength slider
* Saves output as new file (`original__gen_01.png`)

#### C) “Edit image with prompt…”

* Same as B, but framed as editing
* Never overwrites by default

This fits a file manager perfectly: **AI creates files**. No metaphysics.

---

## What AI explicitly does NOT do

* ❌ Move, delete, rename files automatically
* ❌ Reorganize folders
* ❌ Index file contents silently
* ❌ Run in background
* ❌ Act without preview
* ❌ Pretend to be required

If AI ever surprises the user, it’s a bug.

---

## BYOK architecture (clean and contained)

```
geyma/
 ├─ ai/
 │   ├─ provider_base.py
 │   ├─ providers/
 │   │   ├─ openai.py
 │   │   ├─ stability.py
 │   │   ├─ replicate.py
 │   │   └─ local_comfyui.py (later)
 │   ├─ jobs/
 │   │   ├─ text_to_filters.py
 │   │   ├─ folder_summary.py
 │   │   ├─ rename_suggestions.py
 │   │   └─ image_generation.py
 │   └─ prompts/
```

AI is a service adapter. The rest of the app does not care.

---

## Key management (Fedora / KDE)

* Store keys in **KWallet / Secret Service**
* Never plaintext config files
* UI:

  * Settings → AI
  * Enable toggle
  * Provider dropdown
  * API key field
  * “Test connection”
* Clear warning:

  * what data is sent
  * to whom
  * when

No keys, no AI. No nags.

---

# AI FEATURES – EXTENSIVE TODO LIST

## Phase A: Foundations

* [x] Write **AI boundary policy** (README-level, explicit)
* [x] Define provider interface:

  * [x] `is_configured()`
  * [x] `validate_key()`
  * [x] `supports(feature)`
  * [x] `estimate_cost()`
  * [x] `run(prompt, data)`
* [x] Implement secure key storage (KWallet)
* [x] Add global “Enable AI features” toggle

---

## Phase B: Provider support (BYOK)

* [x] Implement one cloud provider end-to-end
* [x] Implement provider selection logic
* [x] Add connection test + error messages
* [x] Add first-use disclosure dialog
* [x] Add provider capability detection (text vs images)

(Local providers like ComfyUI are v1.5+.)

---

## Phase C: Natural language → filters

* [x] Define filter schema (dates, types, paths, keywords)
* [x] Build deterministic parser first
* [x] Add optional AI translation layer
* [x] Show resulting filters before execution
* [x] Allow editing filters before applying
* [x] Filter schema validation for fields and ops
* [x] Search dialog AI-used badge
* [x] Graceful fallback if AI unavailable
* [x] Quick filter bar supports structured filters (non-recursive)

---

## Phase D: Folder summary

* [x] Implement local folder analysis:

  * [x] size buckets
  * [x] file types
  * [x] age ranges
* [x] Pass computed stats to AI
* [x] Display AI summary with “AI-assisted” label
* [x] Allow re-run / disable
* [x] Folder summary available from context menu
* [x] Folder summary stats table UI
* [x] Folder summary uses human-readable sizes

---

## Phase E: Rename suggestions

* [x] Collect selected filenames + metadata
* [x] Generate rename proposals via AI
* [x] Show before/after diff table
* [x] Allow per-item accept/reject
* [x] Execute rename via Geyma core logic

---

## Phase F: Image generation (big one)

### UI

* [x] “Generate image in this folder…” menu item
* [x] “Generate variation…” on images
* [ ] Generation dialog:

  * [x] prompt
  * [x] preview (if reference)
  * [x] size presets
  * [x] advanced settings (collapsible)

### Jobs

* [x] Background job runner
* [x] Progress + cancel
* [x] Error handling (quota, invalid key, timeout)
* [x] OpenAI image generation support

### Output

* [x] Atomic file write
* [x] Collision-safe naming
* [x] Auto-refresh folder + select file

---

## Phase G: Safety + Trust

* [x] Per-feature “data being sent” preview
* [x] Visible “AI-assisted” indicators
* [x] No silent retries
* [x] No background tasks
* [x] No file content upload unless explicitly selected
* [x] Key storage fallback to config when keyring unavailable

---

## Phase H: Polish (only after everything works)

* [ ] Cost estimate display (if supported)
* [ ] Presets for image generation
* [ ] Prompt history (local only)
* [ ] Provider-specific advanced settings
* [ ] Feature flags for each AI capability

---

## Final verdict (no marketing voice)

BYOK AI in a file manager works **only** because:

* it creates files instead of reorganizing lives
* it stays optional
* it stays honest
* it stays contained

Most apps fail at this because they want AI to be the product.
Here, AI is a **tool you bring**, use briefly, and put away.

Which is exactly how it should be.
