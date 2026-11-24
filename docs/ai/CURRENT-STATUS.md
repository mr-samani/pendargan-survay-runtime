# Current status

**Updated:** 2026-11-24  
**Working branch:** `docs/rewrite-foundation`  
**Baseline branch:** `master`  
**Phase:** 3 — immutable answer state, visibility, actions, baseline validation, flow projection, and loop persistence envelope implemented; complete question serialization and runtime orchestration remain open

## Repository and source strategy

- The repository is intentionally public, confirmed by the owner.
- The repository default branch is `master`; there is no `main` branch.
- The checked-in rewrite target is an Angular 22 application under `projects/vote`.
- The original production client ZIP is retained locally as a behavior reference and is intentionally not copied into the rewrite repository.
- The archive has been inspected for SectionLoop behavior and repeated-section save/load contracts. Keep the rewrite independent; carry forward verified contracts rather than legacy implementation structure.

## Work completed on this branch

- Added typed lazy renderer registry with in-flight/resolved Promise caching, retry after failed imports, and concurrent loading of distinct types.
- Added CI workflow and repaired spec path aliases/stale starter tests.
- Added immutable definition compilation and expression metadata compilation.
- Added typed dependency graph, stable topological ordering, iterative SCC cycle detection, full-recalculation oracle, and dirty-node incremental evaluator.
- Added seeded differential coverage: 100 input changes compare incremental results against the full evaluator.
- Added immutable answer state with atomic input batches, JSON-safe snapshots, dirty tracking, and per-runtime-instance namespaces.
- Added pure visibility projection for InsideForm Question/Answer Show/Hide.
- Added Select/UnSelect action resolution and atomic answer-state application.
- Added baseline validation for required answers, unknown option IDs, visibility states, and Point numeric bounds.
- Added section-per-page and question-per-page flow projections with stable navigation.
- Added loop runtime based on the original client's active InsideForm SectionLoop expression target. It preserves zero-based UI indexes, one-based backend auto-save indexes, root namespace for iteration zero, isolated namespaces for later iterations, per-iteration variables, dynamic record IDs, sticky filled state, backward re-entry, future iteration reuse, and a configurable max-iteration guard.
- Added formula-result bridge: SectionLoop decision is read from evaluator proposals; source order is preserved for multiple matching loop expressions; failed/unavailable results block advancement as unknown.
- Added loop-aware Flow pages with answerInstanceId, loopIterationIndex, and backendLoopNumber.
- Added loop submission envelope projection to generated DTOs: ordered repeatSections, per-iteration voterAnswerDetails, variablesRepeatedSectionValue, and variablesLastValue merge. Question-specific answer conversion is injected deliberately rather than guessed.

## Verified legacy loop and save contract

- The original client sets section.hasLoop from an active InsideForm expression with targetType SectionLoop and targetKey matching section.uniqueIdPerForm.
- The loop expression result controls whether the current section repeats on advance.
- UI loopNumber starts at zero; auto-save sends loopIndexNumber = loopNumber + 1.
- The client stores section snapshots keyed by section and loop number, capturing answers and the iteration's variable dictionary.
- Full/temporary save includes only snapshots marked filledData === true; each non-empty iteration becomes a RepeatedFormSectionDto containing voterAnswerDetails and variablesRepeatedSectionValue.
- Iterations that serialize to no answer details are omitted.
- variablesLastValue merges iteration variable dictionaries in section/iteration order, with later values replacing earlier keys.
- The generated outer formSections envelope has no section ID field; its order follows section definition order.
- RetailAudit has a separate transformation into synthetic DynamicAnswer-like repeated pages and remains a separate adapter concern.

## CI validation

<badge color="success">Latest CI passed</badge>

- Run: https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/45393766083
- Production build: passed.
- Unit tests: 17 files, 75 tests passed.
- Includes loop expression resolution, isolated iteration namespaces, backward navigation/reuse, flow projection, and loop submission envelope tests.

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

- Wire the loop transition bridge into a concrete runtime controller and ensure every renderer read/write uses the active page's answerInstanceId.
- Implement the default question-type answer serializer from the verified legacy converter, including option IDs, descriptions, files, DynamicAnswer, Payment, Captcha, Group, SKU and HasPriority.
- Assemble the full CreateVoterWithDetailsDto, including voterDetail, variablesLastValue, partial payment registration, and temporary-save behavior.
- Verify hidden-answer retention/clearing, RetailAudit conversion, quota, end-form/submit, post-submit actions, and dynamic-answer filters.
- Renderer parity, browser tests, and runtime/memory benchmarks.
