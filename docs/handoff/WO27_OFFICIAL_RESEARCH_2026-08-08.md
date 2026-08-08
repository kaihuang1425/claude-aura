# WO-27 official-source research — 2026-08-08

Scope: current first-party Anthropic/Claude Code documentation, plus Microsoft WebView2 documentation only to separate technical host capability from Anthropic product support. No account, credential, environment-variable value, session URL, or private session content was inspected.

## Bottom line

| Question | Finding |
| --- | --- |
| Is an Aura-style WebView2 embed explicitly supported? | **No.** Anthropic supports `claude.ai/code` in a browser and its own apps, but the reviewed documentation does not name third-party WebView/WebView2 hosts, DOM injection, or restyling as a supported product surface. |
| Is WebView2 embedding explicitly prohibited? | **Not categorically by the reviewed text.** Anthropic explicitly prohibits identity misrepresentation, routing third-party traffic against subscription limits, and other terms/policy violations. It recommends API-key or supported-provider authentication for products built for others, but does not publish a WebView-specific ban. |
| Best classification | **Undocumented / not affirmatively supported.** Technical feasibility is not a support contract. |
| Revisit the existing stable/release NO-GO? | **No.** The unblock condition in `docs/plans/BLOCKED.md` has not been met. New official capabilities justify refreshing WO-27's facts and supported external-handoff fallback, not enabling an embedded production surface. |

## 1. Third-party embedding of the real Code surface

### Explicit official statements

