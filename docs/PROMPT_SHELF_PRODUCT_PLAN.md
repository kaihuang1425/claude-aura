# Prompt Shelf product-fit and queue/steer plan

## Purpose

This is a decision and implementation plan, not an implementation. It defines how to
turn Prompt Shelf from a prominent local draft manager into a lightweight,
contextual aid for the user's actual queue-and-steer workflow without removing the
encrypted library or destabilizing the Claude surface.

## Executive diagnosis

The current blockage is not a missing layout treatment. It is an unresolved product
contract:

1. **The shipped job and the intended job differ.** Prompt Shelf is currently a
   50-item encrypted prompt library with search, CRUD, ordering, a full editor, and
   insert-at-caret behavior. The stated original intent is to help a user queue a
   next thought or steer ongoing work inside the main interface. A library manager
   optimizes retrieval and maintenance; queue/steer optimizes capture, timing, and
   immediate context.
2. **Aura cannot yet distinguish the moments that matter.** Composer discovery
   reports only `new-chat`, `conversation`, or `other`. It does not expose a reviewed
   host-owned state for `idle`, `generating`, `queued`, `editable`, or `send-ready`.
   Consequently, today's insertion can place text only at a verified caret; it
   cannot truthfully promise queueing, steering, or submission.
3. **The entry points overstate the secondary feature.** Prompt Shelf has a separate
   native window, a first-class Studio rail page, a launcher-menu item, and a global
   shortcut. The two management surfaces duplicate mental models while neither is
   located at the point where the next thought occurs.
4. **There is no evidence loop for deciding what to tailor.** The repository has
   rigorous safety and protocol tests, but no product instrumentation, usability
   task definition, or acceptance metric that distinguishes “saved a reusable
   prompt” from “captured the next instruction without interrupting thought.”
5. **The safest technical behavior is also the main functional limit.** Aura
   deliberately requires a focused Claude composer/caret, never presses Enter, and
   treats ambiguous DOM mutation as uncertain. Those are correct trust boundaries,
   but they mean “Insert” is not a queue/steer primitive.

**Decision:** do not redesign the full manager first, and do not relabel insertion
as queue or steer. First validate the contextual job and establish a truthful host
state contract. Then add one small in-Aura staging surface, keeping Studio as the
low-frequency library manager and preserving all encrypted drafts.

## Critical review of this direction

The recommendation above is intentionally conservative, but it can still fail if it
is treated as a feature specification rather than a sequence of falsifiable steps.
The following criticisms must be resolved during the spike:

1. **“Quick Draft” may merely be a smaller version of the same wrong idea.** Moving
   an editor next to the composer reduces travel but does not prove that users need a
   second drafting surface. The cheapest successful solution may be only a shortcut
   that focuses Claude's composer plus a compact saved-prompt picker.
2. **A composer-adjacent tray risks competing with Claude's composer.** Even a quiet
   tray can look like a second send box, split focus, cover changing host controls,
   or imply that Aura owns the conversation. The prototype must beat an even smaller
   command-palette alternative before the tray is accepted.
3. **DOM state is not a durable product API.** Roles and attributes are safer than
   visible copy, but they can still change without notice. Detection confidence must
   be explicit, versioned, fail-closed, and independently disableable.
4. **“Recent prompts” requires recency data that does not exist.** Adding last-used
   timestamps would change the encrypted schema and leak a behavioral history on
   disk. Phase 1 must therefore preserve manual order and show the first three saved
   items, or keep suggestions hidden; recency is a separate, consented migration.
5. **Local diagnostics can become permanent product complexity.** Diagnostics are a
   research instrument, not a prerequisite runtime subsystem. Start with moderated
   observation and test builds. Add durable opt-in counters only if the interviews
   cannot answer the decision.
6. **A 5-of-8 threshold is directional, not statistical proof.** It prevents design
   by anecdote but does not justify broad rollout. Pair it with task completion,
   comprehension, failure frequency, and a reversible preview.
7. **Preserving every entry point forever would preserve the noise.** Compatibility
   is time-bounded: keep all functions, relocate low-frequency management, publish
   the new route, and review actual use after one release.

These criticisms change the order of work: prototype the smallest three alternatives
first, validate capability separately from desirability, and prefer the alternative
that removes the most interface rather than the one with the most functionality.

## Alternatives to test before selecting a tray

Use the same five moderated tasks to compare three throwaway prototypes. None should
touch production persistence or queue/steer behavior.

