#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

function parse(argv) {
  const command = argv.shift();
  const options = {};
  while (argv.length) {
    const key = argv.shift();
    if (!key?.startsWith("--") || !argv.length) throw new Error(`Invalid state argument: ${key ?? "missing"}`);
    options[key.slice(2)] = argv.shift();
  }
  return { command, options };
}

function camel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

async function readState(filePath) {
  const state = JSON.parse(await fs.readFile(filePath, "utf8"));
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("State root must be an object");
  return state;
}

const { command, options } = parse(process.argv.slice(2));
if (!options.path) throw new Error("--path is required");
const filePath = path.resolve(options.path);

if (command === "write") {
  const state = { schemaVersion: 1 };
  for (const [rawKey, value] of Object.entries(options)) {
    if (rawKey === "path") continue;
    const key = camel(rawKey);
    state[key] = ["port", "injectorPid"].includes(key) ? Number(value) : value;
  }
  state.createdAt = new Date().toISOString();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, filePath);
} else if (command === "get") {
  if (!options.field) throw new Error("--field is required");
  const state = await readState(filePath);
  const value = state[camel(options.field)];
  if (value === undefined || value === null) process.exitCode = 2;
  else if (typeof value === "object") console.log(JSON.stringify(value));
  else console.log(String(value));
} else if (command === "show") {
  console.log(JSON.stringify(await readState(filePath), null, 2));
} else if (command === "remove") {
  await fs.rm(filePath, { force: true });
} else {
  throw new Error(`Unknown state command: ${command}`);
}

