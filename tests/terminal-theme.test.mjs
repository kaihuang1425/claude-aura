import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, runIfMain } from "./support/harness.mjs";
import {
  buildTerminalTheme,
  exportTerminalThemes,
  listThemes,
  TERMINAL_THEME_SCHEMA,
} from "../scripts/theme-core.mjs";
import { contrastRatio, hexToHsl } from "../scripts/theme-core/validation.mjs";

async function builtIns() {
  return listThemes({ locale: "en" });
}

function changedTheme(theme) {
  const copy = structuredClone(theme);
  copy.light.semantic["--aura-accent-primary"] = "12 90% 45%";
  return copy;
}

async function withTemporaryDirectory(run) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-terminal-"));
  try {
    return await run(directory);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("all built-ins project complete, contrast-safe Light and Dark terminal themes", async () => {
  const failures = [];
  for (const theme of await builtIns()) {
    for (const mode of ["light", "dark"]) {
      const document = buildTerminalTheme(theme, mode);
      if (document.base !== mode
          || Object.keys(document).join(",") !== "name,base,overrides"
          || Object.keys(document.overrides).join(",")
            !== TERMINAL_THEME_SCHEMA.tokens.map(({ token }) => token).join(",")) {
        failures.push(`${theme.name}/${mode}: incomplete document`);
      }
      for (const mapping of TERMINAL_THEME_SCHEMA.tokens) {
        const projected = hexToHsl(
          document.overrides[mapping.token],
          `${theme.name}/${mode}/${mapping.token}`,
        );
        const reference = theme[mode].semantic[mapping.reference];
        if (contrastRatio(projected, reference) + 0.001 < mapping.minimumContrast) {
          failures.push(`${theme.name}/${mode}/${mapping.token}: low contrast`);
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});

test("terminal projection is byte-identical and excludes non-colour Aura fields", async () => {
  const [theme] = await builtIns();
  const first = `${JSON.stringify(buildTerminalTheme(theme, "light"), null, 2)}\n`;
  const second = `${JSON.stringify(buildTerminalTheme(theme, "light"), null, 2)}\n`;
  assert.equal(first, second);
  assert(!/artwork|wallpaper|greeting|geometry|radius|shadow|font/i.test(first));
});

test("terminal projection rejects a missing required semantic token", async () => {
  const [theme] = await builtIns();
  const hostile = structuredClone(theme);
  delete hostile.dark.semantic["--aura-success"];
  assert.throws(
    () => buildTerminalTheme(hostile, "dark"),
    /missing --aura-success/,
  );
});

test("terminal export writes official documents and a separate ownership manifest", async () => {
  await withTemporaryDirectory(async (directory) => {
    const [theme] = await builtIns();
    const result = await exportTerminalThemes(theme, directory);
    assert.equal(result.files.length, 2);
    const contents = await Promise.all(result.files.map((file) => fs.readFile(file.path, "utf8")));
    assert(contents.every((text) => text.endsWith("\n") && JSON.parse(text).overrides.claude));
    assert(!result.manifestPath.endsWith(".json"));
  });
});

test("terminal export refuses a foreign-owned collision without changing it", async () => {
  await withTemporaryDirectory(async (directory) => {
    const [theme] = await builtIns();
    const collision = path.join(directory, `claude-aura-${theme.name}-light.json`);
    await fs.writeFile(collision, "{\"foreign\":true}\n", "utf8");
    await assert.rejects(
      exportTerminalThemes(theme, directory),
      /non-Aura-owned terminal theme/,
    );
    assert.equal(await fs.readFile(collision, "utf8"), "{\"foreign\":true}\n");
  });
});

test("interruption around promotion leaves a complete old or new document", async () => {
  const [theme] = await builtIns();
  await withTemporaryDirectory(async (directory) => {
    const baseline = await exportTerminalThemes(theme, directory);
    const target = baseline.files[0].path;
    const oldBytes = await fs.readFile(target, "utf8");
    const beforeRename = async () => {
      const error = new Error("interrupted before promotion");
      error.code = "EIO";
      throw error;
    };
    await assert.rejects(
      exportTerminalThemes(changedTheme(theme), directory, {
        fileOperations: { rename: beforeRename },
      }),
      /interrupted before promotion/,
    );
    assert.equal(await fs.readFile(target, "utf8"), oldBytes);
    assert.deepEqual(Object.keys(JSON.parse(oldBytes)), ["name", "base", "overrides"]);
  });

  await withTemporaryDirectory(async (directory) => {
    const baseline = await exportTerminalThemes(theme, directory);
    const target = baseline.files[0].path;
    const afterRename = async (source, destination) => {
      await fs.rename(source, destination);
      throw new Error("interrupted after promotion");
    };
    await assert.rejects(
      exportTerminalThemes(changedTheme(theme), directory, {
        fileOperations: { rename: afterRename },
      }),
      /interrupted after promotion/,
    );
    const promoted = await fs.readFile(target, "utf8");
    assert.deepEqual(JSON.parse(promoted), buildTerminalTheme(changedTheme(theme), "light"));
  });
});

runIfMain(import.meta.url);
