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
- `settings.matrixConfig.columnSize` is a pixel-width map indexed by the table column: index 0 is the row-title column (default 250px), and indices 1..N are data columns.
- Legacy mobile layout presents row groups; the rewrite uses a semantic table that switches to row cards at the mobile breakpoint when responsiveInMobile is enabled.

## Rewrite implementation

- `matrix-dynamic-layout.ts` is a pure immutable row-major layout projector.
- `MatrixDynamic` renders child question components through `NgComponentOutlet`.
- The pure visibility projection hides a row when all its children are hidden, hides a column when no row has a visible child in that column, and preserves blank cells to keep column alignment.
- Verified `columnSize` values are applied as pixel widths to both headers and cells; mobile card layout resets desktop pixel constraints.
- `Matrix_Radio`, `Matrix_Checkbox`, `Matrix_MultiNumeric` and `Matrix_MultiShortText` now have explicit cell controls in LegacyInput and are registered as concrete renderers.
- Root VoteComponent rendering skips questions with `parentUniqueId`; nested children are rendered by their owning parent. This also prevents Matrix children appearing twice.
- Matrix child lookup uses the complete VoteService question collection, so one-question-per-page slicing does not remove cells from the parent matrix.

## Current limits

- The archived `UpdateVariableInTitle` event updates row titles and column descriptions live. The rewrite does not yet wire that event into this renderer.
- Browser-level sticky-column, row-visibility directive, accordion and keyboard behavior are not reproduced. The owner has deferred Chromium E2E; do not mark full visual parity complete.
- Golden Matrix_Dynamic final/restore payload fixtures and full child validation parity remain part of RENDER-005/API-006.

## Tests

`matrix-dynamic-layout.spec.ts` contains ten tests covering row-major grouping, first-row column labels, row titles, default column count, malformed grouping, invalid column counts, immutability, the legacy empty-child grouping behavior, visible row/column projection and blank-cell alignment. The production build and complete 418-test suite passed in CI run [46131027929](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46131027929).


## Reactive title and description refresh

`QuestionModel` exposes `effectiveTitle` and `effectiveDescription` computed signals backed by runtime overrides. `VoteService.updateRuntimeQuestionText(questionId, title, description)` updates a child by either its `uniqueIdPerForm` or backend `uniqueId`; Matrix_Dynamic layout projection reads those computed values, so row labels and column headers refresh without rebuilding child question instances. The remaining formula pipeline must call this bridge when legacy title/description placeholders are recalculated.


The RetailAudit restore-to-submit suite now includes a Matrix_Dynamic parent with a required numeric leaf. Restore reconstructs the nested child tree, and submit flattens the container while preserving the leaf answer and its parent product `dynamicDataRecordId`. This verifies the nested serialization path; the remaining Matrix_Dynamic legacy validation and live formula-title producer parity are still open.