| Alternative | Interaction | Strength | Primary risk | Selection rule |
| --- | --- | --- | --- | --- |
| **A. Focus + picker** | Shortcut focuses Claude's composer; a small picker appears only when the user asks for saved prompts | Least visual and technical disruption | Does not capture text while the composer is unavailable | Choose when it completes at least 80% of tasks and is not slower than the others by more than 1 second median |
| **B. Command palette** | Shortcut opens one searchable field with `Draft next`, saved prompts, and full-library commands | Clear single entry and no persistent chrome | Modal context switch and weak spatial relationship to the composer | Choose when users need both capture and retrieval but confuse a tray with Claude's composer |
| **C. Quick Draft tray** | One transient row near the verified composer | Best contextual continuity and can hold a thought independently | DOM coupling, focus competition, responsive overlap | Choose only when it materially improves capture-during-generation and passes the comprehension test |

Reject all three if users primarily organize reusable prompts. In that result, keep
Studio as the manager, make the shortcut open Studio's library page, and remove the
duplicate native window from primary navigation after the compatibility period.

## What exists today

| Area | Current contract | Product consequence |
| --- | --- | --- |
| Persistence | Up to 50 drafts, 8,000 characters each, DPAPI CurrentUser encryption, strict ACL and migration checks | Strong foundation for private reusable content; more machinery than transient queue capture needs |
| Native Prompt Shelf | Separate 500 × 590 resizable WinForms window with editor, saved list, reorder, delete, and insert actions | Visually and cognitively interrupts the main conversation |
| Studio Prompt Shelf | First-class two-pane page with search, list, editor, CRUD, ordering, insertion, conflict recovery, and localization | Polished management experience, but duplicates the native window and moves the user away from conversation context |
| Insertion | Executes a bounded script against a discovered, focused composer and inserts at the current selection; never sends | Safe “place text” capability, not a queue or steer capability |
| Consistency | Revision, command epoch, request fingerprint, bounded receipt cache, and uncertain-result recovery | Appropriate for shared state; should be retained behind any smaller UI |
| Entry points | Launcher menu, `Ctrl+Shift+P`, native window, and Studio rail | High feature visibility relative to an unvalidated job |
| Tests | Deep protocol, persistence, locale, responsive, keyboard, and failure-state coverage | Protects implementation correctness, but not usefulness or workflow fit |

## Product hypothesis to validate

### Primary user job

> While Claude is working or while I am reading its answer, let me capture the next
> instruction in the conversation context and make it ready for my explicit review
> and send, without opening a separate workspace or losing my place.

### Secondary user job

> Let me recall a small set of reusable instructions when they are relevant, without
> turning the conversation surface into a prompt-management application.

### Non-goals

- Automatically send, submit, or simulate Enter.
- Claim native queue or steer semantics unless the currently loaded Claude surface
  exposes and Aura verifies those semantics.
- Add an always-visible sidebar, floating card stack, or second composer.
- Replace Claude's controls or obscure its trust, permission, stop, or retry UI.
- Remove encrypted drafts, import/handoff behavior, localization, keyboard access,
  recovery states, or Studio management.
- Store conversation content, prompt bodies, or usage analytics remotely.

## Research plan: resolve the blockage before UI implementation

### 1. Workflow interviews and task observation

Recruit 6–8 current Aura users across casual and advanced use. Observe, rather than
only ask about, these tasks in a normal Aura window:

1. Capture a follow-up while Claude is generating.
2. Correct direction when an answer is drifting.
3. Reuse a recurring instruction in a new chat.
4. Recover a thought after navigating or after generation ends.
5. Find and maintain an older saved prompt.

For each task record locally in research notes: trigger moment, whether text is
ephemeral or reusable, desired destination, time-to-first-keystroke, number of
surface changes, whether the user expects automatic sending, and the recovery they
expect after navigation. Do not collect prompt bodies.

Ask one forced-ranking question after observation: **capture next thought**, **steer
current response**, **reuse saved instruction**, or **organize a library**. The rank,
not feature enthusiasm, determines the default surface.

### 2. In-product, privacy-preserving evidence

Before any new surface, add an opt-in diagnostics design for a later implementation.
It may count only action categories and durations locally:

- entry point used: shortcut, launcher, Studio rail, native window;
- action category: transient capture, saved-draft insert, save, edit, reorder, delete;
- context category: new chat, conversation idle, conversation generating, unknown;
- outcome category: inserted, not inserted, uncertain, abandoned;
- elapsed bucket from open to insert/cancel.

No prompt text, draft ID, URL, conversation ID, title, or DOM content may enter an
event. Show the summary to the user and provide **Copy diagnostics** and **Erase**;
do not transmit automatically. This evidence answers whether library management is
actually the main use without creating a surveillance feature.

### 3. Host capability spike

