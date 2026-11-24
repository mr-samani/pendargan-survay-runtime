# Flow projection

The flow engine turns immutable definition order and visibility into stable navigable pages. It does not own answer state, evaluate expressions, render Angular components, or expand loop sections.

## Modes

- `section`: one page per visible section, containing its visible questions in definition order.
- `question`: one page per visible question. A visible empty section can remain a section page for static content; this behavior can be disabled with `includeEmptySections: false`.
- Visible questions without a matching section are retained in a synthetic unassigned section page in section mode and remain individual question pages in question mode.

## Navigation

`getSurveyFlowNavigation()` provides the current, previous and next page and first/last flags. `getAdjacentSurveyFlowPage()` returns the adjacent page without mutating a cursor or answer state.

## Unknown visibility and loops

Questions/sections with unknown visibility are excluded from navigable pages and recorded in unresolved ID lists. `isReady` is false until visibility is fully resolved.

Loop sections are represented once only and marked `FLOW_LOOP_NOT_EXPANDED`; the flow is not ready for production use until a dedicated loop-instance runtime is implemented. This prevents a one-time section page from being mistaken for a completed loop implementation.
