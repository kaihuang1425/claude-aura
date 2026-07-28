# Customizable prompt widget blockage: investigation and delivery plan

## Scope and terminology

This plan treats **customizable prompt widget** as Studio's **New chat area**:
the live Claude composer group whose width and position can be edited in the
Interface branch. It is not Prompt Shelf, which is a separate draft-management
feature. No runtime or UI behavior is changed by this document.

## Current finding

The editor controls and persistence path are present, and the automated suite
passes. The blockage is therefore not a missing slider, save handler, or theme
schema field. It is most likely a runtime eligibility failure between Claude's
current DOM/layout and Aura's deliberately conservative prompt discovery and
placement guards.

Aura only customizes the prompt after all of these conditions hold:

1. exactly one visible editor is found in one unambiguous main region;
2. a bounded composer shell and a movable parent group are inferred;
3. that group is classified as New chat from its distance above the main
   region's bottom edge;
4. the visible main region is at least 480 by 400 CSS pixels; and
5. Claude does not already report a non-zero computed `translate` on the group.

Any failure silently returns to the native layout. The translation guard is a
credible suspect because modern layout primitives can give the group a computed
translation even when Aura could safely compose its own offset. The fixed 480
by 400 gate could similarly disrupt extension/new-tab sizes. DOM drift can make
the inferred group or New chat heuristic fail before either placement guard
runs. These are ranked hypotheses, not proven root causes; changing a guard
before observing its live reason code would be guesswork.

Studio can conceal this distinction. Its canvas may fall back to a schematic
prompt rectangle when the mirror has no usable prompt geometry, while the live
renderer has already failed open. A user can consequently manipulate and save
a convincing preview that the live page does not apply. Existing tests validate
the intended synthetic DOM and explicitly validate the translation fail-open;
they do not reproduce the current live Claude structure or explain which guard
declined placement.

## Evidence, confidence, and criticism of the first proposal

### Proven from the repository

- Width, X, and Y controls exist and commit the complete prompt tuple.
- The renderer deliberately declines authored placement below 480 by 400 CSS
  pixels or when the target has a non-zero computed `translate`.
- The renderer clears authored prompt state outside New chat and on cleanup.
- Synthetic regression coverage proves the expected DOM, native/authored
  transition, translation fail-open, clamping, and conversation cleanup.
- The complete repository test suite passes, so a static contract regression is
  not currently demonstrated.

### Plausible but unproven

- Claude's current prompt group has a stable non-zero computed translation.
- extension/new-tab users cross the fixed canvas threshold.
- Claude DOM drift changes the selected group or defeats New chat detection.
- the Studio fallback is the exact path seen by the reporting user.

### What the first proposal got wrong or left underspecified

1. It promoted `translate` to the “strongest” suspect without a live trace. The
   corrected plan ranks no root cause until diagnostics identify the declining
   guard.
2. “Capture fixtures” did not define sanitization, fixture shape, update rules,
   or how a fixture proves equivalence to the live page.
3. “Additive composition” named two approaches without choosing criteria. An
   owned wrapper can alter flex/grid semantics and accessibility order; direct
   offset composition can drift if the baseline is sampled after Aura applies.
4. Disabling commit whenever the live target is unavailable is too broad. A
   disconnected Studio may still author a valid portable theme. The UI must
   distinguish **unverified** from **known incompatible**, not turn a diagnostic
   limitation into data loss.
5. The plan lacked a state machine, performance budget, mutation-loop defense,
   rollback strategy, and quantitative acceptance tolerances.
6. A passing synthetic suite is necessary but not proof against a changing
   third-party DOM. Installed observation remains mandatory.

## Technical design contract

### Eligibility result

Use one pure evaluator shared by renderer diagnostics and fixture tests:

```text
PromptEligibility {
  status: ready | temporarily-blocked | unsupported | unverified
  reason: ready | no-main | ambiguous-main | no-editor | ambiguous-editor |
          no-shell | no-group | conversation | context-uncertain |
          small-canvas | active-motion | unsafe-layout | mirror-unavailable
  context: new-chat | conversation | other
  mainRect?: Rect
  promptRect?: Rect
  baseline?: { width, translateX, translateY, source }
}
```

`temporarily-blocked` covers motion or incomplete layout and may be sampled
again. `unsupported` requires native fail-open. `unverified` means Studio has no
fresh mirror; authoring remains possible with an explicit schematic label.
Reason codes are closed, localizable, body-free, and safe to expose transiently.

### Runtime state machine

