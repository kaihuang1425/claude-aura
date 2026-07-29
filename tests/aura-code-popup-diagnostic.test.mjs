import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  path,
  run,
} from "./support/context.mjs";

const diagnosticPath = path.join(
  PROJECT_ROOT,
  "windows",
  "aura-code-popup-diagnostic.ps1",
);

test("Aura Code popup diagnostic parses without launching a window", async () => {
  if (process.platform !== "win32") return;
  const command = [
    "$ErrorActionPreference='Stop'",
    "$tokens=$null;$errors=$null",
    `$ast=[System.Management.Automation.Language.Parser]::ParseFile('${diagnosticPath.replaceAll("'", "''")}',[ref]$tokens,[ref]$errors)`,
    "if($errors.Count){$errors|ForEach-Object{Write-Error $_};exit 1}",
  ].join(";");
  run("powershell.exe", ["-NoProfile", "-Command", command]);
});

test("Aura Code classifier owns only a user-initiated exact Code entry", async () => {
  if (process.platform !== "win32") return;
  const cases = [
    ["https://claude.ai/code", true, "CodeChild"],
    ["https://claude.ai/code/", true, "CodeChild"],
    ["https://claude.ai:443/code", true, "CodeChild"],
    ["https://CLAUDE.AI/code", true, "CodeChild"],
    ["https://claude.ai/code", false, "NativePopup"],
    ["https://claude.ai/code?session=private", true, "NativePopup"],
    ["https://claude.ai/code#private", true, "NativePopup"],
    ["https://claude.ai/%63ode", true, "NativePopup"],
    ["https://claude.ai/code/../code", true, "NativePopup"],
    ["https://claude.ai:444/code", true, "NativePopup"],
    ["https://code.claude.ai/code", true, "NativePopup"],
    ["https://accounts.google.com/o/oauth2/v2/auth", true, "NativePopup"],
    ["https://login.microsoftonline.com/common/oauth2/authorize", true, "NativePopup"],
    ["https://example.com/help", true, "External"],
    ["https://example.com/help", false, "Block"],
    ["https://user@claude.ai/code", true, "Block"],
    ["http://claude.ai/code", true, "Block"],
    ["file:///C:/Windows/win.ini", true, "Block"],
    ["javascript:alert(1)", true, "Block"],
    ["not a URI", true, "Block"],
  ];
  const encodedCases = Buffer.from(JSON.stringify(cases), "utf8").toString("base64");
  const command = [
    "$ErrorActionPreference='Stop'",
    `$path='${diagnosticPath.replaceAll("'", "''")}'`,
    `$json=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedCases}'))`,
    "$cases=$json|ConvertFrom-Json",
    "foreach($case in $cases){",
    "  $actual=& $path -ClassifyOnly -CandidateUri ([string]$case[0]) -UserInitiated:([bool]$case[1])",
    "  if($actual -cne [string]$case[2]){throw \"Unexpected popup disposition: $actual\"}",
    "}",
  ].join("\n");
  run("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    Buffer.from(command, "utf16le").toString("base64"),
  ]);
});

test("retired diagnostic cannot launch its live WebView path", async () => {
  const source = await fs.readFile(diagnosticPath, "utf8");
  for (const forbidden of [
    /WebView2/i,
    /System[.]Windows[.]Forms/i,
    /Application\]::Run/i,
    /Start-Process/i,
    /EnsureCoreWebView2Async/i,
    /NewWindowRequested/i,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
  assert.match(
    source,
    /throw 'The live Aura Code popup diagnostic is retired; only -ClassifyOnly is available[.]'/,
  );
  if (process.platform !== "win32") return;
  assert.throws(
    () => run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      diagnosticPath,
    ]),
    /live Aura Code popup diagnostic is retired/,
  );
});

runIfMain(import.meta.url);
