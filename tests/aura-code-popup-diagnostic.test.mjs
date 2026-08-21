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

test("diagnostic prepares one visible unnavigated child in the same profile", async () => {
  const source = await fs.readFile(diagnosticPath, "utf8");
  const childEnsure = source.indexOf(
    "$script:ChildWebView.EnsureCoreWebView2Async($script:Environment)",
  );
  const mainEnsure = source.indexOf(
    "$script:MainWebView.EnsureCoreWebView2Async($script:Environment)",
  );
  const mainNavigate = source.indexOf("$mainCore.Navigate('https://claude.ai/')");

  assert(childEnsure >= 0 && childEnsure < mainEnsure && mainEnsure < mainNavigate);
  assert.match(source, /ClaudeAura[\\/]webview/);
  assert.match(source, /Test-AuraCodeDiagnosticHostRunning/);
  assert.match(source, /\$script:ChildForm\.Show\(\$script:MainForm\)/);
  assert.match(source, /\$script:MainForm\.Visible[\s\S]*?\$script:ChildForm\.Visible/);
  assert.match(source, /\$script:MainWebView\.IsHandleCreated/);
  assert.match(source, /\$script:ChildWebView\.IsHandleCreated/);
  assert.match(source, /Profile\.ProfileName[\s\S]*?Profile\.IsInPrivateModeEnabled/);
  assert.doesNotMatch(
    source,
    /ChildWebView(?:\.CoreWebView2)?\.(?:Navigate|NavigateToString|Source\s*=)/,
  );
  assert.equal(
    (source.match(/\.Navigate\('https:\/\/claude\.ai\/'\)/g) ?? []).length,
    1,
  );
  assert.equal(
    (source.match(/\.Navigate\('https:\/\/claude\.ai\/new'\)/g) ?? []).length,
    1,
  );
  assert.equal(
    (source.match(/\.Navigate\('https:\/\/claude\.ai\/code'\)/g) ?? []).length,
    1,
  );
});

