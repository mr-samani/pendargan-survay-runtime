# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 3 — immutable answer state, visibility, actions, baseline validation, flow projection, loop persistence envelope, and initial per-question serializer implemented; runtime orchestration and full submission integration remain open

## Repository and source strategy

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in rewrite target is an Angular 22 application under `projects/vote`.
- The original production client ZIP is retained as a behavior reference and is intentionally not copied into the rewrite repository.
- The original `ConverterDataService.getAnswerOfQuestion` and `getQuestionOtherDescription` are the source of truth for per-question save conversion.

## Work completed on this branch

- Added typed lazy renderer registry with in-flight/resolved Promise caching, retry after failed imports, and concurrent loading of distinct types.
- Added CI workflow and repaired spec path aliases/stale starter tests.
- Added immutable definition compilation and expression metadata compilation.
- Added typed dependency graph, stable topological ordering, iterative SCC cycle detection, full-recalculation oracle, and dirty-node incremental evaluator.
- Added seeded differential coverage: 100 input changes compare incremental results with the full evaluator.
- Added immutable answer state with atomic input batches, JSON-safe snapshots, dirty tracking, and per-runtime-instance namespaces.
- Added pure visibility projection for InsideForm Question/Answer Show/Hide.
- Added Select/UnSelect action resolution and atomic answer-state application.
- Added baseline validation for required answers, unknown option IDs, visibility states, and Point numeric bounds.
- Added section-per-page and question-per-page flow projections with stable navigation.
- Added loop runtime based on the original client's active InsideForm SectionLoop expression target, including iteration namespaces, variable snapshots, backward re-entry, future iteration reuse, and bounded iteration count.
- Added loop-aware Flow pages and generated repeated-section submission envelope.
- Added pure question answer serializer for verified legacy families: choice types, HasPriority, static/dynamic SKU, scalar answers, Point/NPS, DynamicAnswer, FileUpload/VoiceRecord, Captcha, Payment, and Group. Legacy content/container types intentionally emit no direct row.
- Added top-level CreateVoterWithDetailsDto builder for voter metadata, GPS omission semantics, poll route, allocation, temporary-save/accept-previous flags, optional partial-payment registration, and caller-supplied voice-record metadata.
- Wired the loop submission projection to use the built-in serializer by default, while retaining injection for specialized adapters.
- Added source-derived serialization contract documentation and explicit diagnostics for unsupported identifiers.

## Verified legacy behavior and known mismatch

- Legacy save skips hidden, ended, inactive, or no-visible-child/option questions except Group.
- Selected choice rows are emitted in question option order; HasPriority rows preserve answer order.
- MultiSelect descriptions are stored per selected option; other description modes use the shared description answer.
- Static SKU and dynamic SKU use different identity fields.
- File/Voice always emit one answer detail, even with an empty files list.
- Captcha and Payment use validationKey as answerDescription and answer as validationGuid.
- Group emits a row even when hidden/inactive.
- The archived legacy DTO allows dynamicDataRecordId string or number; current generated DTO allows number only. Non-numeric IDs are rejected explicitly rather than coerced.
- RetailAudit is transformed into synthetic DynamicAnswer repeated pages before regular serialization.

## CI validation

- Latest known passing run before the current serializer milestone: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45393984281
- Question serializer + top-level DTO builder: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45395424491 (18 test files, 91 tests passed; production build passed). The subsequent voice-record metadata refinement is awaiting CI.

## Initial bundle snapshot

Measured by Angular 22 production build on GitHub Actions, Node 24.22.3:

| Chunk | Raw size | Estimated transfer |
|---|---:|---:|
| Initial total | 769.24 kB | 197.38 kB |
| MultiSelect | 6.72 kB | 1.96 kB |
| UniqueSelect | 6.26 kB | 1.94 kB |
| HtmlFrame | 418 B | 418 B |

The initial bundle exceeds the configured 500 kB warning budget by 269.24 kB. Angular also warns that `sanitize-html` is CommonJS.

## Remaining work

- Connect UI/renderer inputs to the immutable answer state, including complex answer value conventions.
- Add runtime controller for navigation, active answer instance, validation, expression actions, and loop transitions.
- Supply evaluated visibility and per-question evaluated initial value to submission.
- Verify all type-specific answer conversions against golden fixtures, especially dynamic identifiers and matrix children.
- Implement RetailAudit conversion, load/restore conversion, and full CreateVoterWithDetailsDto assembly.
- Verify temporary save, partial payment save, full save, quotas, end-form/submit, post-submit actions, and dynamic-answer filters.
- Renderer parity, browser tests, and runtime/memory benchmarks.
