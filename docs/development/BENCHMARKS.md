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

The CI workflow also requests Angular production stats JSON and uploads the generated stats file as a 14-day artifact. The 430.24 kB initial chunk must not be attributed until that artifact is downloaded and its module/chunk graph is inspected. If the installed Angular application builder does not emit stats.json for this option, fix the build-statistics collection step before drawing conclusions.
