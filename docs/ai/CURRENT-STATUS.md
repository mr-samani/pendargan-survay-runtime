# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 4 — runtime foundations, serialization, restore, and session navigation controller implemented; renderer integration and full API parity remain open

## Repository and source strategy

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in rewrite target is an Angular 22 application under `projects/vote`.
- The original production client ZIP is retained as a behavior reference and is intentionally not copied into the rewrite repository.
- `ConverterDataService.getAnswerOfQuestion`, `getQuestionOtherDescription`, `getDataForSave`, and `setAnswerInQuestions` are the source references for serialization and restore behavior.

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
- Wired the loop submission projection to use the built-in serializer by default, while retaining injection for specialized adapters.
- Added top-level `CreateVoterWithDetailsDto` builder for voter metadata, GPS omission semantics, poll route, allocation, temporary-save/accept-previous flags, optional partial-payment registration, and caller-supplied voice-record metadata.
- Added pure question-level saved-answer restoration for choice/priority, scalar, FileUpload, DynamicAnswer, SKU, Captcha, and Payment, including diagnostics and editable-initial-value restore metadata.
- Added section-level saved-answer restore: one-based loop DTO traversal, isolated answer instances, popup filled-state parity, temporary elapsedTime, and contiguous-loop validation. RetailAudit repeated item/child restoration is implemented; VoiceRecord restore remains unsupported because the archived converter switch has no direct case.
- Added a runtime session controller that owns the current page, dispatches atomic answer batches, refreshes derived projections through an injected projector, gates forward navigation on current-page validation, and advances/re-enters SectionLoop iterations.
- Added session tests for snapshot ownership, stale validation rejection, invalid/unknown page blocking, command dispatch, and previous/next navigation.
- Added source-derived answer serialization contract documentation and explicit diagnostics for unsupported identifiers.

## Verified legacy behavior and known schema differences

- Legacy save skips hidden, ended, inactive, or no-visible-child/option questions except Group.
- Selected choice rows are emitted in question option order; HasPriority rows preserve answer order.
- MultiSelect descriptions are stored per selected option; other description modes use the shared description answer.
- Static SKU and dynamic SKU use different identity fields.
- File/Voice always emit one answer detail, even with an empty files list.
- Captcha and Payment use validationKey as answerDescription and answer as validationGuid.
- Group emits a row even when hidden/inactive.
- The archived legacy DTO allows dynamicDataRecordId string or number; current generated DTO allows number only. Non-numeric IDs are rejected explicitly rather than coerced.
- The archived legacy file DTO includes fileId, fileUniqueId, and order; current generated DTO exposes only fileUniqueId and order. The rewrite emits the currently generated DTO fields and records this parity gap.
- RetailAudit is transformed into synthetic DynamicAnswer repeated pages before regular serialization.
- The payload builder preserves the legacy duplicated GUID, zero-GPS omission, empty region fallback, voice-record metadata, and partial-payment-only registration behavior.

## CI validation

<badge color="success">Latest CI passed</badge>

- [Runtime session controller CI](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45400294630)
- npm ci: passed.
- Angular production build: passed.
- Unit test suite: passed.

## Initial bundle snapshot

Measured by Angular 22 production build on GitHub Actions, Node 24.22.3:

| Chunk | Raw size | Estimated transfer |
|---|---:|---:|
| Initial total | 769.23 kB | 197.32 kB |
| MultiSelect | 6.72 kB | 1.95 kB |
| UniqueSelect | 6.26 kB | 1.93 kB |
| HtmlFrame | 418 B | 418 B |

The initial bundle exceeds the configured 500 kB warning budget by 269.23 kB. Angular also warns that `sanitize-html` is CommonJS.

## Remaining work

- Implement the concrete projector adapter that connects formula engine evaluation, action transactions, visibility, validation, and flow into the new session controller. The controller intentionally accepts this adapter rather than owning formula-engine dependencies.
- Connect UI/renderer inputs to immutable answer state, including complex answer value conventions.
- Supply evaluated visibility and per-question evaluated initial value to submission.
- Verify all type-specific answer conversions against golden fixtures, especially dynamic identifiers and matrix children.
- Implement RetailAudit submission transformation, full temporary/partial/full save orchestration, and server response/error handling.
- Verify quotas, end-form/submit, post-submit actions, and dynamic-answer filters.
- Renderer parity, browser tests, and runtime/memory benchmarks.