Create a disposable, test-only probe behind a development flag. For each supported
Claude state, record only booleans and element roles:

- composer discovered and focused;
- composer editable/read-only;
- response generation indicator present;
- stop control present;
- host queue affordance present;
- host send affordance enabled;
- route epoch stable;
- selection/caret valid.

Test new chat, idle conversation, active generation, stopped generation, error,
retry, project/chat navigation, narrow window, and sign-in. The probe must reuse the
bounded `discoverComposer` boundary and must not infer state from translated visible
copy. Prefer stable roles, enabled state, and host-owned attributes. If no robust
generation/queue signal survives these cases, the product ships as **Draft next**
only; “Queue” and “Steer” remain prohibited labels.

### Decision gate A: select the job

Proceed to contextual UI only when at least 5 of 8 observed users naturally need
capture/steer during conversation and the median workflow uses fewer surface changes
with the prototype. Otherwise keep Prompt Shelf as a library and reduce entry-point
prominence only.

### Decision gate B: select truthful capability language

| Verified host capability | Allowed primary label | Behavior |
| --- | --- | --- |
| Focused editable composer only | **Draft next** / **Place in composer** | Stage text, then place it at the caret for explicit review |
| Stable active-generation state, but no verified host queue affordance | **Draft a follow-up** | Keep staged text locally until generation ends or the user explicitly places it |
| Stable, directly exercised host queue affordance | **Queue for review** | Invoke only the reviewed host affordance; still never auto-send outside that native contract |
| Stable host steering affordance with observable acknowledgement | **Steer response** | Offer only during verified generation and report the host acknowledgement |

The fallback is always the first row. Product copy must describe what Aura can
prove, not what the feature hopes to become.

## Target experience

### Information architecture

1. **Conversation surface: Quick Draft (primary, frequent).** A compact transient
   tray invoked by `Ctrl+Shift+P` or the existing Aura menu. It belongs near, but
   never over, the composer.
2. **Studio: Prompt Library (secondary, infrequent).** Retain encrypted search, CRUD,
   ordering, and recovery in Studio. Rename only after localization research.
3. **Native Prompt Shelf window: compatibility path.** Keep it during one release,
   reachable from an overflow action such as **Open full library**. Do not open it by
   default. Remove it only in a separately approved migration after evidence shows
   no exclusive use.

### Quick Draft visual specification

- Closed state adds no persistent panel. The existing Aura launcher may show one
  quiet dot only when a transient draft exists; no badge count.
- Opening shows a single composer-width row anchored 8–12 px above the detected
  composer, inset to its content width, with a maximum height of 168 px.
- Contents: one plain-text field, a context-aware primary action, a low-emphasis
  **Save to library** action, and a close button. Put state/recovery copy on one
  reserved line to prevent layout jump.
- No search, saved-list grid, reorder, delete, character counter, title, marketing
  lede, or decorative card chrome in the default tray. Show the character count only
  after 7,200 characters or on validation error.
- Reusable prompts appear only after an explicit **Saved prompts** disclosure. Show
  at most three recently used items plus **Open full library**; do not add a second
  scrolling region beside Claude.
- Use existing Studio surface, border, text, muted, accent, focus, high-contrast, and
  forced-colors tokens. One elevation layer, 1 px border, 10–12 px radius, no strong
  shadow, no new brand illustration.
- At widths below 640 px, use a bottom sheet constrained above the composer and stack
  the actions. At heights below 620 px, cap the text field at 96 px. The tray must
  never cover Claude's send/stop controls.
- Escape closes only after preserving a non-empty transient draft. A second Escape
  returns focus to the prior Claude element. Tab order is field, primary action,
  save, saved-prompts disclosure, close.

### State model

Use a host-owned state machine rather than scattered button flags:

`closed → editing → ready → placing → placed`

Exceptional transitions:

- any open state + route change → `held-for-review`;
- `placing` + timeout/ambiguous mutation → `uncertain`;
- storage failure affects only **Save to library**, never transient capture;
- composer unavailable → remain `ready` with **Copy text** and **Try again**;
- generation begins/ends → recompute the truthful primary action without changing
  the draft;
- successful place → retain text until verified acknowledgement, then clear only
  after offering a short **Undo clear** window in Aura-owned memory.

Transient text lives in host process memory, not browser storage. It survives tray
close and Studio open during the Aura process lifetime, but does not survive app exit
unless the user explicitly saves it to the encrypted library.

## Technical operating model

### Ownership boundaries

Smooth operation depends on one owner for each kind of state:

