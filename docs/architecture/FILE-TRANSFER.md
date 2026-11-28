# File transfer and voice capture runtime

## Shared upload lifecycle

`FileUploadRuntime` owns a transport-independent lifecycle for FileUpload and
VoiceRecord transfers. It provides immutable snapshots, progress, retry,
cancellation, disposal, and stale-callback protection. A completed upload is
accepted only when the server returns both `fileid` and `fileidunique`.

## TUS adapter

`TusJsFileUploadTransport` is a concrete adapter around a host-supplied
`tus-js-client` Upload constructor. The package is intentionally not added to
this workspace's dependencies yet: the rewritten application has no host
composition root for the archived CDN endpoint, file-token source, or custom
HTTP stack. A host can wire the existing package and its legacy HTTP stack:

```ts
const transport = new TusJsFileUploadTransport(
  Upload,
  () => new ReplaceContentTypeHttpStack(),
  (status, body) => showUploadError(status, body),
);
const runtime = new FileUploadRuntime(transport, {
  endpoint: remoteBaseUrl + '/FileStorage_CDN',
});
```

The adapter preserves the archived contract:

- Endpoint suffix: `/FileStorage_CDN`.
- Per-file `fileToken` request header.
- Metadata: `name`, `filename`, `emptyMetaKey`, `size`, `formGuid`,
  `pollUniqueId`, `idCode`, and `formUniqueId`.
- 2 MiB chunks, retry delays of 1/3/4 seconds, one parallel upload, and the
  legacy PATCH override.
- `application/octet-stream` on requests to the FileStorage_CDN endpoint.
- Resume the first previous TUS upload before starting a new upload.
- Do not retry HTTP statuses 401, 403, 404, 406, 417, 410, 415, or 510.
- Capture `fileid`, `fileidunique`, and optional `fileaddressurl` from
  response headers.

The host must still provide the Upload constructor, the custom HTTP stack
factory (when required by its TUS client version), endpoint configuration,
file-token DTOs, and UI/error presentation. This adapter is unit-tested with a
structural TUS client double; no live CDN request has been made.

## Browser voice capture

`BrowserVoiceRecorder` is a browser-only capture engine independent from
Angular, Xamarin, and KBrowser. It handles microphone permission, supported
WebM/Ogg MIME selection, MediaRecorder events, immutable recording state,
duration, conversion to a File, cancellation, late permission resolution,
and microphone-track cleanup.

The host supplies `navigator.mediaDevices` and a small MediaRecorder factory.
`createLegacyVoiceUploadFile` applies the archived filename convention
`recorded_voice_{pollUniqueId}.ogg` while preserving the actual Blob MIME type.
The resulting File can be passed to the shared `FileUploadRuntime` with the
existing voice-record token and form metadata.

## Remaining integration boundary

These modules are runtime building blocks, not completed question renderers.
The rewritten app still needs a host composition service to supply file-token
DTOs, TUS constructor/HTTP stack, remote endpoint, and error notifications;
the FileUpload renderer and answer-state bridge remain unregistered. Voice
capture also needs to be wired to the voice question lifecycle and the shared
upload runtime. Xamarin/KBrowser bridges and their server request contracts
remain separate host adapters. No end-to-end upload or microphone test against
a real browser/device/backend has been performed.


## Canonical answer-state bridge

`toFileAnswerValue` converts only a successful upload with a server-issued
`fileUniqueId` into the archived FileUpload/VoiceRecord answer shape.
Numeric server file IDs are converted to safe integers for the generated
`FileVoterAnswerDetailsDto`; non-numeric or unsafe values are omitted while
the required unique ID is retained. The adapter also maps filename, extension,
MIME type, size, image/video hints, URL and completion progress.

`appendFileAnswer` and `removeFileAnswer` return immutable answer arrays.
Appending an already-present `fileUniqueId` replaces that item rather than
creating a duplicate. These helpers produce the canonical value expected by
`serializeQuestionAnswer` and `restoreQuestionAnswer`; the host still needs
to dispatch the returned value through its active answer instance.


## Survey-aware coordination

`SurveyFileUploadCoordinator` connects a compiled question's detached `source`
snapshot to the shared upload runtime. It resolves
`formQuestionFileUploadTokenDtos[index].uniqueId` for each file slot, reads
`fileUploadSettingDto`, validates extension and file-size limits using the
archived `Math.round(bytes / 1024)` rule, and checks `maxFileCount` against
existing answers plus concurrent/succeeded uploads. It intentionally does not
enforce `minFileCount` at selection time; that remains a final-answer
validation rule.

Completed uploads are converted and merged by `fileUniqueId`, so replaying
the synchronization step is idempotent. Failed/cancelled uploads are excluded.
Voice capture can be passed through the same runtime using the survey's
`voiceRecordToken`.

This coordinator is pure TypeScript and has unit coverage. It is not yet
instantiated by the Angular app; the actual tus-js-client dependency,
remote CDN configuration, UI, canonical answer-command dispatch and final
submission integration remain separate host work.


## Submission safety and voice metadata

The coordinator exposes `getSubmissionIssues()` and
`assertReadyForSubmission()`. Submission must be blocked while any selected
file is uploading, retrying, failed or cancelled; the caller must retry or
remove those entries first. A successful file answer alone is not enough to
prove that every selected file has completed.

For voice recording, `getVoiceSubmissionReference()` requires exactly one
successful voice upload and returns the legacy `fileId` /
`fileUniqueId` pair. It rejects missing, multiple or unsafe numeric IDs rather
than building incomplete voter-detail metadata.
