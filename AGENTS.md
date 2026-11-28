# Agent instructions

## Mission

Help rewrite the PendarGan survey runtime safely, incrementally, and with measurable correctness and performance. Read `docs/ai/CURRENT-STATUS.md`, `docs/ai/NEXT-STEPS.md`, and relevant architecture documents before changing code.

## Source-of-truth rules

1. Treat generated files under `projects/vote/src/service-proxies/` as generated API contracts. Do not hand-edit them. Change the generator/specification upstream or add an adapter outside generated files.
2. Do not invent semantics for question types, expressions, section loops, quota rules, answer retention, or submission. If the checked-in source does not establish behavior, mark it unknown and request a representative payload, test, or backend contract.
3. Preserve API payload and answer serialization compatibility unless a documented migration is approved.
4. Keep legacy code available until parity gates are satisfied. Do not delete or replace it as part of a refactor.
5. Never commit secrets, tokens, production voter data, private URLs, or real respondent answers. Use anonymized fixtures.

## Angular / TypeScript

- Use Angular 22 standalone APIs; standalone is implicit.
- Prefer strict types; avoid `any`. Use `unknown` at untrusted boundaries and validate/narrow it.
- Use signals for local reactive state and `computed()` for pure derived state.
- Do not use effects to propagate derived state or to mutate other state as a substitute for a proper runtime transition.
- Keep templates declarative; no expensive scans, expression parsing, object creation, or side effects in templates.
- Use stable identity in `@for` tracking.
- Use lazy route/feature loading and dynamic imports for optional renderers.
- Do not add NgModules to new code. Existing compatibility modules may remain until migrated.
- Do not explicitly set OnPush; it is the Angular 22 default.
- Keep accessibility, keyboard behavior, and RTL/LTR support in acceptance criteria.

## Runtime design

- Keep definition data immutable after compilation.
- Keep answer state separate from visibility and navigation state.
- Compile expressions and dependency metadata once per survey revision.
- Recompute only affected nodes after an input change; stop propagation when a node's output is unchanged.
- Model loop/repeated-section execution with runtime instance IDs, not only definition IDs.
- Define deterministic conflict precedence for show/hide/select/unselect actions.
- Keep full recalculation available as a test oracle until incremental evaluation is proven equivalent.

## Tests and commits

- Add unit tests for every new rule and regression test for every fixed bug.
- Compare incremental results against the full-recalculation oracle after randomized action sequences.
- Benchmark cold compile, warm evaluation, update propagation, memory, and initial/lazy chunk sizes separately.
- Do not claim a task is Done until its acceptance criteria and tests pass.
- Update `docs/development/TASKS.md`, `docs/ai/CURRENT-STATUS.md`, and `docs/ai/NEXT-STEPS.md` in the same change when milestones move.
- Use focused commits with task IDs, e.g. `CORE-001: add immutable survey definition model`.
- Do not merge to the default branch or publish packages without explicit user approval.