| State | Authoritative owner | Replica | Persistence |
| --- | --- | --- | --- |
| Saved prompt bodies and manual order | Windows host | Studio snapshot and optional picker snapshot | Existing DPAPI `drafts.bin`; schema unchanged |
| Transient draft body | Windows host process | Active injected field while open | Memory only; never WebView storage |
| Field selection/caret | Active WebView document | None | Never persisted or bridged |
| Host capability snapshot | Active WebView document, observed by bounded probe | Host immutable snapshot | Memory only, invalidated on route/document epoch |
| UI visibility and focus return | Windows host | Injected root reflects command | Memory only |
| Mutation authority | Windows host session + command epoch | Studio/tray sends correlated request | Bounded body-free receipts only |
| Theme and accessibility presentation | Existing Aura renderer tokens | Quick surface consumes tokens | Existing configuration only |

The browser never becomes a second database. The host never attempts to restore a
Claude caret. A snapshot is useful only for its exact document and route epoch.

### Capability contract

Add a versioned `composerCapability` result with exact keys and bounded values:

```text
version              integer, initially 1
documentEpoch        non-negative integer
routeKeyDigest       fixed-length digest; never the URL
context              new-chat | conversation | other
composer             absent | readonly | editable
focus                outside | inside
selection            absent | caret | range
generation           idle | active | unknown
nativeQueue          present | absent | unknown
nativeSteer          present | absent | unknown
confidence           verified | insufficient
```

`verified` means every signal required for the offered action passed. It does not
mean the whole page is understood. Unknown or contradictory signals always produce
`insufficient`; they must never be converted to `false` merely to enable a fallback.
The route is represented only by a digest for correlation, while the existing host
route key remains private to the operation that already validates navigation.

Capability snapshots expire on `NavigationStarting`, top-level document replacement,
route-key change, composer disconnect, generation-control mutation, or after 2
seconds without revalidation while the quick surface is open. Expiry disables the
primary action but never clears text. Revalidation is event-driven and coalesced;
there is no permanent high-frequency DOM poll.

### Transient draft contract

Use one immutable host record replaced atomically on accepted updates:

```text
draftId              random 128-bit process-lifetime correlation ID
revision             monotonic non-negative integer
text                 validated UTF-16 string, 0..8,000 characters
state                closed | editing | ready | placing | placed |
                     held-for-review | uncertain
source               shortcut | launcher | handoff | library
documentEpoch        epoch last reviewed against, or null
capabilityVersion    version last reviewed against, or null
operationId          active operation correlation, or null
```

Do not put timestamps, conversation identifiers, route text, saved-item IDs, or
capability DOM details in this record. `draftId` is not a persisted prompt ID. Saving
uses the existing host-minted saved ID and does not change the transient identity
until the save receipt succeeds.

### Message flow and sequencing

Every path follows prepare → validate → dispatch → acknowledge → reconcile:

1. **Open:** host creates or reuses the transient record, requests a capability
   snapshot for the current document epoch, then asks the renderer to reveal the
   surface. It never focuses until the renderer acknowledges that the root is
   connected and unobstructed.
2. **Edit:** renderer sends a debounced replacement with draft ID and revision. The
   host validates exact shape and text, advances one revision, and acknowledges the
   accepted revision. Keep a final synchronous flush on blur/close. At most one edit
   is in flight; later input coalesces to the newest full value.
3. **Place:** renderer first flushes edits. Host requires matching draft revision,
   document epoch, route correlation, verified capability, and a valid selection.
   It then reuses the existing one-shot insertion operation. No implicit retry.
4. **Acknowledge:** only an exact correlated result may move `placing` to `placed`.
   A timeout, navigation, disconnected composer, or contradictory result moves it to
   `uncertain` and retains the text.
5. **Reconcile:** after `placed`, request a fresh composer snapshot. Clear the
   transient record only if the operation acknowledged success and the user accepts
   clear/close; otherwise retain it. The proposed Undo is an in-memory restoration of
   Aura's draft, not an attempt to undo Claude's editor mutation.
6. **Save:** snapshot the accepted transient revision, call the existing persistence
   transaction, verify the encrypted replacement exactly as today, then acknowledge
   the new saved ID. On failure, leave the transient record and library unchanged.

### Backpressure, timing, and UI-thread safety

- Debounce text replacement at 100 ms, but cap acknowledgement wait at 500 ms before
  showing a quiet **Saving draft state…** status. These values are starting points to
  measure, not hard-coded product truths.
- Allow one body-bearing edit and one action operation in flight per session. A place
  or save command drains the latest coalesced edit first.
- Bound control messages to 8 KB and body-bearing messages to the existing 8,000
  character limit plus JSON overhead. Reject rather than truncate.
