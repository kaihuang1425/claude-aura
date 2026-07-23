// Minimal test harness: registration + a run-all/report-all runner.
// Splitting the monolith made one thing non-negotiable: a failing test must not
// hide the ones after it. runAll() runs every registered test and reports them all.
import { pathToFileURL } from "node:url";

export const tests = [];
export const test = (name, fn) => tests.push({ name, fn });

export async function runAll() {
  const failures = [];
  let index = 0;
  for (const item of tests) {
    index += 1;
    try {
      await item.fn();
      console.log(`ok ${index} - ${item.name}`);
    } catch (error) {
      failures.push({ name: item.name, error });
      console.error(`not ok ${index} - ${item.name}`);
      console.error((error.stack || String(error.message)).split("\n").map((l) => `#   ${l}`).join("\n"));
    }
  }
  console.log(`1..${tests.length}`);
  if (failures.length) {
    console.error(`# ${failures.length} of ${tests.length} tests failed`);
    process.exitCode = 1;
  } else {
    console.log(`# all ${tests.length} tests passed`);
  }
  return failures.length === 0;
}

// Run all registered tests when this file (or the importer that calls it) is the
// process entry point, so a single domain file can run standalone.
export function runIfMain(importMetaUrl) {
  const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
  if (importMetaUrl === entry) runAll();
}
