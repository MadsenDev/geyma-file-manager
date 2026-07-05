# Geyma AI Boundary Policy

Geyma AI features are optional and user-initiated. The file manager must remain fully usable without any AI.

## Non-negotiables

- BYOK only: no bundled keys, no default provider.
- User-initiated actions only: no background AI tasks.
- Preview-first: AI suggests, user approves, Geyma executes.
- Deterministic first: if rules/heuristics can do it, use them.
- No AI core logic: AI never decides file operations.
- No silent uploads: all data sent is disclosed before use.

## Data handling

- No file contents are sent unless explicitly selected by the user.
- Metadata-only features must stay metadata-only.
- AI outputs are labeled "AI-assisted" in the UI.

## Failure behavior

- If AI is unavailable, all features must fall back gracefully.
- AI errors are surfaced to the user with clear messaging.

## Scope boundaries

- AI may suggest filters, summaries, rename proposals, or generate new files.
- AI must not move, delete, or rename files without explicit user approval.
