# Browser integration and end-to-end verification

## Current boundary

The CI workflow currently runs the Angular production build and Vitest's Angular unit-test builder. It does not yet launch a real browser. Existing component/runtime tests run in the configured unit-test environment; they are not evidence of Chromium, device, microphone, or live CDN compatibility.

Do not describe these checks as browser E2E.

## Browser scenarios required

| Area | Scenario | Required assertion |
|---|---|---|
| Session startup | Load a new survey | Definition, expression graph and initial canonical session start once and in order |
| Edit restore | Restore saved voter answers | Restored answers and loop instances are visible before renderer subscriptions start |
| Temporary restore | Accept/cancel temporary data | Consent boundary is preserved; cancel never hydrates temporary answers |
| Session navigation | Next/previous through SectionLoop | Active instance changes; answers remain isolated; backtracking reuses the correct iteration |
| Renderer bridge | Change scalar and choice answers | Accepted events update canonical state and the visible projection; rejected events do not |
| Dynamic data | Change expression/global-variable filters rapidly | Latest request wins; stale requests are cancelled/ignored; caches remain instance-scoped |
| FileUpload | Select, resume, cancel, retry, remove | TUS metadata/token, progress, server file ID and canonical answer agree |
| VoiceRecord | Record, upload, restore and playback | Permission/cancel cleanup, MIME/codec, file metadata and browser playback are valid |
| Submission | Final, temporary and partial-payment paths | Upload readiness is fail-closed and serialized DTO matches golden payloads |

## Environment requirements

A real upload E2E run requires a disposable survey, valid server-issued per-file tokens, a configured CDN endpoint, and credentials that are not committed to the repository. Voice capture additionally requires a browser microphone permission grant and a supported audio codec. Use a dedicated test poll and remove uploaded test objects after the run.

Never print access tokens, voter identifiers, or complete answer payloads into CI logs. Store secrets only in GitHub Actions secrets/environment protection and redact request headers.

## Execution strategy

1. Keep deterministic state-machine, coordinator, adapter and renderer-controller tests in Vitest. These tests should use fake HTTP/TUS transports and deterministic fixtures.
2. Add a real-browser runner with mocked API responses for session lifecycle, restore, navigation, dynamic-data race handling and renderer interaction. This tier must launch Chromium against the production build and fail on uncaught browser errors.
3. Run FileUpload/VoiceRecord against a dedicated staging CDN only when the required secrets and test poll are configured. Skip the live tier explicitly when those prerequisites are absent; never convert a skipped live test into a passing production-compatibility claim.
4. Keep microphone/device, hybrid Xamarin/KBrowser and cross-browser codec checks as separately reported manual/device gates until their target environments are available.

## Current automated coverage

- VoteComponent has a shallow Angular component creation test.
- Runtime session coordinator, renderer bridge, dynamic-data controller/refresh coordinator, TUS adapter/host, upload state machine and browser voice recorder have deterministic unit/integration-style tests with fakes.
- These are useful regression coverage but do not launch Chromium or contact the real API/CDN.
- E2E-001 remains open until the real-browser suite and the required staging-service scenarios pass.