```text
native -> observing -> ready -> applying -> authored
              |          |         |          |
              +------> native <-----+----------+
                         ^  conversation / ambiguity / disable / cleanup
ready -> suspended(active-motion) -> ready
```

- Only `ready` may enter `applying`.
- `applying` reads the untouched baseline once, calculates a complete width/X/Y
  result, applies it once, then verifies the measured result.
- Verification failure rolls back synchronously to `native`; it never retries
  an insertion-style action or accumulates offsets.
- `suspended` retains the authored recipe but removes Aura placement until two
  consecutive animation-frame samples are stable.
- Every transition is idempotent. Re-entering the same state produces no DOM
  write and no additional observer work.

### Placement calculation

1. Read main and prompt rectangles before any Aura write.
2. Derive safe bounds from the visible main intersection and a 16 CSS-pixel
   inset. Require enough space for the measured prompt's minimum usable width
   and height rather than a viewport-wide magic cutoff.
3. Resolve authored width against safe width and clamp to both the theme's
   ratio range and the prompt's usable minimum.
4. Resolve X from the safe-bounds center and Y from the original baseline top;
   clamp the final rectangle, not the individual deltas.
5. Apply values through Aura-owned custom properties. Prefer an existing stable
   group over inserting a wrapper. Permit composition with Claude translation
   only when the browser exposes a stable, decomposable 2D value; otherwise use
   `unsafe-layout` and fail open.
6. Measure once after application. Accept at most 1 CSS pixel of edge/center
   error and 1 CSS pixel of width error; otherwise remove all Aura properties.

The implementation must cache the pre-write baseline by element plus layout
epoch. It must never use a rectangle already containing Aura offsets as the next
baseline.

### Observation and scheduling

- One document-scoped `MutationObserver` marks discovery dirty; it does not run
  layout reads inside the callback.
- Coalesce mutations, resize, navigation, and mirror requests into one
  `requestAnimationFrame` evaluation per frame.
- Separate the read phase from the write phase to avoid layout thrashing.
- Increment a layout epoch when the candidate element, main bounds, viewport,
  device-pixel ratio, or relevant computed translation changes.
- Ignore Aura-owned attributes and custom-property mutations to prevent a
  self-triggered observer loop.
- Target steady-state cost: zero DOM writes when geometry is unchanged, no more
  than one eligibility evaluation per animation frame during churn, and no
  timer/poller while the document is stable.

### Studio behavior matrix

| Runtime state | Canvas | Controls | Save |
| --- | --- | --- | --- |
| `ready` / `authored` | Mirrored live geometry | Enabled | Enabled |
| `temporarily-blocked` | Last live geometry, subtle “layout moving” status | Temporarily disabled | Enabled |
| `unsupported` | Native live geometry and one concise reason | Disabled for this preview | Enabled as portable theme |
| `unverified` | Clearly labelled schematic | Enabled | Enabled with non-blocking verification note |
| Conversation | Native composer, New chat action | Disabled | Enabled for existing New chat recipe |

This avoids both false confidence and destructive blocking. Status appears only
beside the selected New chat target, uses one sentence, and disappears when
ready. No toast stack, permanent badge, or duplicate warning is added.

## Constraints to preserve

- Never move a conversation composer; customization remains New-chat-only.
- Never fight an ambiguous or modal editor, Claude-owned animation, or an
  unsafe transform.
- Keep native layout until the first deliberate edit, then adopt the complete
  measured width/X/Y tuple.
- Preserve all Prompt Shelf, greeting, artwork, responsive, keyboard, undo,
  localization, privacy, and reversible cleanup behavior.
- Add no brittle class-name dependency and log no prompt text or DOM content.
- Prefer a quiet, explicit unavailable state over controls that appear to work
  but cannot affect the live page.

## Delivery plan

### Phase 1 — Reproduce and identify the declining guard

1. Capture sanitized structural fixtures from signed-in New chat at the
   supported normal, narrow, wide, maximized, and high-DPI sizes. Record only
   tag/role relationships, bounding rectangles, computed layout properties,
   and match counts—never composer text or account content.
2. Add a pure prompt-eligibility diagnostic that returns a bounded reason code
   from the technical contract, such as `no-main`, `ambiguous-editor`,
   `no-shell`, `no-group`, `small-canvas`, `unsafe-layout`, or `ready`.
3. Carry that reason through the existing mirror geometry response and show a
   concise Studio explanation only when the New chat area is selected. Keep
   detailed geometry out of persistent logs.
4. Confirm the actual blocker on each fixture and on a clean installed build
   before changing discovery or placement policy.