- Marshal WebView completions and WinForms mutations onto the existing UI thread.
  Timers may schedule checks but may not mutate controls after disposal.
- Give every timer an owning session and operation ID. Disposal, navigation, Studio
  session rotation, or feature-flag disable stops it and makes late callbacks no-ops.
- Never hold the UI thread while waiting on `ExecuteScriptAsync`, encryption, or a
  WebView acknowledgement. Disable only the affected action, not the editor.
- Keep receipt caches and capability history bounded. Logs contain event codes,
  versions, and outcome classes only—never bodies, IDs shared with saved prompts,
  routes, DOM copy, or selection content.

### Geometry and focus stability

The composer rectangle is evidence, not a permanent anchor. Before every reveal and
after resize, zoom, DPI, navigation, or composer mutation:

1. measure the composer and its interactive controls in CSS pixels;
2. compute a candidate above it with an 8 px safety gap;
3. intersect the candidate with the visual viewport and Aura safe bounds;
4. reject the candidate if it overlaps send, stop, attachment, permission, toast, or
   dialog rectangles;
5. choose bottom-sheet mode when the candidate cannot meet minimum dimensions; and
6. close visually—but retain the transient draft—when neither placement is safe.

Use `ResizeObserver` on the verified composer/root and one coalesced animation-frame
layout pass. Use `MutationObserver` only on the smallest reviewed ancestor needed to
detect composer replacement. Disconnect both when closed. Do not alter Claude's
layout, margins, z-index, or focus styles.

On open, remember the prior focused element only if it is connected and inside the
same document epoch. On close, restore it only if it is still connected, visible,
enabled, and outside an open modal. Otherwise focus the verified Claude composer;
if that is unsafe, leave focus unchanged. Never synthesize a click to restore focus.

### Feature flag, kill switch, and recovery

Use two independent local controls:

- `quickDraft.enabled` governs the new entry-point routing and surface; and
- `quickDraft.hostAdapterVersion` allows a known-bad capability adapter version to
  be disabled without disabling the saved library or existing safe insertion.

The default before preview is disabled. A flag change tears down observers, rejects
new quick-surface requests, retains any non-empty transient text in host memory, and
leaves Studio/native management available. Because remote disable infrastructure
does not currently exist, do not imply an instant remote kill switch; ship an
adapter-version denylist with updates and retain the local configuration escape hatch.

### Compatibility and migration

- `drafts.bin` stays byte-for-byte schema compatible through Phases 0–2.
- Existing Studio message types, deep links, and native window commands remain valid.
- New message types use a new explicit protocol version or exact additive allowlist;
  old clients receive `unsupported`, never guessed conversion.
- Shortcut rerouting is the only changed default in Phase 1 and is guarded by the
  feature flag. When disabled, it returns to the current native window behavior.
- No migration is required to roll back Quick Draft. Remove the injected root,
  disable routing, discard process-memory transient state on normal exit, and retain
  the encrypted library untouched.

## Methods already proven in this repository—and how to reuse them

The safest plan is not to invent a parallel interaction protocol. Reuse mechanisms
already exercised by the current Prompt Shelf tests:

| Proven method | Current evidence | Required reuse |
| --- | --- | --- |
| Exact message shapes and source URI checks | Studio bridge rejects expanded, partial, wrong-source, and body-bearing snapshots | Apply to every capability, edit, visibility, save, and place message |
| Session + revision + command epoch | CRUD tests reject stale mutations and session changes | Bind every transient mutation and action to all three |
| Cryptographic request IDs and request fingerprints | Replays are idempotent; changed payload under one ID conflicts | Reuse for save/place actions; edit coalescing still uses ordered revisions |
| Bounded body-free receipt FIFO | Current cache retains 64 receipts without retaining prompt text | Keep action receipts body-free and bounded; do not cache edit bodies |
| Route/page epoch correlation | Existing insertion rejects navigation-changed targets | Require it for capability validity, geometry, and placement |
| No automatic retry + uncertain terminal state | Timeouts lock insertion until explicit review | Preserve for every action that may have mutated the composer |
| Host-minted saved IDs | Studio cannot choose persistence identity | Saving Quick Draft must call the same host transaction |
| Atomic encrypted replacement and verification | Persistence tests cover Unicode, tamper rejection, and rollback | Do not create a second transient persistence format |
| DPAPI CurrentUser + fixed-path ACL checks | Existing storage is user-bound and rejects redirected paths | Keep library storage unchanged; transient content remains memory-only |
| Body-free operational logging | Tests forbid prompt logging and clipboard fallbacks | Add event classes only; extend canary tests to Quick Draft |
| Localized accessibility and responsive contracts | Current tests cover locales, tab stops, minimum sizes, forced colors | Extend the matrix rather than create a lower standard for the quick surface |

