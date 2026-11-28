# Question answer serialization

## Source of truth

The behavior below is ported from the original production client's `ConverterDataService.getAnswerOfQuestion` and `getQuestionOtherDescription`. The rewrite uses immutable definition/answer snapshots and generated service-proxy DTOs; it does not mutate question models during serialization.

## Eligibility

The legacy converter returns no rows when a question is hidden, ended, inactive, or has no visible question/option, except for Group questions. The serializer accepts runtime visibility/end-form context and also honors detached source flags when present. For choice answers, selected options marked `dontShow === true` are omitted. The old converter does not separately filter selected options by `isActive`; the rewrite preserves that behavior.

## Per-type contract

| Question family | Legacy serialization |
|---|---|
| UniqueSelect, Dropdown, MultiSelect, Matrix_Radio, Matrix_Checkbox, Matrix_MultiShortText, Matrix_MultiNumeric, Emoji, image select types | One detail per selected visible option; option ID/title; question initial value; optional description according to description policy |
| HasPriority | One detail per ID in the answer string/list; preserves answer order in one-based `orderAnswer` |
| SkuCount | One detail per selected SKU; option ID; title; total in `answerDescription`; enclosing loop dynamic record ID |
| SkuCount_Dynamic | One detail per selected dynamic SKU; empty option ID; SKU identification code as dynamic record ID; title and total |
| Point, Rating, Numeric, Date, Time, Email, Mobile, NationalCode, Phone, ShortText, LongText, Location, PostalCode, CustomMaskShortText | One scalar detail; answer in `answerDescription`; validation GUID only when the question has verification |
| Point_NumericScale, NPS | One scalar detail; optional no-comment label in `answerTitle` when both `showNoCommentOption` and `noComment` are true |
| DynamicAnswer | One detail; answer title and identification code |
| FileUpload, VoiceRecord | One detail even when no files are present; files retain input order |
| Captcha | Validation key in `answerDescription`, answer GUID in `validationGuid` |
| Payment | configured amount in `answerTitle`, validation key in `answerDescription`, answer GUID in `validationGuid` |
| Group | One detail even when hidden/inactive; answer in description and `orderAnswer = 0` |
| Matrix, Matrix_Dynamic, HtmlFrame, Chart, RetailAudit, RecordsOtherForms, OpenPopUpSection | No direct detail row; Matrix children serialize separately and RetailAudit is converted by a separate adapter |

## Description rules

The original client:
- returns an empty description when the question has no description;
- for MultiSelect, reads the selected option's own `answerDescription`;
- for AllOptions, uses the question's shared description answer;
- for SelectedOption, uses the shared description only when that option has `hasDescriptiveAnswer`;
- for LastOption, uses the shared description only for the final option in the question's option order.

The immutable answer state represents these values in `value.descriptionAnswer` and `value.optionDescriptions[optionId]`. Choice IDs are held separately in `selectedOptionIds`.

## Complex answer value shapes

The top-level payload builder preserves the legacy metadata rules: the form GUID is duplicated into `guid` and `voterDetail.guid`; zero latitude/longitude/GPS accuracy are omitted; region defaults to an empty string; voice recording file metadata is supplied by the caller; partial payment registration is included only for the partial-payment flow.

The pure serializer expects JSON-safe values:
- HasPriority: comma-separated IDs (Persian or ASCII comma) or an ordered string array.
- SKU: array of objects containing `questionOptionUniqueId`, `answerTitle`, `total`; dynamic SKU also needs `identificationCode`.
- DynamicAnswer: object with `identificationCode` and `answerTitle`.
- File/Voice: array of objects with `fileUniqueId`.
- Captcha/Payment: object with `answer` (or `validationGuid`) and `validationKey`.
- Verified scalar answers: scalar or object with `value`/ `answer` and optional `validationGuid`.

These are explicit runtime value conventions, not new backend DTO fields.

## Known generated DTO mismatch

The archived legacy DTO declares `dynamicDataRecordId: string | number`, while the currently generated rewrite DTO declares `dynamicDataRecordId?: number | null`. The serializer accepts numeric values and numeric strings but rejects non-numeric identifiers with `ANSWER_DYNAMIC_RECORD_ID_NOT_NUMERIC`. It does not silently truncate or discard a GUID-like identifier. This schema mismatch must be reconciled with the live API contract before claiming full DynamicAnswer compatibility.

The archived legacy `FileVoterAnswerDetailsDto` includes `fileId`, `fileUniqueId`, and `order`; the current generated DTO exposes only `fileUniqueId` and `order`. The rewrite currently emits only fields supported by the generated DTO. This is a second contract difference to verify against the live API before claiming exact file-answer parity.

## Remaining integration

- The default loop submission projection calls this serializer when no custom serializer is supplied.
- Runtime renderer adapters must continue to write complex values using the documented shapes; specialized child renderer parity remains incomplete for RetailAudit.
- The runtime controller supplies evaluated visibility, end-form state, per-question evaluated initial value, and per-page dynamic record ID.
- RetailAudit conversion, top-level CreateVoterWithDetailsDto assembly, temporary/partial payload construction and saved-answer restore are connected. API-006 now has exact complete final, temporary and partial-payment payload goldens. Remaining API work is generated DTO schema parity, host-level orchestration and backend round-trip verification.
