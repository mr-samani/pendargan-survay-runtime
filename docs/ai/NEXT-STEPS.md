# Next steps

**Updated:** 2026-11-28  
**Branch:** `docs/rewrite-foundation`

## Current implementation state

- **Payment:** Angular host UI, verified four-route API adapter, ordered partial save, prior-question locks, countdown, popup reservation/fallback link, manual refresh/cancel, and canonical server-validated answer bridge are connected. The transaction amount is snapshotted into the answer payload. A concrete `@microsoft/signalr@10.0.11` provider now handles cookie credentials, optional access-token factories, initial start retries, automatic reconnect, lifecycle notifications, subscription deduplication and teardown; duplicate transaction events are also gated. Payment remains outside the generic supported-renderer registry.
- **Matrix_Dynamic:** source-verified row-major layout, responsive table, four supported cell renderers, row/column visibility, and archived pixel-based column widths are implemented. Live title refresh and full validation/serialization parity remain open.
- **RetailAudit:** final/partial and temporary answer conversion to repeated-section pages is implemented. It emits the synthetic DynamicAnswer row, child answers, product record IDs and per-product variables. Nested Matrix/Group descendants are restored recursively at arbitrary depth and flattened exactly once during submission; a three-level round-trip fixture now covers this. The V2 autocomplete, duplicate-aware product list and lazy Angular renderer are now connected. Its child editor uses an isolated immutable draft per product, restores nested Group/Matrix child values, and supports common scalar/choice types. Unsupported specialized child types cannot be saved. Formula-driven child visibility, complete specialized renderer parity, and browser-level parity remain open.
- **FileUpload/VoiceRecord:** transport runtime, upload coordinator and Angular host composition exist. Dedicated renderer UI and real CDN/browser verification remain open; live CDN/voice staging is deferred by the project owner.
- **API:** canonical DTO builder, question serializers, repeated-section projection, Payment partial-save orchestration and RetailAudit projection are implemented. Payment partial-save validation now has explicit tests for valid predecessors, invalid predecessors, missing validation results and ambiguous payment IDs. Broader generated DTO/golden payload parity and full save-response orchestration remain open.

## Active execution order

1. Extend the first-pass RetailAudit UI to full source-verified child renderer parity, including formula/visibility context, specialized Matrix cell editors and exact restore/edit/submit fixtures; preserve the isolated per-product answer namespace.
2. Complete remaining API-001/003/004/005 work: generated DTO schema parity, broader nested restore fixtures, host-level submit/temporary-save/partial-payment orchestration, quota and post-submit behavior, and backend response round trips. API-006 complete payload goldens are now in place.
3. Finish Matrix_Dynamic validation, option-title interpolation and serialization parity; then continue remaining source-verified renderer families.
4. Complete SESSION-002 formula parser/function/scope parity using archived expressions as fixtures. Keep the full evaluator as the production oracle until differential parity is demonstrated.
5. Complete live Payment gateway/browser parity; keep the renderer out of the generic registry until its integration gates pass.
6. Update `TASKS.md`, `CURRENT-STATUS.md` and architecture docs after each CI-verified batch.

## Explicitly deferred

Per the project owner's direction, do not prioritize these until requested:
- Luxon / Angular debug-node import-chain attribution.
- Chromium E2E setup.
- Live CDN and Voice staging verification.

The normal production build, Vitest suite and existing runtime profile benchmarks remain part of CI; that does not reopen the deferred browser/CDN work.

## Latest verified CI

[GitHub Actions run 46144548901](https://github.com/mr-samani/pendargan-survay-runtime/actions/runs/46144548901): production build and bundle attribution passed; 68 test files, 465 tests passed, 1 skipped. The small, medium and large runtime profiles also passed.