Methods that are **not** proven and therefore require spikes are active-generation
detection, native queue/steer invocation, an interactive injected Aura root, safe
composer-adjacent geometry, edit coalescing across the WebView bridge, and focus
restoration across host navigation. These must not inherit confidence merely because
the saved library is well tested.

## Specific implementation sequence

### Phase 0 — evidence and contract (no user-facing change)

1. Add a written capability matrix to `docs/IMPLEMENTATION_REPORT.md` after the host
   spike, including selectors/roles used, failure modes, and screenshots for every
   state and supported viewport.
2. Extend `discoverComposer` in `assets/renderer-inject.js` only with reviewed,
   body-free booleans. Preserve its existing context values and add a versioned
   capability object rather than changing current consumers.
3. Add fixture-based tests in `tests/prompt-shelf.test.mjs` for every state listed in
   the spike. Include translated UI text canaries to prove detection does not depend
   on English strings.
4. Decide the allowed label at Decision gate B. Stop if the signal is not stable.

**Exit criteria:** 100% correct classification across the reviewed fixture matrix,
no prompt/conversation body crosses the bridge, and a documented fallback for every
unknown state.

### Phase 1 — Quick Draft behind a local feature flag

1. In `windows/aura-prompt-shelf.ps1`, introduce one host-owned transient draft
   object containing only text, lifecycle state, route epoch, last verified
   capability snapshot, and operation correlation. Keep persisted items and their
   schema unchanged.
2. In `windows/aura-ui.ps1`, add versioned, exact-shape messages for capability read,
   transient update, place, save-to-library, cancel, and acknowledgement. Reuse
   request UUID, session, revision/epoch, receipt, source-URI, and uncertainty
   patterns already protecting Studio.
3. Render the tray through the existing controlled renderer injection path rather
   than a new native top-level window. Use a shadow-root or equally scoped Aura root,
   fixed class allowlist, and existing theme variables. Do not attach listeners to
   arbitrary Claude nodes beyond the reviewed composer/route lifecycle.
4. Rebind `Ctrl+Shift+P` and the launcher's primary Prompt Shelf action to toggle
   Quick Draft. Keep **Open full library** as a secondary launcher action and keep the
   Studio rail destination intact.
5. Add new copy first in English with translator context explaining the proven
   capability. Export all 16 locales through the existing locale workflow; do not
   machine-fill shipping strings without review.

**Exit criteria:** closed state has zero persistent layout footprint; open state does
not overlap host controls at standard, minimum, zoomed, RTL-like stress, high
contrast, or forced-colors layouts; no automatic send path exists.

### Phase 2 — simplify, do not delete

1. Make Studio the canonical full manager. Preserve search, create/update, reorder,
   delete confirmation, conflict handling, insertion recovery, and encrypted storage.
2. Change the native window's default entry to an overflow compatibility action.
   Avoid restyling it in this phase; investing further in duplicate chrome would add
   noise without validating value.
3. In Studio, reduce the page header and insertion emphasis: call it a saved prompt
   library, keep management primary, and make **Place in composer** contextual and
   secondary. This prevents the manager from pretending to be the queue experience.
4. Preserve deep links and existing `#prompt-shelf` navigation for compatibility,
   even if visible copy changes.

**Exit criteria:** every current saved draft remains readable/editable; no migration
of `drafts.bin`; shortcut/menu discoverability is documented; all prior CRUD,
locale, keyboard, security, and recovery tests still pass.

### Phase 3 — queue/steer adapter only if proven

1. Define a narrow adapter with `inspect()`, `placeDraft()`, and—only when verified—
   `queueDraft()` or `steerWithDraft()`. The UI consumes capability flags and never
   calls DOM implementation details directly.
2. Correlate each action with route epoch, expected target, capability version, and
   acknowledgement. Navigation, generation-state change, or missing acknowledgement
   moves the action to `uncertain`; never retry automatically.
3. Keep text reviewable before invocation and retain **Copy text** as universal
   recovery. Never silently fall back from queue/steer to a different action.
4. Add a remote-surface compatibility kill switch in local config so a Claude DOM
   change can disable only the adapter while leaving Quick Draft and the library
   usable.

**Exit criteria:** action semantics are directly observable in a real Aura window,
unknown states disable rather than guess, and a host markup change cannot cause an
automatic send or duplicated insertion.

## Test and acceptance plan

### Automated gates

- Exact bridge shapes reject missing, expanded, replayed, stale, body-bearing, and
  cross-session messages.
