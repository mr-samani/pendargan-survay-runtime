# Validation projection

Validation is a pure projection over the immutable definition, answer-state snapshot, and visibility result. It never mutates answers or controls navigation.

## Implemented behavior

- Required questions report an error when both selected options and the answer value are empty.
- Empty strings, null, empty arrays, and empty objects count as unanswered.
- Boolean `false` and numeric `0` are valid supplied values; they are not treated as empty.
- Inactive and hidden questions are skipped by default.
- Unknown visibility produces an indeterminate question status; it is not silently treated as visible or hidden.
- Selected option IDs are checked against the question definition.
- The checked-in legacy `QuestionModel` explicitly normalizes `Point` questions to a default range of 0–100. The validator enforces the configured/default range for Point only.

## Deliberately deferred

The DTO exposes min/max fields, but the checked-in source only demonstrates their use as a numeric range for `Point`. Do not interpret them as selection-count limits for other question types without verifying the original source. Type-specific validation for Numeric, Date, Matrix, FileUpload, DynamicAnswer, Payment, and other renderers remains open, as do description validation, custom masks, and hidden-answer policy.
