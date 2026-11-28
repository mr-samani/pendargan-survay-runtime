# Matrix_Dynamic renderer

## Archived behavior

The source renderer is `PREVIUOS_SOURCE/app/vote/elements/matrix-dynamic/matrix-dynamic.component.ts` and its HTML template.

- `matrixParts` is the number of columns; the legacy default is one.
- Child questions are selected by `parentUniqueId === parent.uniqueId` in the existing sorted question list.
- The first `matrixParts` children provide the column descriptions.
- The first child in each row provides the row title.
- Children are grouped row-major; a child count not divisible by the column count is an invalid matrix configuration.
- Each cell is an ordinary question renderer, not a flattened parent answer.
- `settings.matrixConfig.simpleMode` and `responsiveInMobile` control presentation.
- Legacy mobile layout presents row groups; the rewrite uses a semantic table that switches to row cards at the mobile breakpoint when responsiveInMobile is enabled.

## Rewrite implementation

- `matrix-dynamic-layout.ts` is a pure immutable row-major layout projector.
- `MatrixDynamic` renders child question components through `NgComponentOutlet`.
- `Matrix_Radio`, `Matrix_Checkbox`, `Matrix_MultiNumeric` and `Matrix_MultiShortText` now have explicit cell controls in LegacyInput and are registered as concrete renderers.
- Root VoteComponent rendering skips questions with `parentUniqueId`; nested children are rendered by their owning parent. This also prevents Matrix children appearing twice.
- Matrix child lookup uses the complete VoteService question collection, so one-question-per-page slicing does not remove cells from the parent matrix.

## Current limits

- `matrixConfig.columnSize` is intentionally not translated into CSS widths yet; the archived `ngx-table-sticky-resposive` component's sizing units/semantics must be verified first.
- The archived `UpdateVariableInTitle` event updates row titles and column descriptions live. The rewrite does not yet wire that event into this renderer.
- Browser-level sticky-column, row-visibility directive, accordion and keyboard behavior are not reproduced. The owner has deferred Chromium E2E; do not mark full visual parity complete.
- Golden Matrix_Dynamic final/restore payload fixtures and full child validation parity remain part of RENDER-005/API-006.

## Tests

`matrix-dynamic-layout.spec.ts` covers row-major grouping, first-row column labels, row titles, default column count, malformed grouping, invalid column counts, immutability and the legacy empty-child grouping behavior.
