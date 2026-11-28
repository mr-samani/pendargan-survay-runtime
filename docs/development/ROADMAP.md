# Rewrite roadmap

Estimates are provisional and assume one experienced developer with access to complete source and representative payloads. Re-estimate after Phase 0.

| Phase | Scope | Estimate | Exit gate |
|---|---|---:|---|
| 0 | Source discovery, behavior inventory, fixtures, baseline | 1–2 weeks | Contracts and benchmark baseline documented |
| 1 | Immutable domain model and definition compiler | 1–2 weeks | DTO adapter tests and diagnostics |
| 2 | Expression compilation and dependency graph | 2–3 weeks | Cycle-safe graph and analyzer tests |
| 3 | Incremental evaluation + full recompute oracle | 2–3 weeks | Differential/property tests pass |
| 4 | Answer state and deterministic actions | 1–2 weeks | Legacy answer payload parity |
| 5 | Visibility and aggregate rules | 1–2 weeks | Question/option/section parity |
| 6 | Flow runtime, pages, loops, navigation | 2–4 weeks | Flow fixture suite passes |
| 7 | Renderer registry and type-by-type migration | 2–4 weeks | Supported type parity and bundle report |
| 8 | Validation, persistence projection, integration | 2–3 weeks | API contract and E2E tests pass |
| 9 | Performance, accessibility, rollout | 2–3 weeks | Agreed budgets and regression gates |

Total initial planning range: approximately 16–26 weeks. This is not a delivery promise; missing legacy behaviors, backend dependencies, and complex question types can change it materially.
