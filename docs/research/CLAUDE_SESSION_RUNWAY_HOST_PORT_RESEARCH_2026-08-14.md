# Claude session runway host-port research - 2026-08-14

Scope: primary Microsoft, Node.js, and Anthropic documentation plus current
Claude Aura, Gemini Aura, and companion source evidence for a recent-session
runway. The first pass targeted the v1 read-only contract. The accepted Gemini
and companion baseline later advanced to v2; the v2 delta below supersedes the
v1-only recommendations. Source evidence still does not establish installed-
runtime, account, or visual acceptance.

## Decision

| Candidate | Decision | Boundary |
|---|---|---|
| Port the verified Gemini runway contract shape | **GO, with its exact companion-facing v2 contract and stronger Windows transport** | Keep bounded projections, opaque commands, revision checks, local receipts, and separate navigation/request state. Do not copy Gemini's `local-only` security claim from Node source without an explicit Windows pipe DACL. |
| Project recent Claude Chat and Code sessions together | **GO, with a bounded source prefix in each title** | The installed companion's exact v1 schema has no source field. `[Claude Chat]` and `[Claude Code]` preserve a clear distinction without changing its verified UI contract. `active` / `open` / `past` describe Aura's local tab/history state only. |
| Enumerate all account sessions for ordinary consumer accounts | **NO-GO** | Anthropic documents user-driven chat search/export; no supported consumer session-list API was found in current official docs. Enterprise Compliance APIs are a separately authorized integration. |
| Show provider running, completed, or failed state | **GO only for a body-free, correlated request** | A route still proves navigation only. `working` begins when `WebResourceRequested` observes an allow-listed Claude Chat completion request. Wire state `completed` requires a matching `WebResourceResponseReceived` with HTTP 2xx and means only that a successful network response was received; `failed` requires a matching non-2xx response. Neither state proves provider task, session, or user-goal completion. Missing, uncorrelated, or changed evidence fails closed to `unknown`. |

## Official facts

### 1. Same-user, local-only pipe and responsive WinForms

