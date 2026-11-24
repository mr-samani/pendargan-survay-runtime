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
