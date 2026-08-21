import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  path,
  readHostCopy,
  run,
} from "./support/context.mjs";

const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");

const powershellFunction = (source, name) => {
  const startIndex = source.indexOf(`function ${name}`);
  assert(startIndex >= 0, `Aura UI is missing ${name}`);
  const endIndex = source.indexOf("\nfunction ", startIndex + 1);
  return source.slice(startIndex, endIndex < 0 ? source.length : endIndex);
};

test("Aura Rescue Mode detects only correlated Cloudflare challenge responses", async () => {
  const ui = await fs.readFile(uiPath, "utf8");
  const responseHandlers = [...ui.matchAll(/\$core\.add_WebResourceResponseReceived\(/g)];
  assert.equal(responseHandlers.length, 1,
    "The main WebView must have exactly one access-challenge response observer");

  const responseStart = responseHandlers[0].index;
  const responseEnd = ui.indexOf("$core.add_NavigationStarting(", responseStart);
  const responseHandler = ui.slice(responseStart, responseEnd);
  assert.match(responseHandler, /\.GetHeader\(['"]cf-mitigated['"]\)/,
    "Challenge detection must use Cloudflare's authoritative response marker");
  assert.match(responseHandler, /Test-AuraUiCloudflareChallengeSignal/,
    "The response observer must delegate to the pure correlation classifier");
  assert.match(responseHandler, /RescueChallengeCandidate/,
    "The response observer must record a candidate for NavigationCompleted");
  assert.match(responseHandler, /Stop-AuraUiMirrorForRescue[\s\S]{0,520}?Hide-AuraUiLoading/,
    "A verified marker must reveal the genuine document before DOMContentLoaded");
  assert(!/Write-AuraUiLog|GetContentAsync|Request\.Headers|GetIterator|GetEnumerator/.test(responseHandler),
    "The response observer must not log URLs, inspect request headers, enumerate headers, or read a body");

  const completedStart = ui.indexOf("$core.add_NavigationCompleted({", responseEnd);
  const completedEnd = ui.indexOf("$core.add_SourceChanged(", completedStart);
  const completedHandler = ui.slice(completedStart, completedEnd);
  const rescueIndex = completedHandler.indexOf("Test-AuraUiRescueChallengeCandidate");
  const failureIndex = completedHandler.indexOf("$navigationDisposition -eq 'Failure'");
  assert(rescueIndex >= 0 && rescueIndex < failureIndex,
    "A correlated challenge must return before generic navigation failure handling");
  assert.match(completedHandler,
    /Enter-AuraUiRescueMode[\s\S]{0,120}?\breturn\b/,
    "Challenge completion must enter native Rescue Mode and stop normal page handling");
  assert.match(completedHandler,
    /Hide-AuraUiLoading[\s\S]{0,360}?\$script:PendingNavigationCompletion\s*=\s*\[PSCustomObject\][\s\S]{0,300}?\breturn\b/,
    "A normal Claude completion must reveal the document and defer renderer work");
  assert(!/Apply-AuraUiTheme/.test(completedHandler),
    "NavigationCompleted must not inject before the late-response verification gate");

  const verificationGate = powershellFunction(ui, "Complete-AuraUiPendingNavigationVerification");
  const gateRescueIndex = verificationGate.indexOf("Test-AuraUiRescueChallengeCandidate");
  const gateApplyIndex = verificationGate.indexOf("Apply-AuraUiTheme");
  const gateMirrorIndex = verificationGate.indexOf("Request-AuraUiContextMirror");
  assert(gateRescueIndex >= 0 && gateRescueIndex < gateApplyIndex && gateRescueIndex < gateMirrorIndex,
    "The bounded gate must resolve a late marker before renderer or Studio work");
  assert.match(verificationGate, /DueUtc/);
  assert.match(powershellFunction(ui, "Get-AuraUiHostDeadlineUtc"),
    /PendingNavigationCompletion[\s\S]{0,180}?DueUtc/,
    "The response-verification due time must participate in one-shot host deadlines");
  const hostWorkStart = ui.indexOf("$script:HostWorkAction = [Action]{");
  const hostWorkEnd = ui.indexOf("$script:Form.add_Shown({", hostWorkStart);
  assert.match(ui.slice(hostWorkStart, hostWorkEnd),
    /Complete-AuraUiPendingNavigationVerification/,
    "Event-driven host work must service the bounded response-verification gate");
  assert.match(powershellFunction(ui, "Initialize-AuraUiEventDispatch"),
    /add_Tick\(\{[\s\S]{0,120}?\.Stop\(\)[\s\S]{0,120}?Request-AuraUiHostWork/,
    "The response-verification deadline must use a self-stopping one-shot timer");

  const navigationStartingStart = ui.indexOf("$core.add_NavigationStarting(", responseEnd);
  const navigationStartingEnd = ui.indexOf("$core.add_DOMContentLoaded(", navigationStartingStart);
  const navigationStarting = ui.slice(navigationStartingStart, navigationStartingEnd);
  assert.match(navigationStarting,
    /\$script:RescueVerificationPending\s*=\s*Test-AuraUiClaudeUri[\s\S]{0,420}?Stop-AuraUiMirrorForRescue/,
    "A Claude navigation must suspend renderer and mirror work before a response arrives");

  if (process.platform === "win32") {
    const regression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${uiPath.replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for Rescue Mode regression'}",
      "$names=@('Test-AuraUiClaudeUri','Get-AuraUiNavigationRequestIdentity','Test-AuraUiCloudflareChallengeSignal','Test-AuraUiRescueChallengeCandidate','Test-AuraUiRescueNavigationFallback','Complete-AuraUiPendingNavigationVerification','Get-AuraUiRescueBreakerTransition')",
      "foreach($name in $names){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Rescue Mode function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "$target='https://claude.ai/code?next=%2Fchat%2Fabc#latest'",
      "$request='https://claude.ai/code?next=%2Fchat%2Fabc'",
      "if(-not (Test-AuraUiCloudflareChallengeSignal -NavigationId ([UInt64]42) -NavigationUri $target -RequestUri $request -StatusCode 403 -MitigatedHeader 'challenge')){throw 'Current challenge was not detected'}",
      "if(-not (Test-AuraUiCloudflareChallengeSignal -NavigationId ([UInt64]42) -NavigationUri $target -RequestUri $request -StatusCode 200 -MitigatedHeader ' Challenge ')){throw 'Authoritative marker was incorrectly tied to status 403'}",
      "if(Test-AuraUiCloudflareChallengeSignal -NavigationId ([UInt64]42) -NavigationUri $target -RequestUri $request -StatusCode 403 -MitigatedHeader ''){throw 'Bare 403 became a challenge'}",
      "if(Test-AuraUiCloudflareChallengeSignal -NavigationId ([UInt64]42) -NavigationUri $target -RequestUri $request -StatusCode 403 -MitigatedHeader 'block'){throw 'Non-challenge mitigation became a challenge'}",
      "if(Test-AuraUiCloudflareChallengeSignal -NavigationId ([UInt64]42) -NavigationUri $target -RequestUri 'https://claude.ai/code?next=%2Fchat%2Fdifferent' -StatusCode 403 -MitigatedHeader 'challenge'){throw 'Different query was correlated'}",
      "if(Test-AuraUiCloudflareChallengeSignal -NavigationId ([UInt64]42) -NavigationUri 'https://example.com/' -RequestUri 'https://example.com/' -StatusCode 403 -MitigatedHeader 'challenge'){throw 'Non-Claude challenge was accepted'}",
      "if(Test-AuraUiCloudflareChallengeSignal -NavigationId $null -NavigationUri $target -RequestUri $request -StatusCode 403 -MitigatedHeader 'challenge'){throw 'Missing navigation ID was accepted'}",
      "$candidate=[PSCustomObject]@{NavigationId=[UInt64]42;RequestIdentity=(Get-AuraUiNavigationRequestIdentity -Value $request);StatusCode=403}",
      "if(-not (Test-AuraUiRescueChallengeCandidate -Candidate $candidate -CompletedNavigationId ([UInt64]42) -CurrentSource $target -CompletedStatusCode 403)){throw 'Current candidate was not resolved'}",
      "if(Test-AuraUiRescueChallengeCandidate -Candidate $candidate -CompletedNavigationId ([UInt64]41) -CurrentSource $target -CompletedStatusCode 403){throw 'Stale candidate was resolved'}",
      "if(Test-AuraUiRescueChallengeCandidate -Candidate $candidate -CompletedNavigationId ([UInt64]42) -CurrentSource 'https://claude.ai/code?next=other' -CompletedStatusCode 403){throw 'Candidate resolved against another document'}",
      "if(Test-AuraUiRescueChallengeCandidate -Candidate $candidate -CompletedNavigationId ([UInt64]42) -CurrentSource $target -CompletedStatusCode 200){throw 'Subresource status was mistaken for the document status'}",
      "if(-not (Test-AuraUiRescueNavigationFallback -CurrentNavigationId ([UInt64]42) -CompletedNavigationId ([UInt64]42) -CurrentSource $target -HttpStatusCode 403)){throw 'Current Claude 403 lost its late-header fail-safe'}",
      "if(Test-AuraUiRescueNavigationFallback -CurrentNavigationId ([UInt64]42) -CompletedNavigationId ([UInt64]41) -CurrentSource $target -HttpStatusCode 403){throw 'Stale 403 entered Rescue'}",
      "if(Test-AuraUiRescueNavigationFallback -CurrentNavigationId ([UInt64]42) -CompletedNavigationId ([UInt64]42) -CurrentSource $target -HttpStatusCode 401){throw 'Non-403 status entered the fail-safe'}",
      "if(Test-AuraUiRescueNavigationFallback -CurrentNavigationId ([UInt64]42) -CompletedNavigationId ([UInt64]42) -CurrentSource 'https://example.com/' -HttpStatusCode 403){throw 'Non-Claude 403 entered Rescue'}",
      "function Enter-AuraUiRescueMode { param([UInt64]$NavigationId,[string]$Reason);$script:entered=[PSCustomObject]@{NavigationId=$NavigationId;Reason=$Reason} }",
      "function Exit-AuraUiRescueMode { throw 'Late challenge incorrectly exited Rescue' }",
      "function Hide-AuraUiLoading { throw 'Late challenge reached normal completion' }",
      "function Show-AuraUiLauncherHint { throw 'Late challenge reached launcher work' }",
      "function Apply-AuraUiTheme { throw 'Late challenge reached renderer work' }",
      "function Request-AuraUiContextMirror { throw 'Late challenge reached mirror work' }",
      "$script:WebView=[PSCustomObject]@{Source=$target}",
      "$script:ActiveNavigationId=[UInt64]42",
      "$script:ActiveNavigationUri=$target",
      "$script:RescueChallengeCandidate=[PSCustomObject]@{NavigationId=[UInt64]42;RequestIdentity=(Get-AuraUiNavigationRequestIdentity -Value $request);StatusCode=200}",
      "$script:RescueVerificationPending=$true",
      "$script:PendingNavigationCompletion=[PSCustomObject]@{NavigationId=[UInt64]42;StatusCode=200;DueUtc=[DateTime]::UtcNow.AddMinutes(1)}",
      "$script:entered=$null",
      "Complete-AuraUiPendingNavigationVerification",
      "if($null -ne $script:entered -or $null -eq $script:PendingNavigationCompletion){throw 'Verification gate did not honor its bounded due time'}",
      "$script:PendingNavigationCompletion.DueUtc=[DateTime]::UtcNow.AddMilliseconds(-1)",
      "Complete-AuraUiPendingNavigationVerification",
      "if($null -eq $script:entered -or $script:entered.NavigationId -ne 42 -or $script:entered.Reason -cne 'Challenge'){throw 'Late marked 200 response did not enter Challenge Rescue'}",
      "if($null -ne $script:ActiveNavigationId -or $script:RescueVerificationPending){throw 'Late challenge did not retire navigation verification state'}",
      "$first=Get-AuraUiRescueBreakerTransition -State Closed -Count 0 -Distinct $true",
      "if($first.State -cne 'Closed' -or $first.Count -ne 1){throw 'First challenge opened the breaker too early'}",
      "$duplicate=Get-AuraUiRescueBreakerTransition -State $first.State -Count $first.Count -Distinct $false",
      "if($duplicate.State -cne 'Closed' -or $duplicate.Count -ne 1){throw 'Duplicate challenge changed breaker state'}",
      "$second=Get-AuraUiRescueBreakerTransition -State $duplicate.State -Count $duplicate.Count -Distinct $true",
      "if($second.State -cne 'Open' -or $second.Count -ne 2){throw 'Repeated challenge did not open the breaker'}",
      "$halfOpen=Get-AuraUiRescueBreakerTransition -State HalfOpen -Count 1 -Distinct $true",
      "if($halfOpen.State -cne 'Open' -or $halfOpen.Count -ne 2){throw 'Failed half-open retry did not reopen the breaker'}",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-EncodedCommand",
      Buffer.from(regression, "utf16le").toString("base64"),
    ]);
  }
});

test("Aura Code detours retain or recover only a verified experimental Code surface", async () => {
  const ui = await fs.readFile(uiPath, "utf8");
  const uiCopy = await readHostCopy();
  const captureRecovery = powershellFunction(ui, "Get-AuraUiNavigationRecoverySurface");
  const resolveFailure = powershellFunction(ui, "Get-AuraUiCodeFailureDisposition");

  assert.doesNotMatch(captureRecovery, /Write-AuraUiLog|Set-AuraUiConfig|Start-Process/);
  assert.doesNotMatch(resolveFailure, /Write-AuraUiLog|Set-AuraUiConfig|Start-Process/);

  const navigationStartingStart = ui.indexOf("$core.add_NavigationStarting(");
  const navigationStartingEnd = ui.indexOf("$core.add_DOMContentLoaded(", navigationStartingStart);
  const navigationStarting = ui.slice(navigationStartingStart, navigationStartingEnd);
  const recoveryCaptureIndex = navigationStarting.indexOf(
    "$script:NavigationRecoverySurface = Get-AuraUiNavigationRecoverySurface",
  );
  const pageResetIndex = navigationStarting.indexOf("$script:PageReady = $false");
  assert(recoveryCaptureIndex >= 0 && recoveryCaptureIndex < pageResetIndex,
    "Navigation recovery must snapshot only the already verified page before clearing readiness");
  assert.doesNotMatch(navigationStarting, /NavigationRecovery(?:Surface|Uri|Url)\s*=\s*\$eventArgs\.Uri/,
    "Code recovery must retain an enum, never the detour URI");

  const completedStart = ui.indexOf("$core.add_NavigationCompleted({", navigationStartingEnd);
  const completedEnd = ui.indexOf("$core.add_SourceChanged(", completedStart);
  const completedHandler = ui.slice(completedStart, completedEnd);
  const codeDispositionIndex = completedHandler.indexOf("Get-AuraUiCodeFailureDisposition");
  const genericFailureIndex = completedHandler.indexOf(
    'Show-AuraUiLoading -Message "$($script:UiCopy.loadFailed)" -Retry $true',
  );
  assert(codeDispositionIndex >= 0 && codeDispositionIndex < genericFailureIndex,
    "A verified Code detour must resolve before generic load-failure handling");
  assert.match(completedHandler,
    /\$codeFailureDisposition\s+-eq\s+['"]RetainCode['"][\s\S]{0,520}?\$script:PageReady\s*=\s*\$true[\s\S]{0,220}?Hide-AuraUiLoading[\s\S]{0,120}?\breturn\b/,
    "A non-catastrophic detour that left Code loaded must reveal the retained page");
  assert.match(completedHandler,
    /\$codeFailureDisposition\s+-eq\s+['"]OfferCodeRecovery['"][\s\S]{0,520}?codeRecoveryMessage[\s\S]{0,180}?-RetrySurface Code[\s\S]{0,120}?\breturn\b/,
    "A failed detour that did not retain Code must offer an explicit fixed-route return");

  const retryStart = ui.indexOf("$script:RetryButton.add_Click({");
  const retryEnd = ui.indexOf("$script:HostWorkRequestAction", retryStart);
  const retryHandler = ui.slice(retryStart, retryEnd);
  assert.match(retryHandler,
    /\$script:LoadingRetrySurface\s+-ceq\s+['"]Code['"][\s\S]{0,220}?['"]https:\/\/claude\.ai\/code['"]/,
    "The Code recovery button must use one fixed trusted Code URL");
  assert.match(retryHandler, /['"]https:\/\/claude\.ai\/['"]/,
    "Generic retry must retain its fixed Claude home fallback");
  assert.doesNotMatch(retryHandler, /WebView\.Source|ActiveNavigationUri|eventArgs|GoBack|CanGoBack/,
    "Recovery must not replay a mutable detour or browser history");

  const processFailedStart = ui.indexOf("$core.add_ProcessFailed({");
  const processFailedEnd = ui.indexOf("# Keyboard accelerators", processFailedStart);
  const processFailed = ui.slice(processFailedStart, processFailedEnd);
  assert.match(processFailed, /Get-AuraUiNavigationRecoverySurface/);
  assert.match(processFailed,
    /\$processRecoverySurface\s+-ceq\s+['"]Code['"][\s\S]{0,700}?codeRecoveryMessage[\s\S]{0,180}?-RetrySurface Code/,
    "A Code renderer failure must reach the same explicit fixed-route recovery");

  for (const locale of Object.keys(uiCopy)) {
    for (const key of ["codeRecoveryMessage", "returnToAuraCode"]) {
      assert.equal(typeof uiCopy[locale][key], "string", `${locale}.${key} is missing`);
      assert(uiCopy[locale][key].trim(), `${locale}.${key} is empty`);
    }
  }
  assert.equal(
    uiCopy.en.codeRecoveryMessage,
    "The local-app handoff did not complete. Return to Aura Code to continue in the web session.",
  );
  assert.equal(uiCopy.en.returnToAuraCode, "Return to Aura Code");

  if (process.platform === "win32") {
    const regression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${uiPath.replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for Code recovery regression'}",
      "$names=@('Test-AuraUiCodeUri','Get-AuraUiNavigationRecoverySurface','Get-AuraUiCodeFailureDisposition')",
      "foreach($name in $names){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Code recovery function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "$code='https://claude.ai/code/session-redacted?view=active#latest'",
      "$chat='https://claude.ai/new'",
      "$other='https://example.com/code'",
      "if((Get-AuraUiNavigationRecoverySurface -ExperimentalCodeStyle $true -AuraEnabled $true -PageReady $true -CurrentSource $code) -cne 'Code'){throw 'Verified Code did not arm recovery'}",
      "if((Get-AuraUiNavigationRecoverySurface -ExperimentalCodeStyle $false -AuraEnabled $true -PageReady $true -CurrentSource $code) -cne 'None'){throw 'Production Aura armed Code recovery'}",
      "if((Get-AuraUiNavigationRecoverySurface -ExperimentalCodeStyle $true -AuraEnabled $false -PageReady $true -CurrentSource $code) -cne 'None'){throw 'Original look armed Code recovery'}",
      "if((Get-AuraUiNavigationRecoverySurface -ExperimentalCodeStyle $true -AuraEnabled $true -PageReady $false -CurrentSource $code) -cne 'None'){throw 'Unverified Code armed recovery'}",
      "if((Get-AuraUiNavigationRecoverySurface -ExperimentalCodeStyle $true -AuraEnabled $true -PageReady $true -CurrentSource $chat) -cne 'None'){throw 'Chat armed Code recovery'}",
      "if((Get-AuraUiCodeFailureDisposition -ExperimentalCodeStyle $true -AuraEnabled $true -RecoverySurface Code -CurrentSource $code -WebErrorStatus OperationCanceled) -cne 'RetainCode'){throw 'Canceled Code detour did not retain Code'}",
      "if((Get-AuraUiCodeFailureDisposition -ExperimentalCodeStyle $true -AuraEnabled $true -RecoverySurface Code -CurrentSource $code -WebErrorStatus ConnectionAborted) -cne 'RetainCode'){throw 'Aborted Code detour did not retain Code'}",
      "if((Get-AuraUiCodeFailureDisposition -ExperimentalCodeStyle $true -AuraEnabled $true -RecoverySurface Code -CurrentSource $code -WebErrorStatus Unknown) -cne 'OfferCodeRecovery'){throw 'Unknown Code failure was silently retained'}",
      "if((Get-AuraUiCodeFailureDisposition -ExperimentalCodeStyle $true -AuraEnabled $true -RecoverySurface Code -CurrentSource $other -WebErrorStatus OperationCanceled) -cne 'OfferCodeRecovery'){throw 'Changed destination was silently retained'}",
      "if((Get-AuraUiCodeFailureDisposition -ExperimentalCodeStyle $true -AuraEnabled $true -RecoverySurface None -CurrentSource $code -WebErrorStatus OperationCanceled) -cne 'GenericFailure'){throw 'Unarmed failure entered Code recovery'}",
      "if((Get-AuraUiCodeFailureDisposition -ExperimentalCodeStyle $false -AuraEnabled $true -RecoverySurface Code -CurrentSource $code -WebErrorStatus OperationCanceled) -cne 'GenericFailure'){throw 'Production Aura entered Code recovery'}",
      "if((Get-AuraUiCodeFailureDisposition -ExperimentalCodeStyle $true -AuraEnabled $false -RecoverySurface Code -CurrentSource $code -WebErrorStatus OperationCanceled) -cne 'GenericFailure'){throw 'Original look entered Code recovery'}",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-EncodedCommand",
      Buffer.from(regression, "utf16le").toString("base64"),
    ]);
  }
});

test("Aura Rescue Mode fails native and offers reversible user actions", async () => {
  const ui = await fs.readFile(uiPath, "utf8");
  const uiCopy = await readHostCopy();

  const enterRescue = powershellFunction(ui, "Enter-AuraUiRescueMode");
  assert.match(enterRescue, /Hide-AuraUiLoading/,
    "Rescue Mode must reveal the genuine access-check document");
  assert.match(enterRescue, /\$script:PendingApply\s*=\s*\$false/);
  assert.match(enterRescue, /\$script:PendingRestore\s*=\s*\$false/);
  assert.match(enterRescue, /Stop-AuraUiMirrorForRescue/);
  assert(!/Navigate\(|NavigateToString|ExecuteScriptAsync|CapturePreviewAsync|Start-Process/.test(enterRescue),
    "Entering Rescue Mode must not navigate, inject, capture, or launch another app automatically");

  for (const name of ["Start-AuraUiScript", "Apply-AuraUiTheme"]) {
    assert.match(powershellFunction(ui, name),
      /if\s*\(\$script:RescueActive\s+-or\s+\$script:RescueVerificationPending\)[\s\S]{0,180}?\breturn\b/,
      `${name} must stop while challenge verification is active`);
  }
  for (const name of ["Request-AuraUiMirror", "Request-AuraUiContextMirror", "Start-AuraUiMirrorCapture"]) {
    const mirrorFunction = powershellFunction(ui, name);
    assert.match(mirrorFunction, /\$script:RescueActive/);
    assert.match(mirrorFunction, /\$script:RescueVerificationPending/,
      `${name} must not schedule imagery during response verification`);
  }

  const browserFallback = powershellFunction(ui, "Open-AuraUiRescueInBrowser");
  assert.match(browserFallback,
    /Start-Process\s+-FilePath\s+['"]https:\/\/claude\.ai\/['"]/,
    "The explicit browser action must use a fixed trusted Claude URL");
  assert(!/WebView\.Source|ArgumentList|cmd(?:\.exe)?|explorer(?:\.exe)?/.test(browserFallback),
    "Browser escape must not forward mutable challenge URLs or construct a shell command");
  assert.match(ui,
    /\$script:RescueBrowserButton\.add_Click\(\{\s*Open-AuraUiRescueInBrowser\s*\}\)/,
    "The browser escape must be reachable only from an explicit native button click");

  const cleanLauncher = powershellFunction(ui, "Start-AuraUiCleanSessionProcess");
  assert.match(cleanLauncher, /-RescueSession/);
  assert.match(ui, /CreateCoreWebView2ControllerOptions\(\)/);
  assert.match(ui, /\.ProfileName\s*=\s*['"]ClaudeAuraRescue['"]/);
  assert.match(ui, /\.IsInPrivateModeEnabled\s*=\s*\$true/);
  assert.match(ui, /EnsureCoreWebView2Async\(\$environment,\s*\$controllerOptions\)/);
  assert.match(ui,
    /\$studioControllerOptions\.IsInPrivateModeEnabled\s*=\s*\$true[\s\S]{0,220}?\$script:StudioWebView\.EnsureCoreWebView2Async\(\s*\$environment,\s*\$studioControllerOptions\)/,
    "Studio must use the same temporary private profile during a clean session");
  assert(!/ClearBrowsingDataAsync|Profile\.Delete/.test(ui),
    "Rescue Mode must never clear or delete the normal Aura browser profile");
  assert(!/Remove-Item|Directory\]::Delete|File\]::Delete/.test(cleanLauncher),
    "The clean-session launcher must not delete profile files");

  const rescueKeys = [
    "rescueAccessibleName",
    "rescueEyebrow",
    "rescueTitle",
    "rescueBody",
    "rescueRepeatedBody",
    "rescuePrivateBody",
    "rescueAccessEyebrow",
    "rescueAccessTitle",
    "rescueAccessBody",
    "rescueAccessRepeatedBody",
    "rescueAccessPrivateBody",
    "rescueOpenBrowser",
    "rescueCleanSession",
    "rescueCleanSessionActive",
    "rescueRetryHere",
    "rescueRetrying",
    "rescueConfirmTitle",
    "rescueConfirmMessage",
    "rescueBrowserFailedTitle",
    "rescueBrowserFailedMessage",
    "rescueStartingCleanSession",
  ];
  for (const locale of ["en", "zh-CN", "zh-HKTW"]) {
    for (const key of rescueKeys) {
      assert.equal(typeof uiCopy[locale][key], "string", `${locale}.${key} is missing`);
      assert(uiCopy[locale][key].trim(), `${locale}.${key} is empty`);
      assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(uiCopy[locale][key]),
        `${locale}.${key} contains control characters`);
    }
  }
  assert.notEqual(uiCopy["zh-CN"].rescueBody, uiCopy["zh-HKTW"].rescueBody,
    "Simplified and Traditional Chinese Rescue copy must be independently written");
  assert.match(powershellFunction(ui, "Update-AuraUiRescueWindowCopy"),
    /\$script:UiCopy\.rescueBody/);
  const cleanRequest = powershellFunction(ui, "Request-AuraUiCleanSession");
  assert.match(cleanRequest,
    /\$rescueGeneration\s*=\s*\[long\]\$script:RescueGeneration[\s\S]*?MessageBox\]::Show[\s\S]*?\[long\]\$script:RescueGeneration\s+-ne\s+\$rescueGeneration[\s\S]*?\breturn\b/,
    "Clean-session confirmation must revalidate Rescue Mode after its modal message loop");
  assert.match(ui,
    /elseif\s*\(\$null\s+-ne\s+\$script:RescueChallengeCandidate\)[\s\S]{0,420}?Hide-AuraUiLoading/,
    "A verified candidate must keep the document visible before NavigationCompleted");

  const processFailedStart = ui.indexOf("$core.add_ProcessFailed({");
  const processFailedEnd = ui.indexOf("# Keyboard accelerators", processFailedStart);
  const processFailed = ui.slice(processFailedStart, processFailedEnd);
  assert.match(processFailed,
    /\$candidateNavigationId[\s\S]{0,360}?\$script:ActiveNavigationId\s*=\s*\$null[\s\S]{0,180}?\$script:ActiveNavigationUri\s*=\s*\$null[\s\S]{0,180}?Enter-AuraUiRescueMode/,
    "Process failure promotion must retire the active navigation before Rescue");

  const timerCatchStart = ui.indexOf(
    "} elseif ($null -ne $script:RescueChallengeCandidate)",
    processFailedEnd,
  );
  const timerCatch = ui.slice(timerCatchStart, timerCatchStart + 1800);
  assert(timerCatch.indexOf("$script:RescueActive -or $script:RescueVerificationPending")
    < timerCatch.indexOf("$script:PageReady"),
  "Rescue retry errors must use fixed logging before PageReady diagnostics");

  const mirrorDrain = powershellFunction(ui, "Update-AuraUiMirror");
  assert.match(mirrorDrain,
    /A stale mirror capture ended during navigation verification/);
  assert.match(mirrorDrain,
    /A stale mirror probe ended during navigation verification/);

  if (process.platform === "win32") {
    const windowRegression = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      `$uiPath='${uiPath.replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for native Rescue window regression'}",
      "$names=@('Update-AuraUiRescueWindowCopy','Update-AuraUiRescueWindowTheme','New-AuraUiRescueWindow')",
      "foreach($name in $names){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing native Rescue function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Get-AuraUiLoadingProfile { [PSCustomObject]@{Surface=[Drawing.Color]::White;Accent=[Drawing.Color]::Blue;AccentText=[Drawing.Color]::White;Text=[Drawing.Color]::Black;Muted=[Drawing.Color]::Gray;Border=[Drawing.Color]::Black;HighContrast=$false} }",
      "function Write-AuraUiLog { param([string]$Message) }",
      "$script:UiCopy=[PSCustomObject]@{rescueAccessibleName='Recovery';rescueEyebrow='Check';rescueTitle='Title';rescuePrivateBody='Private';rescueRepeatedBody='Repeated';rescueBody='Body';rescueOpenBrowser='Browser';rescueCleanSessionActive='Active';rescueCleanSession='Clean';rescueRetrying='Trying';rescueRetryHere='Retry'}",
      "$script:IsRescueSession=$false",
      "$script:RescueReason='Challenge'",
      "$script:RescueBreakerState='Closed'",
      "$script:Closing=$false",
      "$script:RescueForm=$null",
      "$window=New-AuraUiRescueWindow",
      "try {",
      "  if($window.Controls.Count -ne 7){throw 'Native Rescue window lost one of its controls'}",
      "  if($window.AcceptButton -ne $script:RescueBrowserButton){throw 'Browser continuation is not the default recovery action'}",
      "  if(-not $script:RescueCleanButton.Enabled -or -not $script:RescueRetryButton.Enabled){throw 'Recovery actions were not enabled'}",
      "  if($window.AccessibleName -cne 'Recovery' -or $window.Text -cne 'Recovery'){throw 'Native Rescue window lost its accessible title'}",
      "} finally { $window.Dispose() }",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-EncodedCommand",
      Buffer.from(windowRegression, "utf16le").toString("base64"),
    ]);
  }
});

test("Aura Rescue Mode never logs delayed stale mirror exceptions", async () => {
  const ui = await fs.readFile(uiPath, "utf8");
  const mirrorDrain = powershellFunction(ui, "Update-AuraUiMirror");
  assert.match(mirrorDrain,
    /\$captureGeneration\s+-ne\s+\$script:MirrorGeneration[\s\S]{0,280}?A stale mirror capture ended during navigation verification/,
    "A delayed stale capture must use fixed logging after the verification gate closes");
  assert.match(mirrorDrain,
    /\$probeGeneration\s+-ne\s+\$script:MirrorGeneration[\s\S]{0,280}?A stale mirror probe ended during navigation verification/,
    "A delayed stale probe must use fixed logging after the verification gate closes");

  if (process.platform === "win32") {
    const regression = [
      "$ErrorActionPreference='Stop'",
      "class AuraThrowingAwaiter { [object] GetResult() { throw 'https://claude.ai/chat/private?token=URL_CANARY' } }",
      "class AuraCompletedThrowingTask { [bool]$IsCompleted=$true; [AuraThrowingAwaiter] GetAwaiter() { return [AuraThrowingAwaiter]::new() } }",
      `$uiPath='${uiPath.replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for stale mirror regression'}",
      "$definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Update-AuraUiMirror'},$true)",
      "if($null -eq $definition){throw 'Missing Update-AuraUiMirror'}",
      "Invoke-Expression $definition.Extent.Text",
      "function Write-AuraUiLog { param([string]$Message);$script:logs+=@($Message) }",
      "function Start-AuraUiMirrorCapture {}",
      "$script:RescueActive=$false",
      "$script:RescueVerificationPending=$false",
      "$script:RescueChallengeCandidate=$null",
      "$script:MirrorGeneration=[long]2",
      "$script:MirrorCaptureGeneration=[long]1",
      "$script:MirrorCaptureTask=[AuraCompletedThrowingTask]::new()",
      "$script:MirrorStream=[IO.MemoryStream]::new()",
      "$script:MirrorCaptureSession=$null",
      "$script:MirrorCaptureRevision=[long]-1",
      "$script:MirrorCapturePreviewRequest=-1",
      "$script:logs=@()",
      "Update-AuraUiMirror",
      "if($script:logs.Count -ne 1 -or $script:logs[0] -cne 'A stale mirror capture ended during navigation verification.'){throw 'Delayed stale capture did not use fixed logging'}",
      "if(($script:logs -join '') -match 'URL_CANARY'){throw 'Delayed stale capture leaked its exception URL'}",
      "$script:MirrorProbeGeneration=[long]1",
      "$script:MirrorProbeTask=[AuraCompletedThrowingTask]::new()",
      "$script:MirrorGeometry=$null",
      "$script:MirrorSemanticRetries=0",
      "$script:MirrorSemanticPreviousContext=$null",
      "$script:logs=@()",
      "Update-AuraUiMirror",
      "if($script:logs.Count -ne 1 -or $script:logs[0] -cne 'A stale mirror probe ended during navigation verification.'){throw 'Delayed stale probe did not use fixed logging'}",
      "if(($script:logs -join '') -match 'URL_CANARY'){throw 'Delayed stale probe leaked its exception URL'}",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-EncodedCommand",
      Buffer.from(regression, "utf16le").toString("base64"),
    ]);
  }
});

test("a verified top-level response lets DOMContentLoaded theme before completion", async () => {
  const ui = await fs.readFile(uiPath, "utf8");
  const predicate = powershellFunction(ui, "Test-AuraUiVerifiedDocumentResponse");
  // The early-apply gate consumes the same evidence NavigationCompleted waits
  // for. It must never be reachable by a redirect, an error, or a challenge.
  assert(predicate.includes("$StatusCode -lt 200 -or $StatusCode -gt 299"),
    "Only a successful top-level status may count as verified");
  assert(predicate.includes("'challenge'"),
    "A Cloudflare challenge marker must still disqualify the response");
  assert(predicate.includes("return -not [string]::Equals("),
    "The predicate must answer the opposite question to the challenge classifier");
  assert(predicate.includes("Test-AuraUiClaudeUri -Value $RequestUri"),
    "Verification must stay scoped to a Claude origin");
  assert(predicate.includes("[StringComparison]::Ordinal)"),
    "The top-level identity match must stay ordinal");

  const startingStart = ui.indexOf("$core.add_NavigationStarting({");
  const startingEnd = ui.indexOf("$core.add_DOMContentLoaded({", startingStart);
  assert(ui.slice(startingStart, startingEnd).includes("$script:VerifiedNavigationId = $null"),
    "Every new navigation must retire the previous verification");

  const domStart = ui.indexOf("$core.add_DOMContentLoaded({", startingEnd);
  const domEnd = ui.indexOf("$core.add_NavigationCompleted({", domStart);
  const handler = ui.slice(domStart, domEnd);
  assert.match(handler, /VerifiedNavigationId[\s\S]{0,420}?Apply-AuraUiTheme/u,
    "Early theming must be gated on the verified navigation id");
  assert(!handler.includes("Hide-AuraUiLoading"),
    "Early theming must not take over the reveal NavigationCompleted owns");
  assert(!/\$script:PageReady\s*=\s*\$true/u.test(handler),
    "Early theming must not mark the page ready");
});

runIfMain(import.meta.url);
