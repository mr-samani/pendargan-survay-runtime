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
