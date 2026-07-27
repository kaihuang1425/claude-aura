// Aggregate runner: imports every domain suite (which registers its tests via the
// shared harness), then runs them all. `npm test` still points here.
import { runAll } from "./support/harness.mjs";

import "./themes.test.mjs";
import "./payload.test.mjs";
import "./artwork.test.mjs";
import "./theme-cli.test.mjs";
import "./user-kits.test.mjs";
import "./config.test.mjs";
import "./avatar.test.mjs";
import "./greeting.test.mjs";
import "./greeting-runtime.test.mjs";
import "./prepaint.test.mjs";
import "./aura-rescue.test.mjs";
import "./draft-handoff.test.mjs";
import "./prompt-shelf.test.mjs";
import "./installer.test.mjs";
import "./locales.test.mjs";
import "./studio-editor.test.mjs";
import "./platform.test.mjs";

await runAll();