Windows named pipes are securable objects. A null security descriptor is too
broad for this seam: Microsoft's documented default grants read access to
Everyone and anonymous users. The server should supply a protected DACL and
owner for the current SID; a logon SID can further restrict access to the same
Windows logon session. [`PIPE_REJECT_REMOTE_CLIENTS` automatically rejects
remote clients](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createnamedpipea),
while the DACL controls local access. [Microsoft named-pipe security](https://learn.microsoft.com/en-us/windows/win32/ipc/named-pipe-security-and-access-rights)

Microsoft documents `PipeOptions.CurrentUserOnly` as checking the same account
and elevation level on Windows. However, the Windows PowerShell/.NET Framework
runtime used by this host currently exposes only `None`, `Asynchronous`, and
`WriteThrough` in that enum. The port therefore cannot assume
`CurrentUserOnly` is callable here; it should reuse Aura's explicit native
`CreateNamedPipe` path. [Microsoft `PipeOptions`](https://learn.microsoft.com/en-us/dotnet/api/system.io.pipes.pipeoptions?view=netframework-4.8.1)

Pipe connection and I/O must remain asynchronous. Microsoft says cancellation
of `WaitForConnectionAsync` after the call requires an asynchronously created
pipe. WinForms controls must be read or changed on their creating UI thread;
`Control.InvokeAsync` is unavailable on .NET Framework. The repo-compatible
pattern is therefore overlapped pipe I/O whose completed tasks are consumed by
the existing UI timer, or background I/O that posts a small immutable result
through `BeginInvoke`; never wait on incomplete pipe or child-process tasks on
the UI thread. [`WaitForConnectionAsync`](https://learn.microsoft.com/en-us/dotnet/api/system.io.pipes.namedpipeserverstream.waitforconnectionasync?view=netframework-4.8.1),
[WinForms threading rules](https://learn.microsoft.com/en-us/dotnet/desktop/winforms/controls/how-to-make-thread-safe-calls)

### 2. Consoleless child launch

For a fixed native GUI executable, use `ProcessStartInfo` with the validated
absolute path, `UseShellExecute = false`, `CreateNoWindow = true`, no inherited
handles, and no `cmd.exe` or batch intermediary. For a fixed Windows PowerShell
script, add `-NoProfile -NonInteractive -STA -ExecutionPolicy Bypass
-WindowStyle Hidden -File <fixed-path>`. Microsoft documents that
`CreateNoWindow` is ignored when `UseShellExecute` is true, and Windows
PowerShell 5.1 exposes the listed console switches. [`CreateNoWindow`](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.processstartinfo.createnowindow?view=netframework-4.8.1),
[`powershell.exe` parameters](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_powershell_exe?view=powershell-5.1)

If output is redirected, drain stdout and stderr asynchronously; Microsoft
warns that synchronous redirection patterns can deadlock. Do not synchronously
`WaitForExit` from the WinForms timer or an input handler. [Redirected-output
guidance](https://learn.microsoft.com/en-us/dotnet/api/system.diagnostics.processstartinfo.redirectstandardoutput?view=netframework-4.8.1)

### 3. Claude Chat and Claude Code evidence

- **Chat:** ordinary users can ask Claude to search past chats, and can request
  a data export containing chat history. Those are product/user workflows, not
  a documented local list API or a live lifecycle feed. [Chat search](https://support.claude.com/en/articles/11817273-use-claude-s-chat-search-and-memory-to-build-on-previous-context),
  [data export](https://support.claude.com/en/articles/9450526-export-your-claude-data)
- **Enterprise Chat exception:** the Compliance API can list chat metadata,
  including `name`, timestamps, and an `href`, but only for Claude Enterprise
  organizations with a Compliance Access Key and
  `read:compliance_user_data`. This is not a default companion dependency.
  [Compliance Chat API](https://platform.claude.com/docs/en/manage-claude/compliance-content-data)
- **Claude Code local:** CLI sessions are stored per project and resumable by
  ID or name, but the desktop app, web, VS Code, and CLI maintain separate
  histories. Transcript JSONL is explicitly internal and version-unstable;
  Anthropic directs scripts to supported structured interfaces or hooks.
  [Claude Code sessions](https://code.claude.com/docs/en/sessions)
- **Claude Code forward evidence:** `SessionStart` hooks provide `session_id`,
  `transcript_path`, `cwd`, start source, and optional title. `SessionEnd`
  provides an exit reason such as `clear`, `resume`, or `other`; none is a task-
  success field, and an unobserved end cannot be converted into completion.
  [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- **Claude Code web:** Anthropic documents `claude.ai/code/<id>` session URLs.
  The same interface hosts cloud Code sessions and Remote Control sessions, so
  the URL alone does not establish where work runs or its lifecycle.
  [Code on the web](https://code.claude.com/docs/en/claude-code-on-the-web),
  [Remote Control](https://code.claude.com/docs/en/remote-control)
- **Enterprise Code exception:** the beta Compliance API can list local Claude
  Code sessions, but it is Enterprise-only; local records deliberately have no
  `status` or `updated_at`, and Claude Code on the web is not returned by those
  endpoints. [Compliance session API](https://platform.claude.com/docs/en/manage-claude/compliance-sessions)

## Local implementation evidence

The Gemini implementation already has the correct product model. Main wires
the session host to `TabStateIpcHandler` and starts it; the handler derives
`active`, `open`, and `past` strictly from app-owned current tabs plus a bounded
history of previously observed conversation routes. An opaque local ID crosses
the seam, while main alone resolves the stored URL. [Gemini main wiring](../../../gemini-aura/src/main/main.ts#L212),
[local session derivation](../../../gemini-aura/src/main/managers/ipc/TabStateIpcHandler.ts#L216),
[architecture boundary](../../../gemini-aura/docs/ARCHITECTURE.md#L235)

Its current wire contract remains small: at most 12 rows, 32 KiB frames,
strict schemas, revision/sequence checks, bounded Queue/Steer text, and local
receipts. Navigation state (`active | open | past`) is separate from the
latest request state (`unknown | working | completed | failed`). The companion
consumes v2 and presents two cards per expanded page with arrows and wheel
navigation. [Gemini contract](../../../gemini-aura/src/shared/aura/session-dock.ts),
[companion contract](../../../claude-aura-companion/src/aura/gemini-aura-session-dock-v2.mjs),
[companion window](../../../claude-aura-companion/windows/Show-GeminiSessionDock.ps1)

Both apps already validate the fixed native companion path and reject redirected
installations before launch. Gemini then uses Electron's `shell.openPath`; Aura
uses `Start-Process`. Preserve the path/reparse checks, but use the deterministic
consoleless `ProcessStartInfo` pattern above and treat pipe authentication—not
process creation—as readiness. [Gemini native launch](../../../gemini-aura/src/main/aura/auraStudioManager.ts#L398),
[Aura native launch](../../windows/aura-pets.ps1#L146),
[Aura consoleless helper pattern](../../windows/aura-ui.ps1#L894)

The transport needs strengthening during the port. Gemini uses Node
`net.createServer`, a random pipe name/token, and a discovery write with
`mode: 0o600`. Node documents that Windows file modes do not implement the
owner/group/other distinction, so that mode is not a current-user ACL. Its
source does not explicitly apply a pipe DACL or `PIPE_REJECT_REMOTE_CLIENTS`.
Keep the token and strict handshake as defense in depth, but do not cite them as
same-user/local-only enforcement. [Gemini pipe host](../../../gemini-aura/src/main/aura/auraPetTaskDockPipeHost.ts#L368),
[Node file-mode caveat](https://nodejs.org/api/fs.html),
[Node Windows IPC](https://nodejs.org/api/net.html#ipc-support)

Claude Aura already contains the stronger host primitive: a protected current-
SID DACL, non-inheritable overlapped handle, `PIPE_REJECT_REMOTE_CLIENTS`,
post-connect process/session/SID checks, bounded async frames, and timer-driven
completion. [Aura pipe creation](../../windows/aura-draft-handoff.ps1#L390),
[client verification](../../windows/aura-draft-handoff.ps1#L502),
[async state machine](../../windows/aura-draft-handoff.ps1#L904),
[UI-timer integration](../../windows/aura-ui.ps1#L12834)

Aura also already owns the right session source: its DPAPI-current-user web-tab
document stores validated `claude.ai` URLs and titles, and WebView2 source,
history, and title events update that metadata. It currently persists open tabs,
not a closed-tab history. [Aura tab store](../../windows/aura-web-tabs.ps1#L1),
[metadata synchronization](../../windows/aura-web-tabs.ps1#L513),
[navigation events](../../windows/aura-ui.ps1#L13282)

### v2 request observation and prompt actions

`AddWebResourceRequestedFilter` adds a glob-style URI/resource-context filter;
the match covers the normalized URI as a whole, and at least one filter is
required before `WebResourceRequested` is raised. Microsoft also marks the
two-argument overload as deprecated because it does not behave as expected for
iframes. The adapter therefore uses the recommended source-kinds overload. A
`WebResourceRequested` handler may block the request until the
handler returns when it takes no deferral, so Aura's handler must stay bounded
and return immediately after its metadata-only check. [Microsoft
`AddWebResourceRequestedFilter`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.addwebresourcerequestedfilter),
[Microsoft `WebResourceRequested`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.webresourcerequested)

`WebResourceResponseReceived` is raised for a response to any WebView resource
request; it is not narrowed by the request filter. Microsoft explicitly says
the host handler does not block WebView response processing and gives no
guarantee about the order in which WebView processes the response versus when
the host handler runs. It is therefore response evidence, not a response-
processing barrier or a provider-lifecycle signal. The current observer reads
only the documented request URI and method plus the HTTP response status code;
it does not inspect request/response headers, request or response bodies,
cookies, content, or transcript text. [Microsoft
`WebResourceResponseReceived`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.webresourceresponsereceived),
[request URI](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2webresourcerequest.uri),
[request method](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2webresourcerequest.method),
[response status](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2webresourceresponseview.statuscode)

A matching 2xx `WebResourceResponseReceived` confirms only that the matching
request received a successful HTTP response. It does not prove that Claude
finished a task, fulfilled the user's goal, ended a session, or that WebView
finished processing response content. A matching non-2xx response is request-
failure evidence. If no matching response arrives, the route changes, the
observed endpoint changes, or correlation is uncertain, the adapter must
return to `unknown` rather than infer completion or failure.

The Claude Chat completion route is not a supported public consumer API. The
adapter must therefore allow-list the observed same-origin POST shape, expose
no request content, and treat every mismatch as `unknown`. Live installed use
must confirm the matcher before response icons count as provider evidence.

Queue and Steer are explicit user commands, not background task creation.
Queue may retain the prompt only in process memory while an observed request is
working, then place and submit it. Steer places text for user review and never
submits. Neither action creates a Work Hub task or changes a session lifecycle.

## Port recommendation (superseded by the v2 delta above)

1. Reuse `gemini-aura-session-dock-v2` exactly so the installed shared companion
   remains unchanged. Prefix bounded titles with `[Claude Chat]` or
   `[Claude Code]`; never send URLs, transcript paths, filesystem paths, or
   request content. Send prompt text only inside an explicit Queue/Steer command.
2. Build the host from Aura's draft-handoff native pipe primitive. Apply the
   same explicit ACL discipline to the discovery directory/file; a randomized
   name, plaintext token, or `0o600` alone is not the security boundary.
3. Extend Aura's private DPAPI tab model with a bounded history keyed only by a
   normalized, allow-listed Chat or Code route. `active` means selected Aura
   tab, `open` means another live Aura tab, and `past` means previously observed
   by Aura. These labels must remain documented as **local navigation state**.
4. Populate both Chat and Code only from routes Aura itself has observed. Do
   not silently read internal Claude Code transcript files or use Enterprise
   Compliance APIs as a fallback; either would be a separately authorized
   adapter.
5. Resolve every session command inside the host from the opaque ID, revalidate the
   stored `https://claude.ai` route, activate/navigate the intended Aura tab,
   and report `opened` only after local navigation dispatch succeeds. Every
   timeout, stale revision, missing row, launch ambiguity, or disconnect fails
   closed or returns `uncertain`.

## Evidence boundary

This research validates a source-level host architecture. It does not prove the
current dirty source is installed, that a consumer account exposes all prior
sessions, that hooks are configured, that an Enterprise key exists, or that the
current Claude Chat request matcher fired in the installed app. Those remain
separate runtime, account, and human-acceptance gates.