- Anthropic says Remote Control works from a phone, tablet, or **any browser**, using `claude.ai/code`, and from the Claude mobile apps. Its platform catalog names CLI, Desktop, VS Code, JetBrains, Web, and Mobile. Neither page names a third-party embedded browser or WebView host. [Remote Control](https://code.claude.com/docs/en/remote-control), [platforms and integrations](https://code.claude.com/docs/en/platforms)
- Anthropic expressly allows third-party apps, shortcuts, and web pages to **open** official `claude://code...` and `https://claude.ai/code...` routes. Those links hand off to the Claude app when installed or to a browser; the article does not describe embedding or restyling the destination. [Claude Code links](https://support.claude.com/en/articles/14898120-open-the-claude-mobile-app-with-a-link)
- Anthropic says subscription usage is intended for ordinary use of native Anthropic applications, including Claude web, desktop, mobile, and Claude Code. For a product or tool built for others, it directs developers to API-key authentication through Claude Console or a supported cloud provider. It prohibits tools that misrepresent their identity or route third-party traffic against subscription limits. It does **not** state that every third-party wrapper or WebView is prohibited. [Claude account authentication](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account)
- Microsoft documents that a WebView2 host can supply a same-environment, same-profile WebView for a requested new window. This confirms a host mechanism, not Anthropic permission or support for embedding `claude.ai`. [WebView2 `NewWindowRequested` event arguments](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/winrt/microsoft_web_webview2_core/corewebview2newwindowrequestedeventargs?view=webview2-winrt-1.0.4022.49)

### Classification and inference

**Explicitly supported:** opening the official Code route/session in a normal browser or supported Claude app; starting/hosting Remote Control through documented Claude Code surfaces.

**Explicitly prohibited:** identity misrepresentation, routing third-party traffic against subscription limits, and other terms/policy violations.

**Undocumented:** shipping a third-party product that reuses a subscriber's authenticated `claude.ai/code` surface inside WebView2, injects CSS/JavaScript, or presents that altered surface as its own supported UI.

The phrase “any browser” is not enough to convert the last category into an embedding contract. Anthropic's platform list, authentication guidance, and deep-link guidance distinguish supported official/browser access from developer products. Applying the general third-party authentication policy to Aura's exact wrapper architecture is an **inference**, not an explicit WebView ruling. That uncertainty is sufficient to keep Claude Aura's conservative stable/release gate closed, but it should not be described as proof that Anthropic categorically bans WebView2.

## 2. Current Remote Control contract

Remote Control remains a **research preview**. The detailed availability matrix lists Pro and Max as enabled and Team and Enterprise as admin-enabled. The Remote Control page also says “available on all plans” while its Requirements section lists Pro, Max, Team, and Enterprise; public product copy should therefore say **eligible claude.ai account** rather than infer Free-plan eligibility. [Remote Control](https://code.claude.com/docs/en/remote-control), [feature availability](https://code.claude.com/docs/en/feature-availability)

### Start and attach commands

| Surface/mode | Current documented command | Behavior |
| --- | --- | --- |
| CLI server mode | `claude remote-control` | Waits for remote connections and can serve multiple sessions. |
| CLI interactive mode | `claude --remote-control [name]` or `claude --rc [name]` | Starts a normal interactive terminal session that can also be steered remotely. |
| Existing CLI session | `/remote-control [name]` or `/rc [name]` | Adds Remote Control to the current conversation; running it again opens status/disconnect controls. |
| VS Code extension | `/remote-control` or `/rc` | Starts Remote Control from the official extension; no name argument or QR-code display in this form. |
| Automatic start | `/config` → **Enable Remote Control for all sessions**, or `remoteControlAtStartup` in eligible settings | Registers each interactive process as one remote session. Desktop and VS Code expose corresponding official toggles. |

These commands and their current behavior are documented on the [Remote Control page](https://code.claude.com/docs/en/remote-control). The base server command was introduced in Claude Code 2.1.51; the official changelog current on the research date is 2.1.226. [Claude Code changelog](https://code.claude.com/docs/en/changelog)

### Server-mode controls

`claude remote-control` currently documents:

- `--name "My Project"` and `--remote-control-session-name-prefix <prefix>` for titles;
- `-c` / `--continue` and `--session-id <id>` to resume a prior Remote Control session (2.1.200+), mutually exclusive with the spawn/capacity/create-session controls described by the page;
- `--spawn same-dir` (default), `--spawn worktree` (Git repository required), or `--spawn session` (one session only);
- `--capacity <N>`, default 32, except with `--spawn=session`;
- `--[no-]create-session-in-dir`, `--verbose`, and `--sandbox` / `--no-sandbox`;
- runtime `w` to switch between `same-dir` and `worktree`, and Space to toggle the QR code.

The authoritative flag table and compatibility notes are in [Remote Control](https://code.claude.com/docs/en/remote-control). Eligibility is checked before `claude remote-control --help`, so even help can return an eligibility error.

### Eligibility, authentication, provider, and policy limits

- An eligible claude.ai subscription login is required. Anthropic Console API keys are not supported for Remote Control. A long-lived `claude setup-token` or `CLAUDE_CODE_OAUTH_TOKEN` is inference-only and cannot establish it; Anthropic directs the user to a full claude.ai login. [Remote Control](https://code.claude.com/docs/en/remote-control)
- Remote Control is unavailable through Anthropic Console API keys, Amazon Bedrock, Claude Platform on AWS, Google Cloud's Agent Platform, Microsoft Foundry, and other third-party providers. A non-default `ANTHROPIC_BASE_URL` such as an LLM gateway also disables it. [Feature availability](https://code.claude.com/docs/en/feature-availability), [Remote Control](https://code.claude.com/docs/en/remote-control)
- Workspace trust must already have been accepted in the project directory. [Remote Control](https://code.claude.com/docs/en/remote-control)
- Team and Enterprise default to off until an Owner enables Remote Control. Managed `disableRemoteControl` can independently block it on a device. Retention/compliance configurations including Zero Data Retention can make it unavailable. [Remote Control](https://code.claude.com/docs/en/remote-control)
- `DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, and `DISABLE_GROWTHBOOK` disable feature-flag evaluation that Remote Control depends on. A network/proxy failure can also prevent the eligibility check or connection. [Remote Control](https://code.claude.com/docs/en/remote-control)
- Team/Enterprise can require Trusted Devices. Each browser, phone, or Desktop client then needs enrollment and a sign-in no more than 18 hours old (or a supported biometric/passkey step-up). This is beta and applies only to sessions started after the setting is enabled. [Remote Control](https://code.claude.com/docs/en/remote-control)

Aura should preserve the official failure instead of converting any of these into a generic “unsupported” message or suggesting a bypass.

### Official surfaces and lifecycle

- **Host/local execution surfaces:** Claude Code CLI and the official VS Code extension are explicit start surfaces. The Remote Control documentation also describes Desktop-hosted sessions and a Desktop auto-connect setting. [Remote Control](https://code.claude.com/docs/en/remote-control)
- **Remote steering surfaces:** the supplied session URL or session list at `claude.ai/code` in a browser, Claude mobile for iOS/Android, and Claude Desktop where documented for Remote Control/Trusted Devices. [Remote Control](https://code.claude.com/docs/en/remote-control)
- **Connection:** the local process makes outbound HTTPS requests only, opens no inbound port, registers with Anthropic, and uses short-lived scoped credentials over TLS. [Remote Control](https://code.claude.com/docs/en/remote-control)
- **Data path:** code execution and filesystem access remain local, while the synchronized transcript—including messages, responses, and tool activity—is stored on Anthropic servers under the applicable data policy. [Remote Control](https://code.claude.com/docs/en/remote-control)
- **Lifetime:** one interactive Claude Code process exposes one remote session. Server mode can serve multiple sessions. Closing the terminal, quitting VS Code, or stopping the process ends its session. An awake machine that cannot reach the network for roughly ten minutes times out and exits; shorter sleep/network interruptions can reconnect. [Remote Control](https://code.claude.com/docs/en/remote-control)
- **Dialogs and commands:** permission prompts and `AskUserQuestion` remain open for an answer; other forwarded dialogs default to a five-minute no-action expiry on current versions. `/plugin` and `/resume` remain local-only. Text-output commands and argument-based forms of `/model`, `/effort`, `/fast`, `/color`, and `/rename` work remotely, with documented web/mobile differences for `/mcp` and `/config`. [Remote Control](https://code.claude.com/docs/en/remote-control)

## 3. Claude Code custom terminal themes

Named custom themes were introduced in Claude Code 2.1.118 on 2026-04-23. [Claude Code changelog](https://code.claude.com/docs/en/changelog)

### Documented file contract

Each custom theme is one JSON file in `~/.claude/themes/`. The filename without `.json` is its slug. The only documented top-level fields are all optional: [terminal configuration](https://code.claude.com/docs/en/terminal-config)

| Field | Type | Contract |
| --- | --- | --- |
| `name` | string | Display name in `/theme`; defaults to the slug. |
| `base` | string | One of `dark`, `light`, `dark-daltonized`, `light-daltonized`, `dark-ansi`, or `light-ansi`; defaults to `dark`. |
| `overrides` | object | Sparse map of documented token names to colors; omitted tokens inherit from `base`. |

Example shape:

```json
{
  "name": "Claude Aura Example",
  "base": "dark",
  "overrides": {
    "claude": "#a78bfa",
    "text": "#f5f5f5",
    "promptBorder": "#8b5cf6"
  }
}
```

Color values may use `#rrggbb`, `#rgb`, `rgb(r,g,b)`, `ansi256(n)`, or `ansi:<name>` with one of the 16 standard ANSI names. Unknown tokens and invalid values are ignored; Claude Code's loader is therefore permissive, and Aura must supply its own strict validation if it promises validated output. [Terminal configuration](https://code.claude.com/docs/en/terminal-config)

The documented token families cover text/accent, status, prompt/mode indicators, diff backgrounds, fullscreen backgrounds and selection, usage/speaker labels, shimmer counterparts, eight subagent colors, and rainbow variants. The interactive editor includes a few additional single-purpose accents that the public reference intentionally omits. An exporter should use only the published allowlist and should continue excluding permission, warning, error, success, auto-accept, destructive, and diff semantics unless separately contrast-tested. [Terminal configuration](https://code.claude.com/docs/en/terminal-config)

### Selection and editing workflow

- Run `/theme` or use the theme picker in `/config`.
- Choose **New custom theme…** to create one interactively.
- Select a custom theme; Claude Code stores the preference as `custom:<slug>`.
- Highlight a custom theme and press `Ctrl+E` to edit it.
- Claude Code watches `~/.claude/themes/` and reloads added or changed files. If the directory did not exist when Claude Code started, restart once after creating the first theme file.
- Claude Code themes its own terminal interface; it does not change the terminal application's color scheme. Auto mode follows the terminal's detected light/dark background.

All workflow details are in [Configure your terminal for Claude Code](https://code.claude.com/docs/en/terminal-config).

There is no linked formal JSON Schema in the reviewed theme documentation, and there is no documented paired Light/Dark theme object. WO-27's two-file export remains a sound Aura convention: produce separate light and dark files/slugs, then leave selection to the user through `/theme`. On Windows, expanding `~/.claude/themes/` to `%USERPROFILE%\.claude\themes\` is conventional path expansion rather than wording Anthropic gives on that page, so the exact Windows path still needs installed verification.

## 4. Does this reopen the WO-27 NO-GO?

### Stable/release embedded surface: no

The existing blocker requires an affirmative Anthropic support contract for subscription-authenticated third-party WebView use, or a separately approved API/browser-companion architecture decision. The current official sources provide neither an embedding contract nor a WebView-specific developer route. The retired WebView diagnostic should not be rerun merely because Remote Control gained features.

The evidence supports keeping the wording precise:

- do **not** say WebView2 is technically incompatible;
- do **not** say Anthropic explicitly bans every embedded browser;
- do say the embedded, injected production surface is **undocumented and not affirmatively supported**, so Aura's stable/release gate remains NO-GO.

### Facts worth updating if WO-27 is later revised

1. **Concurrency has materially expanded.** Official server mode now offers `same-dir`, isolated `worktree`, single-`session`, and a default capacity of 32. The historical `one-process-per-session` result remains valid only as prior installed evidence; it is no longer the complete official capability model. Any product promise still needs fresh Windows runtime proof. [Remote Control](https://code.claude.com/docs/en/remote-control)
2. **Resume and lifecycle are better specified.** `--continue`, `--session-id`, reconnect behavior, dialog expiry, and precise failure states should replace older assumptions. [Remote Control](https://code.claude.com/docs/en/remote-control)
3. **Privacy copy must be exact.** Execution/filesystem access remain local, but the synchronized transcript and tool activity are stored on Anthropic servers while connected. [Remote Control](https://code.claude.com/docs/en/remote-control)
4. **Trusted Devices is now a first-class gate.** Aura must never hide or work around enrollment, 18-hour recency, organization policy, or compliance failures. [Remote Control](https://code.claude.com/docs/en/remote-control)
5. **A supported external handoff is clearer.** Third-party apps may open official Code deep/universal links, and ordinary browser/mobile session selection is documented. That can improve the existing browser-companion fallback without authorizing embedding. [Claude Code links](https://support.claude.com/en/articles/14898120-open-the-claude-mobile-app-with-a-link), [Remote Control](https://code.claude.com/docs/en/remote-control)
6. **Terminal-theme export is independently supportable.** The documented three-field JSON contract and `/theme` workflow now give WO-27 a first-party visual companion that does not depend on an Aura-hosted Code surface. Installed validation should target Claude Code 2.1.118 or later and the current published token allowlist. [Terminal configuration](https://code.claude.com/docs/en/terminal-config), [changelog](https://code.claude.com/docs/en/changelog)

## Recommendation

Keep `docs/plans/BLOCKED.md`'s embedded stable/release NO-GO unchanged. If the owner later authorizes a revised work order, prefer the officially documented external browser/app handoff plus strict custom-theme export. Reconsider embedding only after Anthropic publishes affirmative third-party WebView support or provides a direct support determination for this architecture; technical success alone remains insufficient.