test("diagnostic assigns the child once and keeps fallback handling bounded", async () => {
  const source = await fs.readFile(diagnosticPath, "utf8");
  const handlerStart = source.indexOf("$mainCore.add_NewWindowRequested({");
  const handlerEnd = source.indexOf(
    "\n\n      $script:ChildAvailable = $script:RouteMode -ceq 'Child'",
    handlerStart,
  );
  assert(handlerStart >= 0 && handlerEnd > handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  const codeStart = handler.indexOf("if ($disposition -eq 'CodeChild')");
  const nativeStart = handler.indexOf("if ($disposition -eq 'NativePopup')");
  const codeBranch = handler.slice(codeStart, nativeStart);
  const mainModeStart = codeBranch.indexOf("if ($script:RouteMode -ceq 'Main')");
  const childModeStart = codeBranch.indexOf("if ($script:ChildAvailable");
  const mainModeBranch = codeBranch.slice(mainModeStart, childModeStart);
  const childModeBranch = codeBranch.slice(childModeStart);

  assert.match(
    handler,
    /Get-AuraCodePopupDisposition[\s\S]*?-IsUserInitiated \(\[bool\]\$eventArgs\.IsUserInitiated\)/,
  );
  assert.match(
    mainModeBranch,
    /\.Navigate\('https:\/\/claude\.ai\/code'\)[\s\S]{0,100}?\$eventArgs\.Handled\s*=\s*\$true/,
  );
  assert.doesNotMatch(mainModeBranch, /Navigate\([^)]*eventArgs\.Uri/);
  assert.match(
    mainModeBranch,
    /\$script:CodeRouteAccepted\s*=\s*\$true[\s\S]*?\.Navigate\('https:\/\/claude\.ai\/code'\)/,
  );
  assert.match(
    mainModeBranch,
    /catch\s*\{[\s\S]*?\$script:CodeRouteAccepted\s*=\s*\$false/,
  );
  assert.match(
    childModeBranch,
    /\$eventArgs\.NewWindow\s*=\s*\$script:ChildWebView\.CoreWebView2/,
  );
  assert.match(childModeBranch, /\$script:ChildAvailable\s*=\s*\$false/);
  assert.doesNotMatch(childModeBranch, /Handled\s*=/);
  assert.match(handler, /if \(\$disposition -eq 'NativePopup'\)[\s\S]{0,260}?\breturn\b/);
  assert.match(
    handler,
    /\$eventArgs\.Handled\s*=\s*\$true[\s\S]{0,260}?Start-Process -FilePath \$target\.AbsoluteUri/,
  );
  assert.match(source, /\$childCore\.add_WindowCloseRequested\(/);
});

test("same-window mode exposes one explicit fixed-origin Chat return", async () => {
  const source = await fs.readFile(diagnosticPath, "utf8");
  const clickStart = source.indexOf("$script:MainChatButton.add_Click({");
  const clickEnd = source.indexOf("\n      $mainCore.add_NewWindowRequested({", clickStart);
  const handler = source.slice(clickStart, clickEnd);

  assert.match(
    source,
    /\[ValidateSet\('Child', 'Main'\)\]\[string\]\$RouteMode = 'Main'/,
  );
  assert.match(source, /\$script:MainChatButton\.Text\s*=\s*'Return to Chat'/);
  assert.match(source, /\$script:MainChatButton\.Visible\s*=\s*\$script:RouteMode -ceq 'Main'/);
  assert.match(
    source,
    /\$script:MainChatButton\.Enabled\s*=[\s\S]{0,120}?\$script:CodeRouteAccepted/,
  );
  assert.match(
    handler,
    /\$script:RouteMode -cne 'Main'[\s\S]*?-not \$script:CodeRouteAccepted/,
  );
  assert.match(handler, /\.Navigate\('https:\/\/claude\.ai\/new'\)/);
  assert.match(
    handler,
    /\.Navigate\('https:\/\/claude\.ai\/new'\)[\s\S]*?\$script:CodeRouteAccepted\s*=\s*\$false/,
  );
  assert.match(
    handler,
    /catch\s*\{[\s\S]*?\$script:CodeRouteAccepted\s*=\s*\$true[\s\S]*?\$script:MainChatButton\.Enabled\s*=\s*\$true/,
  );
  assert.doesNotMatch(handler, /eventArgs|Source|History|GoBack/);
  assert.doesNotMatch(handler, /Timer\.Start|Start-Sleep|retry/i);
});

test("diagnostic records bounded lifecycle fields without inspecting content", async () => {
  const source = await fs.readFile(diagnosticPath, "utf8");
  assert.match(source, /\[ValidateSet\('Child', 'Main'\)\]\[string\]\$RouteMode/);
  assert.match(
    source,
    /\[ValidateSet\('main-navigation', 'popup-request'\)\][\s\S]*?\[ValidateSet\('chat', 'code', 'other'\)\]/,
  );
  assert.match(source, /\[ValidateRange\(0, 599\)\]\[int\]\$HttpStatus/);
  assert.match(source, /\.add_NavigationStarting\(/);
  assert.match(source, /\.add_NavigationCompleted\(/);
  assert.match(source, /\$eventArgs\.HttpStatusCode/);
  assert.equal((source.match(/\$script:MainForm\.Text\s*=/g) ?? []).length, 1);
  assert.equal((source.match(/\$script:ChildForm\.Text\s*=/g) ?? []).length, 1);

  const forbidden = [
    /ExecuteScript/i,
    /ScriptToExecute/i,
    /CapturePreview/i,
    /WebMessage/i,
    /DevTools/i,
    /\bCDP\b/i,
    /DOMSnapshot/i,
    /WebResourceResponseReceived/i,
    /DocumentTitle|StatusBarText|OriginalSourceFrameInfo/i,
    /GetDeferral|Register-ObjectEvent|CreateCoreWebView2ControllerAsync/i,
    /WriteAllText|AppendAllText|Set-Content|Add-Content|Out-File/i,
    /Write-Aura|Write-Host|Write-Output/i,
    /renderer|mirror/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(source, pattern);
  assert.doesNotMatch(source, /eventArgs\.Uri[\s\S]{0,120}?(?:Text|Console|Write)/i);
  assert.doesNotMatch(source, /\.Exception(?:\.ToString\(\)|\.Message)?/i);
});

runIfMain(import.meta.url);
