# Runtime architecture

## Design goals

1. Deterministic behavior for the same definition, answers, and runtime context.
2. Incremental work proportional to the affected dependency subgraph rather than total survey size.
3. Independent and lazy question renderers.
4. Stable compatibility with existing API DTOs and answer submission.
5. Testability without Angular components or a browser.

## Proposed layers

```text
API DTOs
  |
  v
Compatibility Adapter / Validation
  |
  v
Survey Definition Compiler
  |-- immutable SurveyDefinition
  |-- expression programs (ngx-exp-parser)
  |-- dependency graph
  |-- diagnostics
  |
  v
Survey Runtime
  |-- Answer State
  |-- Variable / Formula State
  |-- Visibility Engine
  |-- Flow Runtime (sections, loops, page modes)
  |-- Validation / Submission projection
  |
  +--> Angular Facade (signals, readonly projections)
           |
           v
      Renderer Host
           |
           +--> Lazy Question Renderer Registry
```

## Ownership boundaries

- **Compatibility adapter:** maps API DTOs to domain definitions and maps runtime answers back to the exact legacy submission DTO.
- **Definition compiler:** validates and freezes definition data; resolves stable references; compiles expression programs and dependency metadata once per definition revision.
- **Dependency engine:** records input-to-derived-node edges and schedules only affected nodes.
- **Answer state:** stores user-entered values and selection state. It must not be erased merely because a question becomes hidden unless a verified legacy rule requires that behavior.
- **Visibility engine:** calculates option, question, and section visibility; aggregates parent visibility from children.
- **Flow runtime:** determines current/next/previous runtime item. Loop occurrences need unique runtime instance IDs even when they share one definition ID.
- **Renderer registry:** maps a type ID to a loader and a small typed contract; rendering is presentation, not business-rule execution.
- **Angular facade:** exposes readonly signals and explicit commands. It should not own the graph algorithm or parse expressions in templates.

## Reactive evaluation

A user action becomes a command. The runtime updates the source answer, marks dependent nodes dirty, evaluates them in deterministic topological order, and propagates only when a node's value changes. Multiple source changes in one action should be batched into one transaction. Full recomputation remains a reference oracle until randomized differential tests establish equivalence.

Do not use Angular effects as a general-purpose dependency scheduler. Keep the evaluation algorithm explicit and deterministic; expose its committed results through signals.

## Error model

Unsupported type, invalid expression, missing reference, dependency cycle, and runtime evaluation error must be represented as structured diagnostics. Do not silently coerce an invalid survey into a partially working state. Define whether an error blocks the survey, blocks one question, or degrades a non-critical feature only after legacy behavior is understood.
