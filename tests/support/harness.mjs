// Minimal test harness: registration + a run-all/report-all runner.
// Splitting the monolith made one thing non-negotiable: a failing test must not
// hide the ones after it. Routine passes stay compact unless explicitly requested.
import { pathToFileURL } from "node:url";

export const tests = [];
export const test = (name, fn) => tests.push({ name, fn });

export async function runAll() {
  const failures = [];
  const verbose = process.env.AURA_TEST_VERBOSE === "1";
  let index = 0;
  for (const item of tests) {
    index += 1;
    try {
      await item.fn();
      if (verbose) console.log(`ok ${index} - ${item.name}`);
    } catch (error) {
      failures.push({ name: item.name, error });
      console.error(`not ok ${index} - ${item.name}`);
      console.error((error.stack || String(error.message)).split("\n").map((l) => `#   ${l}`).join("\n"));
    }
  }
  if (verbose) console.log(`1..${tests.length}`);
  if (failures.length) {
    console.error(`FAIL ${failures.length} of ${tests.length} tests`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${tests.length} tests`);
  }
  return failures.length === 0;
}

// Run all registered tests when this file (or the importer that calls it) is the
// process entry point, so a single domain file can run standalone.
export function runIfMain(importMetaUrl) {
  const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
  if (importMetaUrl === entry) runAll();
}
