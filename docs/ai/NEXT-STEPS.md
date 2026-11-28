# Next steps

**Updated:** 2026-11-28  
**Branch:** `docs/rewrite-foundation`

## Current implementation state

- **Payment:** Angular host UI, verified four-route API adapter, ordered partial save, prior-question locks, countdown, popup reservation/fallback link, manual refresh/cancel, and canonical server-validated answer bridge are connected. The transaction amount is snapshotted into the answer payload. SignalR event parsing/correlation/teardown is connected through optional `PAYMENT_SIGNALR_CONNECTOR`; the repository does not yet provide a concrete SignalR client/provider. Payment remains outside the generic supported-renderer registry.
- **Matrix_Dynamic:** source-verified row-major layout, responsive table, four supported cell renderers, row/column visibility, and archived pixel-based column widths are implemented. Live title refresh and full validation/serialization parity remain open.
- **RetailAudit:** final/partial and temporary answer conversion to repeated-section pages is implemented. It emits the synthetic DynamicAnswer row, child answers, product record IDs and per-product variables. Nested Matrix/Group descendants are restored recursively at arbitrary depth and flattened exactly once during submission; a three-level round-trip fixture now covers this. Required child validation and exact JSON/restore-to-submit tests are in place. The interactive autocomplete/product-selection and child-question dialog UI are not yet migrated.
- **FileUpload/VoiceRecord:** transport runtime, upload coordinator and Angular host composition exist. Dedicated renderer UI and real CDN/browser verification remain open; live CDN/voice staging is deferred by the project owner.
- **API:** canonical DTO builder, question serializers, repeated-section projection, Payment partial-save orchestration and RetailAudit projection are implemented. Payment partial-save validation now has explicit tests for valid predecessors, invalid predecessors, missing validation results and ambiguous payment IDs. Broader generated DTO/golden payload parity and full save-response orchestration remain open.

## Active execution order

1. Implement a concrete SignalR provider for the archived Payment hub contract, then finish Payment host parity and keep the renderer unregistered until its integration gates pass.
2. Migrate the RetailAudit interactive UI using the archived dynamic-data autocomplete and child-question dialog contracts; preserve the completed submission/restore adapter.
3. Complete API-001/003/004/005/006: exact final/temporary/partial golden payloads, broader nested restore fixtures, generated DTO parity, and submit/temporary-save/partial-payment response orchestration.
4. Finish Matrix_Dynamic live title refresh, validation and serialization parity; then continue remaining source-verified renderer families.
5. Complete SESSION-002 formula parser/function/scope parity using archived expressions as fixtures. Keep the full evaluator as the production oracle until differential parity is demonstrated.
6. Update `TASKS.md`, `CURRENT-STATUS.md` and architecture docs after each CI-verified batch.

## Explicitly deferred

Per the project owner's direction, do not prioritize these until requested:
- Luxon / Angular debug-node import-chain attribution.
- Chromium E2E setup.
- Live CDN and Voice staging verification.

The normal production build, Vitest suite and existing runtime profile benchmarks remain part of CI; that does not reopen the deferred browser/CDN work.

## Latest verified CI

[GitHub Actions run 46133700374](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46133700374): production build and bundle attribution passed; 65 test files, 428 tests passed, 1 skipped. The small, medium and large runtime profiles also passed.
