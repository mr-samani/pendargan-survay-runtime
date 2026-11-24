# AI handoff

You are continuing work on the PendarGan survey runtime rewrite.

## Read first

1. `AGENTS.md`
2. `docs/ai/CURRENT-STATUS.md`
3. `docs/ai/NEXT-STEPS.md`
4. `docs/architecture/OVERVIEW.md`
5. The task-specific document and source files.

## Project intent

Rewrite the browser-side survey execution runtime to handle large surveys without long main-thread stalls. The target architecture separates immutable survey definitions, expression/dependency compilation, answer state, visibility, flow/navigation, and rendering. Existing API contracts and answer serialization must remain compatible until explicitly migrated.

## Current baseline

The existing Angular 22 app has a small dynamic-import renderer registry with three registered renderers (HtmlFrame, UniqueSelect, MultiSelect). The question enum contains many more types. Current model/service responsibilities are mixed; in particular, visibility evaluation mutates option state from inside a computed signal. See `docs/analysis/LEGACY-SYSTEM.md`.

## Rules

- Never claim unverified legacy semantics.
- Never edit generated service proxies manually.
- Never delete the old implementation during the first milestones.
- Do not equate dynamic import with proof of reduced initial bundle; measure production chunks.
- Do not call the rewrite complete based on compilation alone.
- Update task/status/handoff documents with each meaningful milestone.
- Do not merge or publish without the owner's explicit approval.

## Next task

Complete the legacy contract inventory and fixtures before implementing the definition compiler. See `docs/development/TASKS.md` and `docs/ai/NEXT-STEPS.md`.
