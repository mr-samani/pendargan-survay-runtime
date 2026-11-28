# Visibility projection

This module is a pure projection over the immutable survey definition, compiled expressions, and formula evaluation result. It does not mutate answer state, the legacy question models, or renderer objects.

## Implemented subset

Only `InsideForm` expressions targeting a Question or Answer with Show/Hide actions are resolved. The mapping uses the owning question's source ID, per-form ID, or runtime ID, and the answer target's per-form ID or runtime ID.

The behavior mirrors the checked-in implementation's aggregation:
- All Show conditions for a target are combined with AND; no Show rule defaults to true.
- All Hide conditions are combined with AND; no Hide rule defaults to false.
- A target is visible when its Show conjunction is true and its Hide conjunction is false.
- A question with options is additionally gated by at least one visible option.
- A section is visible when at least one member question is visible.

The projection uses tri-state visibility. If an active condition cannot be evaluated and no known condition decides the result, visibility is `null`; it does not silently coerce a failed formula to true or false.

## Not yet implemented

Select/UnSelect application, action conflict precedence, Required/NotRequired, validation, section-level actions, loops, hidden-answer retention/clearing, navigation and submission remain separate tasks. Unsupported scopes/targets are returned as unhandled proposals or diagnostics. Empty sections default to visible because they may contain static content; callers may explicitly request hidden.