Fixture records must use generated element IDs, rounded CSS-pixel rectangles,
allowlisted roles/attributes, normalized computed `display`/`position`/
`transform`/`translate`, and parent/child indices. A capture script must reject
text, HTML, URLs, class names, `data-*` values, input values, and accessible
names before writing. Each fixture carries viewport, DPR, expected context, and
the manually confirmed prompt/main IDs. Review fixtures like source code; never
auto-update expectations from a failing run.

**Exit:** the live failure is reproducible and one deterministic reason code,
not inference from a schematic preview, explains every blocked case.

### Phase 2 — Make discovery resilient without broadening authority

1. Split composer discovery into pure steps with fixture-driven tests: unique
   editor, shell boundary, movable group, and context classification.
2. Prefer semantic roles and containment plus geometry; use Claude classes only
   as non-authoritative hints. Reject multiple equally plausible candidates.
3. Replace the single bottom-gap context test with corroborating signals
   (absence of messages, prompt group containment, visible-area relationship,
   and bounded vertical position). Retain `other` for disagreement.
4. Observe only the smallest stable layout ancestor needed to move the complete
   widget, including its controls, instead of accidentally selecting a wrapper
   used solely for centering or animation.

**Exit:** all captured New chat fixtures resolve one stable prompt group, while
conversation, modal, split, hidden, and ambiguous fixtures still fail open.

### Phase 3 — Compose with Claude's layout safely

1. Classify computed translation by source and stability rather than rejecting
   every non-zero value. Re-sample it across animation frames and distinguish a
   stable Claude baseline from an active transition.
2. Keep Claude's baseline untouched. Apply Aura width and offsets through Aura
   variables on an owned wrapper/style layer, or calculate an additive offset
   that never overwrites Claude's transform/translate declaration.
3. Replace the fixed 480 by 400 cutoff with geometry-derived minimums based on
   the widget's measured size, safe inset, and usable main canvas. If safe
   placement is impossible, retain native layout and expose `small-canvas`.
4. Recompute from the unmodified baseline on resize, DPI change, navigation,
   and Claude layout mutation so repeated passes cannot accumulate drift.
5. Preserve exact cleanup: removing Aura or switching to conversation restores
   the original DOM and every author-owned inline/computed layout value.

Choose the composition mechanism only after a spike compares both candidates
against the fixtures. Reject wrapper insertion if it changes containing blocks,
grid/flex participation, focus order, or event ancestry. Reject direct
composition if the browser cannot decompose the baseline or if two apply/clear
cycles differ from the original rectangle by more than 1 CSS pixel. The spike
does not ship; its result becomes a focused regression test and a short design
decision record in this document.

**Exit:** authored width/X/Y applies at supported normal and narrow sizes,
coexists with a stable Claude translation, pauses during active animation, and
restores pixel-for-pixel.

### Phase 4 — Align Studio preview with runtime truth

1. Use mirrored live geometry when available. Clearly label the schematic
   fallback, disable live manipulation for a runtime-ineligible preview without
   blocking portable-theme saves, and offer a single lightweight action to
   switch to a supported New chat preview.
2. Keep the prompt outline visually quiet: one premium selection outline,
   direct manipulation, and compact width/position controls. Avoid duplicate
   warnings and persistent badges.
3. Make selection, drag, sliders, exact inputs, keyboard nudges, undo/redo, and
   save consume the same eligibility state and placement math.
4. Verify responsive inspector layout and 44-pixel targets at ordinary Studio,
   extension-like narrow, short, and high-DPI viewports.

**Exit:** Studio never presents a savable live preview that the renderer has
already declined, and every enabled control produces the same live geometry.

### Phase 5 — Regression and installed acceptance

Use four complementary test layers rather than treating one synthetic suite as
proof:

1. **Pure geometry property tests:** generate bounded main/prompt rectangles and
   width/X/Y ratios; prove finite output, containment, monotonic width behavior,
   clamping, and idempotence across thousands of deterministic seeded cases.
2. **Sanitized fixture tests:** replay captured DOM relationships and computed
   layout values; prove discovery, context, reason code, and candidate identity.
3. **Instrumented DOM integration tests:** simulate mutation bursts, resize,
   translation changes, apply/verify/rollback, cleanup, and observer re-entry;
   count evaluations and DOM writes against the scheduling budget.
4. **Installed exploratory matrix:** verify the actual signed-in Claude page,
   because no repository fixture can guarantee third-party DOM compatibility.

Add explicit coverage for:

