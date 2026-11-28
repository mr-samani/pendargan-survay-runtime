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
