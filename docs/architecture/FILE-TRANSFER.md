# File transfer and voice capture runtime

## Production TUS transport

- `tus-js-client@4.3.1` is a production dependency and is recorded in the lockfile.
- `SurveyFileTransferHost` lazy-loads the package only when a configured survey starts, keeping the TUS client out of the initial bundle.
- The default endpoint is `AppConsts.remoteBaseUrl + '/FileStorage_CDN'`.
- `provideSurveyFileTransfer(Upload, createHttpStack?)` remains available as an optional host override for custom TUS constructors or legacy HTTP stacks.
- The adapter preserves the archived contract: per-file `fileToken`, legacy metadata, 2 MiB chunks, retry delays, one parallel upload, PATCH override, `application/octet-stream`, resume lookup, non-retryable status handling, and `fileid` / `fileidunique` / `fileaddressurl` response headers.

The adapter and host are covered with structural TUS client doubles. A real request to the production CDN has not been performed in CI.

## Shared upload lifecycle

`FileUploadRuntime` owns immutable upload snapshots, progress, retry, cancellation, removal, disposal, and stale-callback protection. A completed upload is accepted only when the server returns both `fileid` and `fileidunique`.

`SurveyFileUploadCoordinator` connects the compiled question definition to the shared transport. It resolves per-file upload tokens, applies extension/size/count limits, indexes uploads by question and answer instance, merges completed files idempotently by `fileUniqueId`, and blocks final submission while any selected upload is unfinished or failed.

## Angular UI integration

`VoteComponent` owns one transfer coordinator per active survey. The vote host renders native file selection for FileUpload questions and browser MediaRecorder controls for VoiceRecord questions. Both controls display upload progress and expose retry, cancel, and remove actions.

Progress notifications increment Angular signals so the controls refresh correctly in zoneless mode. Upload completion and removal dispatch through `RendererRuntimeSessionBridge` into the originating answer instance, even if a SectionLoop navigation occurred while the upload was running.

The host exposes the browser voice recorder, sends its resulting audio file through the same TUS runtime using `voiceRecordToken`, and adds the completed `voiceRecordFileIdUnique` reference to submission metadata.

## Answer restore and submission

- Completed file answers retain the archived answer shape and are serialized/restored through the existing question answer serializer/restorer.
- The canonical answer bridge writes uploaded files to the correct question and answer-instance namespace.
- Final submission is blocked if a selected upload is uploading, retrying, failed, or cancelled.
- Before submission, every completed question-file upload must be present in its originating canonical answer instance.
- Voice submission requires exactly one successful voice upload and a safe numeric file ID; its unique ID is added to voter-detail metadata.
- Existing saved file answers are restored as canonical answer values; they do not require re-upload.

## Remaining external verification

The code path is connected end-to-end inside the Angular application, but the following require a real deployment environment and cannot be proven by unit tests alone:

- Browser upload against the configured `FileStorage_CDN` with valid server-issued file tokens.
- Browser microphone permission and MediaRecorder behavior across target browsers/devices.
- Server response header compatibility and restored-file URL playback/download.
- Camera capture and Xamarin/KBrowser-specific bridges remain outside this browser runtime.

Do not mark live CDN/device verification as complete until those checks have been run against the target environment.