- captured current-DOM fixtures at every supported size;
- stable non-zero translation, active transition, and translation removal;
- threshold boundaries just below and above safe placement;
- navigation between New chat and conversation and same-document DOM churn;
- ambiguous editors, dialogs, hidden editors, and multiple main regions;
- native-to-authored first edit as one width/X/Y transaction;
- resize/DPI recomputation without cumulative drift;
- cleanup, disable, Original look, theme switching, undo/redo, and restart;
- reason-code propagation with no prompt bodies or selectors in logs; and
- reduced motion, forced colors, keyboard-only, and screen-reader status.

For every positive placement case, assert these invariants:

- the prompt and all controls remain visible, clickable, and in their original
  tab order;
- no message content, conversation composer, dialog editor, or modal moves;
- applying twice yields the same rectangle and the second pass performs zero
  writes;
- apply then clear restores the baseline within 1 CSS pixel at DPR 1, 1.25,
  1.5, and 2;
- 100 irrelevant mutations in one frame cause at most one evaluation and zero
  writes when geometry is unchanged; and
- diagnostics contain only the closed reason code and coarse state.

Then run the repository checks and an installed Windows matrix covering all
appearance modes at normal, narrow, wide, maximized, and high-DPI sizes. Capture
before/edit/save/restart/conversation/disable screenshots with no private text.

**Exit:** automated gates pass, installed evidence demonstrates responsive live
parity, and no existing prompt, greeting, Prompt Shelf, or composer behavior is
lost.

### Phase 6 — Controlled rollout and operational proof

1. Keep the existing native fail-open path as the rollback mechanism. Structure
   the new evaluator so one internal capability switch can select the old guard
   without changing saved theme data.
2. First ship diagnostics with behavior unchanged and collect only user-exported
   local reason counts; do not add telemetry or prompt-derived logging.
3. Enable the new composition path only after live evidence names the blocker
   and all four test layers pass. If verification fails at runtime, roll back
   that element immediately and retain the theme recipe for a future eligible
   layout.
4. Treat increases in `ambiguous-*`, `unsafe-layout`, verification rollback, or
   repeated state transitions as compatibility regressions. Provide a local,
   body-free troubleshooting export containing version, viewport bucket, DPR
   bucket, state sequence, and reason codes.
5. Remove temporary diagnostic verbosity after installed acceptance, retaining
   the closed status contract and regression fixtures.

**Exit:** a clean build can enable, disable, downgrade to the native evaluator,
and restore saved themes without migration or visual residue.

## Failure-mode review

| Failure | Risk | Detection | Response |
| --- | --- | --- | --- |
| Wrong group selected | Moves unrelated UI | Candidate identity + containment fixture | Fail open; never guess among peers |
| Baseline sampled after Aura write | Offset grows each pass | Apply-twice idempotence test | Cache by element/layout epoch; rollback |
| Claude animation mistaken for baseline | Jitter or jump | Two-frame stability check | Suspend and re-evaluate |
| Wrapper changes layout semantics | Composer/control regression | ancestry, focus, and geometry spike | Prefer no wrapper; reject approach |
| Observer watches its own writes | CPU loop | evaluation/write counters | Filter Aura mutations and coalesce |
| Narrow viewport cannot contain prompt | Clipping | final-rectangle verification | Native layout + `small-canvas` |
| Mirror disconnected | Misleading schematic | freshness epoch/timeout | Mark unverified; preserve authoring |
| Third-party DOM changes after release | Silent loss of feature | reason-code troubleshooting export | Native fail-open and fixture update |

## Definition of done

- The actual reported blockage has a reproduced fixture and observed reason
  code; no fix is accepted solely because it addresses a plausible suspect.
- The chosen composition approach has a documented rejection analysis for its
  alternative.
- Geometry, fixture, DOM integration, repository, and installed checks pass.
- Normal, narrow, short, wide, maximized, and high-DPI layouts meet the same
  containment and 1 CSS-pixel restoration tolerances.
- Studio communicates `ready`, temporarily blocked, unsupported, and unverified
  states without adding persistent visual noise.
- Conversation, Prompt Shelf, greeting, artwork, localization, accessibility,
  privacy, undo/redo, theme portability, and cleanup remain intact.
- Disabling Aura or invoking Original look restores the untouched native prompt
  immediately, with no wrapper, marker, custom property, observer, or timer left.

## Recommended implementation order

Land diagnostics and fixtures first, discovery second, safe layout composition
third, and Studio polish last. Do not weaken the existing fail-open translation
test until a new additive-composition test proves Claude's baseline is retained.
This order converts the current silent blockage into evidence before changing
the safety boundary and prevents a visual-only fix from masking a runtime
regression.