- Route and generation changes during placement produce deterministic
  `held-for-review` or `uncertain` states.
- Empty, whitespace, control-character, Unicode, and 8,000-character boundaries
  match existing shelf validation.
- Saving a transient draft creates exactly one host-minted ID and one persistence
  revision; failure leaves the transient text untouched.
- Library mutations from Studio update Quick Draft suggestions without exposing
  bodies in receipts or logs.
- The injected root has no effect when closed, is idempotent across reinjection, and
  is removed on unsupported/sign-in pages.
- Keyboard, screen-reader live region, reduced motion, high contrast, forced colors,
  200% zoom, and minimum viewport assertions cover every state.
- Existing DPAPI, ACL, migration, CRUD, localization, draft handoff, and insertion
  uncertainty suites remain unchanged or stricter.

### Verification methods for smooth operation

Use layered verification so source-shape tests do not masquerade as runtime proof:

1. **Pure state-model tests.** Extract transition decisions into a side-effect-free
   model exercised with table-driven tests. Enumerate every legal transition and
   assert that every other transition fails closed without changing text or revision.
2. **Contract tests.** Feed exact, missing, extra, wrong-case, over-limit, stale,
   replayed, cross-session, and body-canary messages through the real PowerShell and
   JavaScript parsers. Assert both response and absence of side effects.
3. **Renderer fixture tests.** Use captured, redacted DOM fixtures for every host
   state and viewport. Randomize visible language strings and irrelevant class names
   to prove capability detection uses only reviewed structural signals.
4. **Property/fuzz tests.** Generate Unicode text, revisions near numeric boundaries,
   reordered callbacks, repeated lifecycle events, and malformed result objects.
   Invariants: text is never silently truncated, one operation has at most one
   terminal receipt, and an unverified state never enables queue/steer.
5. **Fault injection.** Interrupt before dispatch, after DOM mutation but before
   acknowledgement, during navigation, during Studio session rotation, on timer
   expiry, after feature disable, and during persistence replacement. Verify the
   documented `ready`, `held-for-review`, or `uncertain` outcome and retained text.
6. **Deterministic fake-clock tests.** Advance debounce, acknowledgement, delayed,
   uncertainty, and teardown timers in every order. Late callbacks from a disposed
   document/session must be observable no-ops.
7. **Real WebView2 integration harness.** Serve controlled composer fixtures from the
   approved Studio/test origin, drive focus and selection through WebView2, and verify
   actual `InputEvent`, selection, resize, zoom, navigation, and accessibility
   behavior. This is required because regex/source inspection cannot prove event or
   focus behavior.
8. **Actual-window exploratory matrix.** On supported Windows versions and WebView2
   channels, exercise mouse, keyboard-only, touchpad, 100/150/200% DPI, 80–200% zoom,
   minimum through maximized sizes, light/dark/high contrast, all locales, sign-in,
   new chat, conversation, generation, stop, error, and navigation.
9. **Soak and churn.** Run 500 open/edit/close cycles, 200 route changes, 100 Studio
   session rotations, and a 60-minute generating/idle simulation. After teardown,
   observer count, timers, event handlers, injected roots, and receipt cache must
   return to their bounded baseline.
10. **Performance budgets.** With the surface closed: zero observers and zero polling.
    With it open: at most one layout pass per animation frame, no long task over 50
    ms attributable to Aura, p95 open-to-focus below 150 ms on the reference device,
    and p95 keystroke-to-local-paint below 16 ms. Treat these as release gates after
    measuring a baseline, not as claims from unit tests.
11. **Security/privacy review.** Search built assets, logs, exception paths, receipts,
    diagnostics, crash remnants, and test artifacts with a unique prompt canary.
    Only the encrypted store and deliberately active in-memory draft may contain it.
12. **Rollback rehearsal.** Populate the existing library, enable and use Quick
    Draft, disable the flag mid-edit and mid-operation, restart, and install a build
    without Quick Draft. The library must remain exact and usable throughout.

Each layer has a distinct evidence label in the implementation report: `MODEL`,
`CONTRACT`, `FIXTURE`, `WEBVIEW`, or `HUMAN`. A fixture pass cannot close a WebView or
human checkpoint, and an offline screenshot cannot close actual-window acceptance.

### Operational invariants

Release is blocked if any invariant cannot be demonstrated:

- **No loss:** non-empty transient text is retained across close, navigation, failed
  save, failed place, capability expiry, and feature disable for the process lifetime.
- **No surprise send:** no code path clicks send, presses Enter, submits a form, or
  silently changes a place action into queue/steer.
- **At-most-once mutation:** an accepted operation ID can produce no more than one
  composer mutation attempt; retries require a new explicit user action.
