# Dynamic question renderers

## Decision

Use a finite, explicit registry of question-type IDs to dynamic-import loader functions. Keep this registry separate from the expression/runtime core.

The existing `definitions.ts` already uses dynamic imports for three types. Preserve the direction, but replace the weak `Type<any>` map with a typed renderer contract and robust loading/error behavior.

## Why it helps

A static import of every renderer from the runtime entry point can pull all renderer code into the initial dependency graph. A dynamic `import()` creates a bundler split point. If a survey only needs a subset of types, only those renderer chunks should need to be fetched.

This does **not** guarantee that all bytes disappear from the initial bundle:
- shared dependencies may be hoisted into initial or shared chunks;
- a renderer may import a large shared module;
- a bundler can merge chunks depending on build configuration;
- the first screen may request several types at once;
- preloading policy changes network timing.

Therefore the acceptance test is the actual production build: initial JS bytes and per-type lazy chunk bytes must be reported.

## Proposed contract

A renderer definition should include:
- stable question type ID;
- lazy loader returning the renderer component;
- optional preload policy;
- schema/version metadata if renderer-specific settings need validation;
- optional capability metadata (e.g. supports children, files, matrix rows).

The host should pass a normalized immutable question definition and a runtime question-instance facade, not the entire mutable engine/service. A renderer emits typed user actions; the runtime owns answer mutations.

## Loading behavior

1. Inspect the survey definition and collect unique renderer type IDs.
2. Validate all IDs against the registry before starting the survey.
3. Load only renderers required by the selected survey or current page, depending on UX/network trade-offs.
4. Cache each in-flight Promise and resolved component by type ID.
5. Load different required renderers concurrently with `Promise.all`, not by awaiting each question serially.
6. Preserve a stable loading/error state per type.
7. Never evaluate arbitrary module paths or import specifiers received from the server.

## Security and extensibility

Server payloads may select only registered numeric/string type IDs. They must not provide a JavaScript import path, module URL, class name, or executable code. Custom renderers should be registered by trusted application code at build time or through a separately reviewed plugin mechanism.

## Rollout

- Keep the current `NgComponentOutlet` host initially.
- Introduce a typed registry and loader cache.
- Add tests proving only requested loaders execute, repeated requests share a Promise, and unknown IDs return a structured unsupported-type error.
- Measure initial bundle and lazy chunks before/after.
- Migrate each question renderer independently and compare answer payloads.

## Current implementation observation

The registry now includes shared lazy renderers for scalar answer families (ShortText, LongText, Numeric, Date, Time, Email, Phone, Mobile, NationalCode, and PostalCode), alongside HtmlFrame, UniqueSelect, MultiSelect, DynamicAnswer, and SkuCount_Dynamic. Scalar inputs publish JSON-safe `question-value` events; numeric values are normalized to finite numbers while empty/invalid numeric input remains an empty answer. Date and time values preserve the native `yyyy-MM-dd` and `HH:mm` strings. These renderers are a first migration slice, not yet a full legacy visual/validation parity claim.
## Renderer-facing controller boundary

`DynamicDataRendererController` now connects the DTO registration, refresh coordinator, per-instance loader stream, and immutable DynamicAnswer/SKU domain operations without coupling those concerns to Angular template markup.

- One controller belongs to exactly one `(answerInstanceId, questionId)` pair. It registers the DTO-derived question metadata, activates its loop instance, and exposes a replayed snapshot stream for a renderer's AsyncPipe or subscription.
- DynamicAnswer initialization and explicit text search use the autocomplete path. Selection is accepted only when the record exists in the latest result and is not reserved by an earlier SectionLoop iteration; selection restore and optional first-option selection are reconciled when the list arrives.
- SkuCount_Dynamic initialization can use the secondary-filter record-ID path. Search and `FilterDynamicAnswer` remain autocomplete requests; global-variable secondary-filter changes use the distinct initial-list request.
- SKU add/remove/increment/decrement/manual-total operations use immutable domain helpers and publish the complete selected list through one answer-change callback. The controller exposes the aggregate total.
- Switching the loader to another loop instance makes old controller requests and searches inactive. A stale renderer cannot start another request or select a record from its inactive instance.
- The controller deliberately does not create or mutate `QuestionModel`, `vote.form`, or canonical answer state. The host renderer must translate `onAnswerChange` into the canonical runtime command and own controller lifetime.

This is a tested renderer integration boundary, not yet a production Angular component or a `VoteComponent` bootstrap hookup. The remaining host work is to instantiate controllers from actual `QuestionModel` inputs, subscribe to their snapshots, connect the answer callback to the runtime event/session bridge, and refresh filters from `QuestionBase` signals.

## Angular renderer and VoteComponent integration

