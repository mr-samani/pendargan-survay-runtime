# Benchmark protocol

No benchmark has been run for the rewrite baseline yet.

## Required fixture profiles

- Small: 20 questions / 5 types / shallow conditions.
- Medium: 250 questions / 10 types / moderate formulas and option rules.
- Large: 2,000+ questions / representative real-world dependency fan-out and repeated sections.
- Renderer-only profiles: one question type, two question types, and many types.

Use anonymized, structurally representative fixtures. Do not use real voter identities or answers.

## Measurements

| Measurement | Cold/warm | Unit |
|---|---|---|
| DTO normalization + definition compile | Cold | ms |
| Expression compile | Cold | ms |
| Expression evaluation | Warm | ops/sec and ms |
| Single answer update propagation | Warm | ms |
| Full recomputation oracle | Warm | ms |
| Initial JS transfer | Cold | KiB |
| Per-renderer lazy chunk transfer | Cold | KiB |
| Peak heap after survey load | Both | MiB |

Report p50/p95/p99 for runtime actions. Capture the production build output and bundle analyzer report. Keep benchmark fixtures and scripts versioned so later commits can be compared.

## Formula evaluation comparison gate

The full evaluator remains the production oracle. Any incremental-evaluator benchmark must compare equivalent outputs before comparing timings: formula results, global-variable values, dynamic-filter templates, proposed actions, diagnostics, and validity. Include answer updates, global-variable changes, loop-instance switches, SectionLoop variable changes, formula failure/recovery, and repeated question-walk schedules.

For every profile, report:
- exact Node and npm versions;
- fixture question/formula/edge counts and dependency fan-out;
- warmup and measured iteration counts;
- p50, p95, p99, and throughput;
- heap delta or allocation data where available;
- whether the result is cold compile, warm full evaluation, or incremental update.

Do not compare an incremental update with a full evaluation unless both produce equivalent complete snapshots. Never run the full evaluator alongside every production incremental update just to measure a speedup; differential comparison belongs in deterministic tests or an explicitly enabled diagnostic benchmark.

## Focused action-resolution microbenchmark

The versioned Vitest benchmark is `projects/vote/src/app/runtime/actions/action-resolution-benchmark.spec.ts`. It compares the former linear question/option lookup path with the cached-index resolver on a synthetic survey containing 2,000 questions, 8,000 options and 1,500 distinct Select actions. It uses 3 warmup iterations and 15 measured iterations and emits p50/p95/p99, mean, cold index-build-plus-first-resolve time, Node version and fixture dimensions in CI logs.

First recorded CI sample (run [46127175859](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46127175859), Node v24.22.3, npm 11.19.1):

| Measurement | Linear reference | Cached-index resolver |
|---|---:|---:|
| p50 | 16.17 ms | 1.40 ms |
| p95 | 17.60 ms | 5.26 ms |
| p99 | 17.60 ms | 5.26 ms |
| Mean | 15.05 ms | 1.84 ms |

Cold index construction plus first resolution: 9.13 ms. Median ratio in this run: 11.55x.

This is a focused synthetic microbenchmark of action target resolution on a GitHub Actions runner, not a representative whole-survey runtime benchmark or browser measurement. The reference function isolates the former linear target lookup and does not reproduce every validation/diagnostic branch of the complete transaction. Treat the result as directional evidence for this specific hot path only. Repeat on the same runner/profile before using it as a regression threshold.


## Full runtime profile benchmark

The opt-in benchmark is versioned at projects/vote/src/app/runtime/definition/runtime-profile-benchmark.spec.ts and runs in CI with RUN_RUNTIME_BENCHMARKS=1.

It generates anonymized synthetic small, medium and large definitions:

| Profile | Questions | Sections | Options/question | Expressions |
|---|---:|---:|---:|---:|
| Small | 20 | 4 | 3 | 8 |
| Medium | 250 | 25 | 4 | 80 |
| Large | 2,000 | 100 | 5 | 400 |

For each profile it records cold DTO-to-definition normalization, expression compilation and graph construction; warm full formula evaluation; full projector evaluation; and one-answer projector propagation. Warm timings report p50/p95/p99 after 3 warmups and 12 measured iterations. The report also includes graph dimensions, Node/platform/architecture, and retained heap delta.

The heap delta is measured without forcing garbage collection. It is a noisy retained-heap observation, not allocation volume or peak heap. These are synthetic Node/CI profiles, not browser measurements or production customer-survey distributions. Browser timings remain a separate E2E requirement.

The Angular 22 application builder accepted --stats-json but did not emit a stats.json file in CI. The workflow now builds with --source-map and runs tools/analyze-bundle-sources.mjs, uploading dist/bundle-attribution.json as a 14-day artifact. The report groups original source-content byte sizes by emitted chunk and lists the largest source modules. These source-content sizes are attribution clues, not exact retained/minified contributions after tree-shaking; use them to identify candidates, then validate any optimization against the production chunk-size output.


## First full-runtime profile sample

CI run [46128065393](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46128065393) passed production build, bundle-attribution artifact generation and all tests (61 files, 380 passed, 1 skipped). Environment: Node v24.22.3, Linux x64; 3 warmups and 12 measured iterations per profile.

| Profile | Cold definition + expression + graph compile | Warm full evaluation p50 / p95 | Full projector p50 / p95 | One-answer projector propagation p50 / p95 |
|---|---:|---:|---:|---:|
| Small (20 questions, 8 expressions) | 6.641 ms | 0.057 / 0.067 ms | 0.352 / 0.902 ms | 0.304 / 1.182 ms |
| Medium (250 questions, 80 expressions) | 30.705 ms | 0.184 / 0.554 ms | 3.032 / 4.658 ms | 2.920 / 7.905 ms |
| Large (2,000 questions, 400 expressions) | 199.307 ms | 0.993 / 1.315 ms | 82.341 / 85.469 ms | 83.339 / 86.240 ms |

The large profile produced 12,800 graph nodes and 400 edges. The measured one-answer path currently re-runs the complete projector, so its cost is intentionally close to full projection; this is a baseline, not an incremental-evaluator result. The heap deltas were +4.89 MiB (small), -17.41 MiB (medium) and -8.83 MiB (large). Negative values demonstrate GC noise; do not interpret these as allocation savings. The benchmark is synthetic and CI-runner-specific.

## First bundle attribution sample

The same CI run reported an initial bundle of 966.00 kB raw / 246.15 kB estimated transfer:
- main chunk: 534.10 kB raw;
- unnamed initial chunk: 430.33 kB raw;
- remaining initial chunk: 1.45 kB raw.

Source-map report observations (source-content size, not exact retained bytes):
- The 420.24 KiB emitted chunk maps to large source inputs including Angular Core debug-node code (750.70 KiB source), Luxon (255.91 KiB), Angular Core (132.98 KiB), pending-tasks code (106.64 KiB) and ngx-exp-parser (71.38 KiB).
- The 521.59 KiB main chunk maps to Angular Router, Forms, Common, ngx-kit core and sanitize-html sources.
- tus-js-client is in a separate lazy chunk of about 60.34 KiB; its url-parse CommonJS dependency is therefore not the cause of the 430.33 kB initial chunk.

Do not remove Luxon, Angular debug-node exports, parser functionality or sanitizer based only on these source-map entries. The next bundle step is to trace which app/library import edges pull the candidates into the initial graph, then compare production output after one isolated change.
