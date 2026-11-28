# File transfer runtime

## Scope

The runtime now contains a transport-independent lifecycle for FileUpload and
VoiceRecord transfers. It is separate from question renderers, answer state,
and the archived Angular component implementation.

## Archived TUS contract preserved

- Endpoint suffix: /FileStorage_CDN.
- File token is sent as the fileToken request header; an absent token remains
  an empty string to match archived client behavior.
- Metadata keys: name, filename, emptyMetaKey, size, formGuid, pollUniqueId,
  idCode, and formUniqueId.
- Chunk size: 2 MiB; retry delays: 1, 3, and 4 seconds.
- One parallel upload and legacy PATCH override behavior.
- The host adapter must search for and resume a previous upload.
- Completion headers: fileid, fileidunique, and optional fileaddressurl.
  Missing fileid or fileidunique is a failed upload.
- Progress, retry, terminal failure, manual retry, cancellation and disposal
  are explicit immutable states. Late callbacks from superseded attempts are ignored.

## Host integration boundary

FileUploadTransport is the adapter port. The archived app uses tus-js-client
and a custom HTTP stack that sets application/octet-stream for TUS PATCH
requests. The rewritten workspace does not yet depend on tus-js-client, and
its endpoint configuration and token provider are not wired to a live host.
A production adapter must also preserve the legacy no-retry statuses:
401, 403, 404, 406, 417, 410, 415 and 510.

This is a tested lifecycle core, not a claim that browser uploads are already
operational. FileUpload remains unregistered until a real host adapter and UI
are connected. VoiceRecord can reuse this transfer contract after its recorder
produces a File; recorder capture and voice-token acquisition remain separate
host responsibilities.