The production Angular host now has lazy-registered standalone renderers for `DynamicAnswer` and `SkuCount_Dynamic`.

- Both renderers instantiate a per-question `DynamicDataRendererController`, subscribe to its per-instance snapshot, and dispose the subscription with the component.
- Both consume `QuestionBase` field-filter signals and the runtime effect revision. SKU also watches the secondary-filter signal; it uses the initial-list request only when the archived `dontShowAllWithoutSearch` setting is enabled.
- DynamicAnswer restores a saved record by identity, displays reserved SectionLoop records as unavailable, supports clearing, and projects the selected record's dynamic fields into the legacy formula model.
- SKU supports autocomplete suggestions, adding/removing records, plus/minus quantity history, manual totals, and aggregate total. A secondary-filter response merges into the selected collection without replacing in-session totals or history.
- `QuestionRuntimeEventBus` now carries JSON-safe question-value changes. The renderer adapter converts them to canonical `set-value` commands; the session bridge remains responsible for choosing the active answer instance.
- `VoteComponent` now attempts to compile the immutable definition, expression graph and projector after the legacy form has initialized, then starts the bridge before removing the loading state. Dynamic-data loader/coordinator providers are scoped to each VoteComponent so concurrent vote views cannot share request registries.
- The loader and refresh coordinator dispose their subscriptions and request state with their Angular injector.

**Important rollout boundary:** this bootstrap is guarded by successful definition/expression/graph compilation and session start. The current structured formula scope is not yet a verified replacement for all archived `@Q...` aliases, and saved-voter restoration is not yet wired into this VoteComponent path. A rejected start is logged and leaves the legacy question UI available; do not treat this as full production parity.


## Scalar answer renderer integration

A shared standalone `ScalarAnswer` renderer is registered for ShortText, LongText, Numeric, Date, Time, Email, Phone, Mobile, NationalCode, and PostalCode. It emits the same view-scoped `question-value` event used by dynamic-data renderers, so the session bridge chooses the active root/SectionLoop instance and compiles a canonical `set-value` command. Numeric normalization preserves empty input as an empty answer and rejects non-finite values rather than coercing them to zero. Native date/time input strings are retained unchanged.

The scalar component intentionally keeps its UI small and does not claim complete archived component parity yet: national-code/phone/postal validation, custom masking, barcode capture, locale-specific numeric formatting, and exact legacy error messaging still require dedicated compatibility work. CustomMaskShortText is now registered and applies archived mask regex and length bounds. Image-choice aliases reuse the existing choice renderers. The shared `LegacyInput` renderer now covers Dropdown, Point, Point_NumericScale, NPS, Rating, Emoji, HasPriority, Matrix, and static SkuCount. Matrix rows are resolved from the parent question's actual `VoteService.questionList` relationship, and each row emits its own canonical question-value event. Priority selection preserves order and exposes up/down reordering.


## Legacy input renderer migration — 2026-11-25

The registry now explicitly advertises supported types through `SUPPORTED_QUESTION_RENDERER_TYPES`, with a test that loads every advertised renderer and verifies that platform-dependent types are not accidentally reported as implemented.

| Renderer | Question types |
|---|---|
| ScalarAnswer | ShortText, LongText, Numeric, Date, Time, Email, Phone, Mobile, NationalCode, PostalCode, CustomMaskShortText |
| UniqueSelect / MultiSelect | UniqueSelect, MultiSelect, UniqueSelectWithImageOptions, MultiSelectWithImageOptions |
| LegacyInput | Dropdown, Point, Point_NumericScale, NPS, Rating, Emoji, HasPriority, Matrix, SkuCount |
| DynamicAnswer / SkuCountDynamic | DynamicAnswer, SkuCount_Dynamic |
| HtmlFrame | HtmlFrame |

LegacyInput keeps canonical writes JSON-safe. Matrix rows are emitted independently using their own question identifiers; Matrix_Radio and Matrix_Checkbox use selected-option commands, while Matrix_MultiNumeric/Matrix_MultiShortText emit an atomic selected-column plus cell-value batch keyed by stable option IDs. HasPriority serializes the ordered comma-separated IDs and supports bounded selection plus explicit up/down reordering. Static SkuCount emits the array shape expected by the existing answer serializer, preserves per-option quantity/total/history, and validates required totals.

**Not migrated as production renderers:** FileUpload, VoiceRecord, Location, Payment, Captcha, RecordsOtherForms, RetailAudit, Matrix_Dynamic, OpenPopUpSection, Group, and Chart. These depend on host-specific upload/TUS, recorder, geolocation/map, payment gateway, CAPTCHA provider, cross-form query, retail-audit conversion, or composite navigation contracts. They must not be replaced by fake file inputs or generic text boxes. Their adapters need the actual host services and backend payload behavior.
