// Aggregate runner: imports every domain suite (which registers its tests via the
// shared harness), then runs them all. `npm test` still points here.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runAll } from "./support/harness.mjs";

import "./themes.test.mjs";
import "./payload.test.mjs";
import "./artwork.test.mjs";
import "./theme-cli.test.mjs";
import "./terminal-theme.test.mjs";
import "./user-kits.test.mjs";
import "./config.test.mjs";
import "./avatar.test.mjs";
import "./greeting.test.mjs";
import "./greeting-runtime.test.mjs";
import "./prepaint.test.mjs";
import "./aura-rescue.test.mjs";
import "./draft-handoff.test.mjs";
import "./code-adapter.test.mjs";
import "./prompt-shelf.test.mjs";
import "./installer.test.mjs";
import "./desktop-guidance.test.mjs";
import "./locales.test.mjs";
import "./studio-editor.test.mjs";
import "./platform.test.mjs";

const sourceOnlyAuraCodeDiagnosticInputs = [
  new URL("./aura-code-popup-diagnostic.test.mjs", import.meta.url),
  new URL("../windows/aura-code-popup-diagnostic.ps1", import.meta.url),
];
if (sourceOnlyAuraCodeDiagnosticInputs.every((url) => existsSync(fileURLToPath(url)))) {
  await import("./aura-code-popup-diagnostic.test.mjs");
}

const sourceOnlyDesktopTestInputs = [
  new URL("./desktop-cdp.test.mjs", import.meta.url),
  new URL("../scripts/desktop-cdp/session.mjs", import.meta.url),
  new URL("../scripts/desktop-profile.mjs", import.meta.url),
  new URL("../windows/desktop-presentation.ps1", import.meta.url),
];
if (sourceOnlyDesktopTestInputs.every((url) => existsSync(fileURLToPath(url)))) {
  await import("./desktop-cdp.test.mjs");
}

await runAll();
