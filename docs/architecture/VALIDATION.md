# Validation projection

Validation is a pure projection over the immutable definition, answer-state snapshot, and visibility result. It never mutates answers or controls navigation. The same scalar rules are used by the scalar renderer and the central runtime validator so that client-side feedback does not become the only enforcement point.

## Implemented behavior

- Required questions report an error when both selected options and the answer value are empty.
- Empty strings, null, empty arrays, and empty objects count as unanswered.
- Boolean false and numeric 0 are valid supplied values; they are not treated as empty.
- Inactive and hidden questions are skipped by default.
- Unknown visibility produces an indeterminate question status; it is not silently treated as visible or hidden.
- Selected option IDs are checked against the question definition.
- Point answers enforce the configured range, with the legacy 0–100 default when bounds are absent.
- Numeric answers enforce configured minimum/maximum values and optional decimal precision from settings.isDecimal and settings.maxDecimalDigit.
- Text answers enforce configured minimum/maximum lengths; Email, Mobile, Phone, and NationalCode have format checks.
- Mobile and NationalCode checks normalize Persian and Arabic-Indic digits before validation.
- CustomMaskShortText validates settings.maskRegEx; malformed archived patterns are ignored rather than crashing validation.
- Date answers validate ISO calendar dates against settings.minDate and settings.maxDate.
- FileUpload answers validate configured count/size/extension limits and reject incomplete uploads or missing server file IDs.

## Compatibility boundaries

- Email, mobile, phone, and national-code checks mirror the archived CustomFormValidators rules. The Mobile prefix allow-list is explicitly Iranian and should not be applied to non-Iranian deployments without a country-aware configuration.
- File size limits use the archived KB conversion (Math.round(bytes / 1024)). File dimensions are not validated because the canonical answer currently does not retain trustworthy image dimensions.
- FileUpload validation confirms upload completion and server identity; it does not perform the TUS upload itself. The renderer remains host-dependent.
- Mobile/Email verification codes and Captcha verification GUIDs require server-side validation endpoints. Format checks are not substitutes for those verification flows.
- Hidden-question policy remains controlled by the visibility projection and validateHiddenQuestions; no hidden answers are silently deleted.

## Still deferred

- Full legacy validation parity for Matrix_Dynamic, RetailAudit, RecordsOtherForms, Payment, Captcha, VoiceRecord, and cross-form data.
- Mobile/Email send-code and verify-code lifecycle.
- Browser-level tests for Date, Numeric formatting, and file upload UX.
- Image dimension validation and server-side upload-token/TUS lifecycle.
