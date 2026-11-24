# Flow projection

The flow engine turns immutable definition order, visibility, and loop iteration snapshots into stable navigable pages. It does not own formula evaluation, answer mutation, Angular rendering, or backend serialization.

## Modes

- section: one page per visible section iteration, containing that iteration's visible questions in definition order.
- question: one page per visible question iteration.
- A visible empty section can remain a page for static content; this behavior can be disabled with includeEmptySections: false.
- Visible questions without a matching section remain reachable through a synthetic unassigned section page or individual question pages.

## Navigation and iteration context

Every page exposes answerInstanceId. Loop pages additionally expose loopIterationIndex (zero-based) and backendLoopNumber (one-based). Navigation remains deterministic over the projected page list.

## Loop detection and execution

The original client marks repeatable sections through an active SectionLoop expression targeting the section's uniqueIdPerForm. The runtime also recognizes the generated section type Loop where present.

createSurveyLoopRuntime initializes iteration zero in the existing root answer namespace. advanceSurveyLoop accepts the evaluated SectionLoop result:
- true completes the current iteration and atomically creates the next isolated answer namespace;
- false completes the loop;
- null rejects advancement because the condition is unresolved.

Additional iteration IDs are stable and section-scoped. Each iteration stores its own variable snapshot and optional dynamic-data record ID. The maximum iteration count defaults to 100 and is configurable up to 1000.

## Boundaries

The loop module does not evaluate formulas or decide validation policy. The caller must evaluate the SectionLoop expression at the correct transition point and pass its tri-state result. Final submission still needs a dedicated adapter that serializes completed/filled iterations into the legacy ordered repeatSections payload. RetailAudit conversion remains a separate adapter concern.
