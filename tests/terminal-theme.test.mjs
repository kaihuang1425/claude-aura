import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, runIfMain } from "./support/harness.mjs";
import {
  buildTerminalTheme,
  exportTerminalThemePair,
  exportTerminalThemes,
  listThemes,
  TERMINAL_THEME_SCHEMA,
} from "../scripts/theme-core.mjs";
import { contrastRatio, hexToHsl } from "../scripts/theme-core/validation.mjs";

const APPROVED_TERMINAL_TOKENS = [
  "claude",
  "text",
  "inverseText",
  "inactive",
  "subtle",
  "promptBorder",
  "bashBorder",
  "ide",
  "selectionBg",
  "briefLabelYou",
  "briefLabelClaude",
];

const NATIVE_SAFETY_TOKENS = [
  "suggestion",
  "permission",
  "permissionPrompt",
  "warning",
  "error",
  "success",
  "autoAccept",
  "autoAcceptMode",
  "planMode",
  "diffAdded",
  "diffRemoved",
  "diffContext",
  "destructive",
  "destructiveAction",
  "danger",
  "userMessageBackground",
];

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
  assert.deepEqual(
    TERMINAL_THEME_SCHEMA.tokens.map(({ token }) => token),
    APPROVED_TERMINAL_TOKENS,
  );
  for (const theme of await builtIns()) {
    for (const mode of ["light", "dark"]) {
      const document = buildTerminalTheme(theme, mode);
      if (document.base !== mode
          || Object.keys(document).join(",") !== "name,base,overrides"
          || Object.keys(document.overrides).join(",") !== APPROVED_TERMINAL_TOKENS.join(",")) {
        failures.push(`${theme.name}/${mode}: incomplete document`);
      }
      for (const token of NATIVE_SAFETY_TOKENS) {
        if (Object.hasOwn(document.overrides, token)) {
          failures.push(`${theme.name}/${mode}: unsafe override ${token}`);
        }
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

test("terminal schema leaves status, permission, destructive, diff, and user-message semantics native", () => {
  assert.deepEqual(
    TERMINAL_THEME_SCHEMA.tokens.map(({ token }) => token),
    APPROVED_TERMINAL_TOKENS,
  );
  assert.equal(
    TERMINAL_THEME_SCHEMA.tokens.some(({ token }) => NATIVE_SAFETY_TOKENS.includes(token)),
    false,
  );
  assert.equal(
    TERMINAL_THEME_SCHEMA.tokens.some(
      ({ source }) => /success|warning|destructive/i.test(source),
    ),
    false,
  );
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
  delete hostile.dark.semantic["--aura-text-on-accent"];
  assert.throws(
    () => buildTerminalTheme(hostile, "dark"),
    /missing --aura-text-on-accent/,
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

test("one-shot terminal export writes one canonical pair without a manifest", async () => {
  await withTemporaryDirectory(async (directory) => {
    const [theme] = await builtIns();
    const lightPath = path.join(directory, `claude-aura-${theme.name}-light.json`);
    const darkPath = path.join(directory, `claude-aura-${theme.name}-dark.json`);
    const result = await exportTerminalThemePair(theme, { lightPath, darkPath });
    assert.deepEqual(
      result.files.map(({ mode, path: filePath }) => ({ mode, path: filePath })),
      [
        { mode: "light", path: lightPath },
        { mode: "dark", path: darkPath },
      ],
    );
    assert.deepEqual(JSON.parse(await fs.readFile(lightPath, "utf8")), buildTerminalTheme(theme, "light"));
    assert.deepEqual(JSON.parse(await fs.readFile(darkPath, "utf8")), buildTerminalTheme(theme, "dark"));
    assert.deepEqual(
      (await fs.readdir(directory)).sort(),
      [path.basename(darkPath), path.basename(lightPath)].sort(),
    );
  });
});

test("one-shot terminal export refuses either collision before writing", async () => {
  const [theme] = await builtIns();
  for (const collisionMode of ["light", "dark"]) {
    await withTemporaryDirectory(async (directory) => {
      const lightPath = path.join(directory, `claude-aura-${theme.name}-light.json`);
      const darkPath = path.join(directory, `claude-aura-${theme.name}-dark.json`);
      const collisionPath = collisionMode === "light" ? lightPath : darkPath;
      const foreignBytes = `{"foreign":"${collisionMode}"}\n`;
      await fs.writeFile(collisionPath, foreignBytes, "utf8");
      await assert.rejects(
        exportTerminalThemePair(theme, { lightPath, darkPath }),
        /Refusing to overwrite existing Terminal/,
      );
      assert.equal(await fs.readFile(collisionPath, "utf8"), foreignBytes);
      assert.deepEqual(await fs.readdir(directory), [path.basename(collisionPath)]);
    });
  }
});

test("one-shot terminal export removes staged and published files after interruption", async () => {
  const [theme] = await builtIns();
  await withTemporaryDirectory(async (directory) => {
    const lightPath = path.join(directory, `claude-aura-${theme.name}-light.json`);
    const darkPath = path.join(directory, `claude-aura-${theme.name}-dark.json`);
    let opens = 0;
    await assert.rejects(
      exportTerminalThemePair(theme, { lightPath, darkPath }, {
        fileOperations: {
          open: async (...args) => {
            opens += 1;
            if (opens === 2) throw new Error("interrupted while staging");
            return fs.open(...args);
          },
        },
      }),
      /interrupted while staging/,
    );
    assert.deepEqual(await fs.readdir(directory), []);
  });

  await withTemporaryDirectory(async (directory) => {
    const lightPath = path.join(directory, `claude-aura-${theme.name}-light.json`);
    const darkPath = path.join(directory, `claude-aura-${theme.name}-dark.json`);
    let promotions = 0;
    await assert.rejects(
      exportTerminalThemePair(theme, { lightPath, darkPath }, {
        fileOperations: {
          link: async (...args) => {
            promotions += 1;
            if (promotions === 2) throw new Error("interrupted during promotion");
            return fs.link(...args);
          },
        },
      }),
      /interrupted during promotion/,
    );
    assert.deepEqual(await fs.readdir(directory), []);
  });

  await withTemporaryDirectory(async (directory) => {
    const lightPath = path.join(directory, `claude-aura-${theme.name}-light.json`);
    const darkPath = path.join(directory, `claude-aura-${theme.name}-dark.json`);
    let promotions = 0;
    await assert.rejects(
      exportTerminalThemePair(theme, { lightPath, darkPath }, {
        fileOperations: {
          link: async (...args) => {
            promotions += 1;
            await fs.link(...args);
            if (promotions === 2) throw new Error("wrapper failed after promotion");
          },
        },
      }),
      /wrapper failed after promotion/,
    );
    assert.deepEqual(await fs.readdir(directory), []);
  });
});

test("one-shot terminal export rejects invalid, crossed, same, and missing-parent targets", async () => {
  const [theme] = await builtIns();
  await withTemporaryDirectory(async (directory) => {
    const lightPath = path.join(directory, `claude-aura-${theme.name}-light.json`);
    const darkPath = path.join(directory, `claude-aura-${theme.name}-dark.json`);
    await assert.rejects(
      exportTerminalThemePair(theme, { lightPath: "relative-light.json", darkPath }),
      /must be absolute/,
    );
    await assert.rejects(
      exportTerminalThemePair(theme, { lightPath: lightPath.replace(/\.json$/, ".txt"), darkPath }),
      /must be a JSON file/,
    );
    await assert.rejects(
      exportTerminalThemePair(theme, { lightPath: darkPath, darkPath: lightPath }),
      /appears to name the dark theme/,
    );
    await assert.rejects(
      exportTerminalThemePair(theme, {
        lightPath: path.join(directory, "same-target.json"),
        darkPath: path.join(directory, "same-target.json"),
      }),
      /must be different/,
    );
    await assert.rejects(
      exportTerminalThemePair(theme, {
        lightPath: path.join(directory, "missing", "custom-light.json"),
        darkPath,
      }),
      /must already exist/,
    );
    await assert.rejects(
      exportTerminalThemePair(theme, { lightPath, darkPath, extra: true }),
      /must contain only lightPath and darkPath/,
    );
    assert.deepEqual(await fs.readdir(directory), []);
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