- **Fail closed:** unknown capability, geometry, focus, route, revision, or result
  disables the action while leaving edit/copy recovery available.
- **Bounded work:** observers, timers, receipts, messages, text, and retries all have
  explicit bounds and teardown ownership.
- **One library:** all saved-prompt mutations go through the existing encrypted host
  store and shared revision; WebView storage remains unused.
- **No idle footprint:** when closed, the feature has no injected root, observer,
  polling loop, reserved space, or focus handler in the Claude document.
- **Accessible recovery:** every disabled or uncertain action has perceivable status
  and a keyboard-operable recovery that does not depend on color or hover.

### Exit evidence required per phase

| Phase | Required evidence | Explicitly insufficient |
| --- | --- | --- |
| 0 | Redacted capability matrix, fixture tests, actual-window observation, false-positive/negative log | A selector list or one English screenshot |
| 1 internal | Model/contract/fault tests, WebView harness, actual-window matrix, privacy canary, rollback rehearsal | Unit tests alone |
| 1 preview | Moderated task results, comprehension score, two churn cycles without lost text or overlap | Positive subjective feedback |
| 2 relocation | Existing-feature parity checklist, deep-link/shortcut migration test, locale and accessibility approval | Removal justified only by low visibility |
| 3 queue/steer | Direct host acknowledgement proof, at-most-once fault matrix, adapter kill-switch rehearsal | Inference from button presence or DOM mutation alone |

### Human checkpoints

1. **Workflow:** 5 users complete capture-during-generation without leaving the
   conversation; median time-to-first-keystroke is under 2 seconds.
2. **Comprehension:** 90% correctly predict whether the primary action sends, queues,
   or only places text before using it.
3. **Visual:** at 1080 × 720, 1280 × 720, minimum supported size, and 200% zoom, the
   tray neither covers the composer controls nor causes Claude content reflow.
4. **Recovery:** users can recover text after route change, unavailable composer,
   ambiguous insertion, and local storage failure without reopening a manager.
5. **Noise:** with no transient draft, users who are not looking for the feature see
   no new persistent panel and no more than the existing launcher affordance.

## Rollout and measurement

1. Ship behind a local `quickDraft` feature flag to internal testers.
2. Run the observation protocol; review only aggregate action categories and local
   diagnostics volunteered by participants.
3. Graduate to opt-in preview when no severity-1 trust issue, no lost-draft issue,
   and no composer-control overlap is found across two test cycles.
4. Make Quick Draft the shortcut default only after the comprehension and workflow
   checkpoints pass. Preserve **Open full library** in the launcher for at least one
   full release.
5. Consider retiring the native manager only when fewer than 10% of volunteered
   Prompt Shelf opens use it for a task unavailable in Studio, and after an explicit
   release-note and accessibility review.

## File-level change map

| File | Planned responsibility |
| --- | --- |
| `assets/renderer-inject.js` | Versioned, body-free composer/generation capability discovery and injected-root lifecycle |
| `windows/aura-prompt-shelf.ps1` | Transient state machine, correlation, persistence handoff, truthful action adapter, uncertainty recovery |
| `windows/aura-ui.ps1` | Exact bridge allowlist/parser, shortcut and launcher routing, route/capability lifecycle |
| `studio/index.html` | Later simplification of the manager hierarchy; preserve IDs and deep link |
| `studio/app.js` | Library/Quick Draft synchronization and revised contextual action state |
| `studio/styles.css` | Token-aligned manager simplification and responsive checks, not tray styling leakage |
| `windows/locales/*.json` and Studio locale source | Capability-accurate copy and translator context for all supported locales |
| `tests/prompt-shelf.test.mjs` | Capability fixtures, transient lifecycle, bridge, accessibility, responsive, and compatibility contracts |
| `tests/draft-handoff.test.mjs` | Proof that external handoff still requires explicit review and never auto-sends |
| `docs/SCREENSHOT_PLAN.md` | Real-window state/viewport capture matrix |
| `docs/IMPLEMENTATION_REPORT.md` | Capability evidence, decision-gate result, human checkpoints, and rollout status |

## Recommended first milestone

Do **not** start with CSS or delete either existing surface. The highest-leverage
milestone is a two-part spike:

1. observe users performing the five workflow tasks; and
2. prove whether Aura can reliably classify active generation and any native
   queue/steer affordance without reading localized copy or conversation content.

At the end of that milestone, choose exactly one promise—**Draft next**, **Draft a
follow-up**, **Queue for review**, or **Steer response**—using the decision table.
That resolves the present blockage and prevents another polished but extraneous
feature from being built.
