# AI handoff

You are continuing work on the PendarGan survey runtime rewrite.

## Read first

1. `AGENTS.md`
2. `docs/ai/CURRENT-STATUS.md`
3. `docs/ai/NEXT-STEPS.md`
4. `docs/architecture/OVERVIEW.md`
5. The task-specific architecture/analysis document and source files.

## Project intent

Rewrite the browser-side survey execution runtime to handle large surveys without long main-thread stalls. Separate immutable survey definitions, expression/dependency compilation, answer state, visibility/actions, flow/navigation, and rendering. Existing API contracts and answer serialization must remain compatible until explicitly migrated.

## Current repository state

- Working branch: `docs/rewrite-foundation`
- Baseline/default branch: `master`
- Draft PR: https://github.com/mr-samani/pendargan-survay-runtime/pull/1
- The repository is intentionally public, confirmed by the owner.
- Latest successful CI: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45384163073
- Latest validated suite: 11 files, 38 tests; npm ci and production build pass.

## Implemented foundations

- Typed lazy renderer registry with concurrent loading, Promise caching and retry after failed imports.
- Immutable DTO-to-definition compiler with detached snapshots of all source DTO fields.
- Expression registration/compilation with dependency and volatility metadata.
- Typed dependency graph, legacy question/option reference mapping, topological order and iterative cycle detection.
- Full-recalculation reference evaluator.
- Dirty-node incremental evaluator, with a seeded 100-update differential test against the full evaluator.
- Immutable answer-state snapshot with atomic input batches and per-runtime-instance namespaces.

These are foundation layers, not a completed production runtime. There is no action/visibility transaction, flow runtime, renderer parity migration, or answer submission adapter yet.

## Critical source gaps

The checked-in app currently contains only HtmlFrame, UniqueSelect and MultiSelect renderers. The checked-in `VoteService` does not initialize global variables and contains no answer save/submit calls. It only attaches InsideForm Question/Answer expressions. Loop-related DTOs exist, but no loop-instance runtime is present in the app.

Before implementing the remaining behavior, establish whether the missing production client code lives in another repository or was intentionally excluded. Obtain anonymized fixtures for real survey definitions, expression actions, loop answers and save/submit payloads.

See `docs/analysis/OBSERVED-LEGACY-BEHAVIOR.md` for the exact observed behavior and the distinction between source evidence and unknown semantics.

## Rules

- Never claim unverified legacy semantics.
- Never edit generated service proxies manually.
- Never delete the old implementation during the first milestones.
- Do not equate dynamic import with proof of reduced initial bundle; measure production chunks.
- Do not call the rewrite complete based on compilation alone.
- Do not invent action precedence, hidden-answer behavior, loop semantics or submission payloads.
- Keep formula evaluation pure; actions must be resolved and applied in a separate transaction.
- Update task/status/handoff documents with each meaningful milestone.
- Do not merge or publish without the owner's explicit approval.

## Next task

Resolve source completeness and obtain the missing production behavior/fixtures. Then implement the action and visibility transaction using verified semantics. Follow `docs/ai/NEXT-STEPS.md` and `docs/development/TASKS.md`.
