# Answer state and input commands

## Separation

The immutable survey definition describes questions/options. `AnswerStateSnapshot` holds mutable runtime answers separately and is partitioned by runtime instance ID. The root instance is `root`; repeated section instances can be added later by FlowRuntime using stable instance IDs.

The store uses definition IDs (`uniqueIdPerForm` when present) rather than legacy form-object keys. It does not serialize answers into API DTOs.

## State

Each question answer stores:
- a JSON-safe raw `value` for question types that do not use option selection;
- selected option definition IDs;
- dirty state;
- the revision at which the answer last changed.

Question-specific derived fields such as Point, AnswerTitle, PointWeigth and SelectedCount are not stored here yet. They will be calculated by typed answer adapters after behavior is verified for each renderer.

## Commands

- `set-value`: replace the raw JSON-safe answer value.
- `set-selected-options`: set the exact selected option set.
- `toggle-option`: add/remove one option ID without assuming single- or multi-select policy.
- `clear`: clear raw value and selected options.

The reducer validates question/option membership. A batch is atomic: if any command is invalid, the original snapshot is returned unchanged. A successful batch increments the global revision once. Structurally equal values and unchanged selections are no-ops.

Option IDs are normalized to definition order, matching the order-based behavior observed in the existing renderers. This state layer does not enforce exclusivity; the question-type adapter decides which commands are valid for each type.

## Loop isolation

`addAnswerInstance()` creates a separate question-answer namespace for an explicit list of question IDs. It does not generate loop IDs, evaluate loop counts, or navigate between instances. Those responsibilities belong to FlowRuntime.

## Non-goals

- No visibility, required-state, or expression action mutation.
- No hidden-answer preservation/clearing policy.
- No API answer serialization or submission.
- No file upload, payment, dynamic-data, or async side effects.
