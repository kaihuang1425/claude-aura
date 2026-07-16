#!/usr/bin/env node
import path from "node:path";
import { buildPayload } from "./theme-core.mjs";

const args = process.argv.slice(2);
let configPath = null;
let locale = "en";
while (args.length) {
  const argument = args.shift();
  if (!args.length) throw new Error(`Missing value for ${argument}`);
  const value = args.shift();
  if (argument === "--config") configPath = value;
  else if (argument === "--locale") locale = value;
  else throw new Error(`Unexpected argument: ${argument}`);
}
if (!configPath) throw new Error("--config is required");

const bundle = await buildPayload({ configPath: path.resolve(configPath), locale });
process.stdout.write(bundle.payload);
