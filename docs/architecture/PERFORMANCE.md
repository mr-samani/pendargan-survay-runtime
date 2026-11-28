# Runtime performance notes

## Indexed dynamic-filter resolution

The legacy dynamic-filter resolver previously searched the full question list once for every filter template, then searched evaluated global variables and formula failures for each active global variable.

It now builds, per projection:

- A `uniqueIdPerForm -> questions[]` index, retaining duplicate targets so ambiguous definitions still produce diagnostics.
- An `id -> evaluated global variable` map that preserves the first matching result.
- A set of failed global-variable IDs.

This changes target lookup from repeated O(filters × questions) scans to O(questions + filters), and removes repeated O(globals × evaluated-results) failure/result scans. Formula text substitution remains proportional to the template/dependency text being processed.

## Indexed submission grouping

Submission previously filtered the complete question list once for every section. It now:

1. Indexes every section's canonical ID, source ID, and uniqueIdPerForm aliases.
2. Walks questions once and groups each question into the matching section bucket.
3. Serializes from those pre-grouped buckets.

The grouping phase changes from O(sections × questions) to O(sections + questions + matched aliases). A Set prevents a question from being inserted twice into one section when multiple aliases resolve to that same section. If malformed data reuses an alias across different sections, the question remains associated with each section as in the previous filter-based implementation.

## Correctness constraints

- Ambiguous dynamic-filter targets must remain errors; never pick the first match.
- Preserve the legacy `false` fallback for failed global-variable evaluation.
- Preserve all three section-reference aliases.
- Do not mutate the immutable survey definition or answer snapshots.
- Do not infer percentage speedups from asymptotic changes or CI duration.

## Benchmark status

A reproducible large-survey benchmark with baseline and optimized revisions is still pending. Report actual throughput/allocation changes only after running the same fixture, Node version, warmup, and iteration count against both revisions.

## Canonical answer projection

`VoteService.synchronizeCanonicalAnswers` runs after accepted session transitions. It previously performed linear option lookups for each projected option and again searched visibility options for each option. It now creates per-question ID-to-index maps for legacy option aliases and an ID-to-visibility map once, then performs constant-time lookups while preserving first-match behavior when IDs collide.

This removes the nested projected-options × legacy-options lookup from the synchronization pass. The pass still visits all relevant questions and options because it must update their reactive UI state.
## Formula-scope allocation and option lookup

Formula scopes are rebuilt for every evaluation, but survey definitions and question option arrays are immutable for the life of a session. Two derived structures are now weakly cached by those immutable objects:

- Question metadata records are created and frozen once per definition-question object, then reused by subsequent scopes.
- Option IDs map to all definition-order indexes for each options array. A scope resolves selected IDs through this index and sorts the matched indexes to preserve the previous definition-order output. Duplicate option IDs are retained in the index so malformed definitions do not silently lose duplicate entries.

Answer maps and loop-variable snapshots remain newly created per scope; they are not shared across runtime revisions or loop instances.

## Incremental evaluator parity hardening

The stateful incremental evaluator remains a standalone optimization primitive; it is not yet selected by the production session projector. A review found and corrected three semantic mismatches before considering runtime integration:

- Dynamic-answer filter expressions are text templates. Incremental updates now preserve the initialized templates and do not execute them as boolean formulas.
- Action conditions now activate only for the literal boolean `true`, matching the full evaluator rather than JavaScript truthiness.
- Global-variable runtime aliases now include display-title and lowercase-title aliases in addition to IDs and source references, matching the full evaluator's variable namespace.

Regression coverage exercises dynamic-template retention and non-boolean action results. Runtime integration remains gated on explicit changed-answer node derivation and cache invalidation for active answer instances, SectionLoop variables, definition revisions, and legacy runtime effects.

## Cached full-evaluator indexes

The production full evaluator is still the session projector's execution path. Its immutable derived metadata is now cached by the identity pair of the dependency graph and expression compilation:

- formula-node lookup;
- incoming dependency adjacency;
- global-variable alias lookup and per-variable alias lists;
- alias-collision diagnostics.

These structures are rebuilt only when the graph or compilation object changes. Per-evaluation mutable state (availability, formula results, variable snapshots, diagnostics and action proposals) remains local to each evaluation, so caching does not share answer/session state. This removes repeated graph/compilation indexing allocations from answer and loop projections without changing the evaluator's execution order.
