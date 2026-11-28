# RetailAudit submission compatibility

## Archived behavior

The source of truth is `PREVIUOS_SOURCE/app/vote/services/converter-data.service.ts`, specifically `changeRetailAuditToSectionLoop` and `getAnswerOfQuestion`, plus `SelectedSkuIteModel` and the RetailAudit child dialog.

The legacy converter clears the page containing the RetailAudit question and emits one repeated-section page for each eligible selected product:
- A synthetic `DynamicAnswer` answer is emitted first. It uses the RetailAudit question's backend ID, the product's `identificationCode`, and its `answerTitle`.
- The product's child questions follow. Matrix, Matrix_Dynamic and Group container nodes are flattened to their child questions before answer conversion.
- Every child answer carries that product's `dynamicDataRecordId`.
- `retaliVariables` becomes `variablesRepeatedSectionValue`; the top-level `variablesLastValue` is the merged sequence of per-product variables.
- Final and partial saves include only products with `formValid === true`. Temporary saves also include explicitly attempted incomplete products (`formValid === false`) but omit untouched products (`formValid === undefined`).

## Current implementation

`retail-audit-submission-serializer.ts` implements the product-row projection and is called by `buildSurveyRuntimeSubmission` when a section contains one RetailAudit question. It preserves the synthetic DynamicAnswer row, child question serialization, product dynamic-record IDs, repeated-section variables, and final/temporary inclusion rules.

The validation engine marks a required RetailAudit question invalid when any selected product has `formValid !== true`, recursively checking nested Matrix/Matrix_Dynamic/Group children. Optional RetailAudit questions do not reject incomplete product rows, matching the archived validator's required-only behavior. Restore now keeps nested descendants under their container parent rather than duplicating them as top-level siblings.

## Remaining work

- RetailAudit's interactive autocomplete/product selection and child-question dialog are not yet migrated to canonical renderer UI.
- Restore-to-submit tests now verify product IDs, child answer rows, nested Matrix descendants and exact JSON output. A selected required choice child is treated as answered even when its scalar value is null. Broader complete final/temporary/partial backend golden payload fixtures remain required.
- Multiple RetailAudit questions in one section are rejected explicitly because the archived conversion assumes a single RetailAudit question per section.
- The source migration does not claim full dynamic-data API, expression, or browser parity.
