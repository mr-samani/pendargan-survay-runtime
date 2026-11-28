# Dynamic data runtime integration

## Request path

The canonical session projector evaluates legacy `FilterDynamicAnswer` expressions as text templates. It emits `dynamicFilterUpdates` containing the expression ID, target question ID, and resolved filter text. It does not perform HTTP requests.

`VoteComponent` owns the integration boundary:

1. Register DynamicAnswer and SkuCount_Dynamic questions from the compiled definition's detached source DTOs.
2. On every accepted session transition, resolve the current page's `answerInstanceId`.
3. Activate that instance in `DynamicDataRefreshCoordinator` before applying side effects. The request registry cancels outstanding requests from the previously active loop instance.
4. Apply `dynamicFilterUpdates` as autocomplete requests.
5. Apply global-variable `sourceEffects` as SKU secondary-filter initial-list requests.

## Request modes

| Question type | Expression filter | Secondary filter |
| --- | --- | --- |
| DynamicAnswer | Dynamic autocomplete | Not supported |
| SkuCount_Dynamic | Dynamic autocomplete | Record-ID initial-list request |

The modes intentionally use separate request construction and deduplication keys. An unresolved `[%Variable%]` token cancels stale work and is never sent to the API.

## State and renderer behavior

- Requests and successful data are keyed by answer-instance ID and question ID.
- Activating another loop iteration cancels requests owned by the previous instance; successful cached data remains isolated under its original key.
- Dynamic renderer controllers subscribe to the loader's exact instance/question state.
- The session can issue an initial filter request before Angular creates the lazy renderer. The renderer receives the current loading/success snapshot immediately when it subscribes.
- User text search does not overwrite the computed-filter deduplication cache.

## Remaining verification

The request path is covered by deterministic unit tests for payload shape, deduplication, cancellation, stale response protection, loop-instance isolation, unresolved placeholders, and secondary-filter behavior. Live API verification and browser tests for rapid filter changes and SectionLoop backtracking remain pending.
