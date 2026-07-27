import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  path,
} from "./support/context.mjs";

const handoffPath = path.join(PROJECT_ROOT, "windows", "aura-draft-handoff.ps1");
const shelfPath = path.join(PROJECT_ROOT, "windows", "aura-prompt-shelf.ps1");
const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");

const powershellFunction = (source, name) => {
  const start = source.indexOf(`function ${name} {`);
  assert(start >= 0, `draft-handoff-v1 is missing ${name}`);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
};

test("draft-handoff-v1 stays explicit, local, and disabled by default", async () => {
  const [handoff, ui] = await Promise.all([
    fs.readFile(handoffPath, "utf8"),
    fs.readFile(uiPath, "utf8"),
  ]);

  assert.match(ui, /\[switch\]\$ExperimentalDraftHandoff\b/,
    "Aura must require an explicit experimental launch switch");
  assert.match(ui, /\. \(Join-Path \$PSScriptRoot 'aura-draft-handoff\.ps1'\)/,
    "Aura must load the separate experimental transport module");
  assert.match(ui,
    /Initialize-AuraDraftHandoff -Enabled \(\[bool\]\$ExperimentalDraftHandoff\)/,
    "Normal Aura startup must leave draft handoff disabled");

  assert.match(handoff,
    /\$script:DraftHandoffRoot\s*=\s*Join-Path \$env:LOCALAPPDATA 'ClaudeAura\\draft-handoff-v1'/);
  assert.match(handoff,
    /\$script:DraftHandoffDescriptorPath\s*=\s*Join-Path \$script:DraftHandoffRoot 'descriptor\.json'/);
  assert.match(handoff,
    /\$script:DraftHandoffKeyPath\s*=\s*Join-Path \$script:DraftHandoffRoot 'key\.bin'/);
  assert.match(handoff, /\$script:DraftHandoffEnabled\s*=\s*\$false/);
  assert.match(handoff.trimEnd(), /Remove-AuraDraftHandoffDiscovery$/,
    "Loading the disabled module must remove stale crash discovery");

  const fixedPath = powershellFunction(handoff, "Assert-AuraDraftHandoffFixedPath");
  assert.match(fixedPath, /GetFullPath\(\$script:DraftHandoffRoot\)/);
  assert.match(fixedPath, /FileAttributes\]::ReparsePoint/);
  const secureAcl = powershellFunction(handoff, "Set-AuraDraftHandoffSecureAcl");
  assert.match(secureAcl, /WindowsIdentity\]::GetCurrent\(\)\.User/);
  assert.match(secureAcl, /SetAccessRuleProtection\(\$true, \$false\)/);
  assert.match(secureAcl, /FileSystemRights\]::FullControl/);

  const pipe = powershellFunction(handoff, "New-AuraDraftHandoffPipe");
  assert.match(pipe, /PipeSecurity\]::new\(\)/);
  assert.match(pipe, /SetAccessRuleProtection\(\$true, \$false\)/);
  assert.match(pipe, /PipeAccessRights\]::FullControl/);
  assert.match(pipe, /NamedPipeServerStream\]::new\(/);
  assert.match(pipe, /PipeTransmissionMode\]::Byte/);
  assert.match(pipe, /PipeOptions\]::Asynchronous/);
  const localClient = powershellFunction(handoff, "Test-AuraDraftHandoffLocalClient");
  for (const boundary of [
    "GetNamedPipeClientComputerName",
    "GetNamedPipeClientProcessId",
    "SessionId",
    "GetNamedPipeClientSid",
  ]) assert(localClient.includes(boundary), `Local client gate omits ${boundary}`);

  assert.doesNotMatch(handoff,
    /\b(?:TcpClient|TcpListener|HttpClient|WebSocket|Invoke-WebRequest|Invoke-RestMethod)\b/i,
    "The experimental transport must not add a network endpoint");
  assert.doesNotMatch(handoff,
    /\b(?:Clipboard|Get-Clipboard|Set-Clipboard|ExecuteScriptAsync|WebMessageReceived)\b/i,
    "The transport must not inspect clipboard or page content");
});

test("draft-handoff-v1 authenticates exact one-shot receipts without content logging", async () => {
  const [handoff, shelf] = await Promise.all([
    fs.readFile(handoffPath, "utf8"),
    fs.readFile(shelfPath, "utf8"),
  ]);

  for (const name of [
    "ConvertFrom-AuraDraftHandoffControlBytes",
    "Test-AuraDraftHandoffExactFields",
    "Get-AuraDraftHandoffMac",
    "Test-AuraDraftHandoffMac",
    "Test-AuraDraftHandoffClientHello",
    "Test-AuraDraftHandoffBodyProof",
    "New-AuraDraftHandoffReceipt",
    "Publish-AuraDraftHandoffTransient",
    "Invoke-AuraDraftHandoffInsertTransient",
    "Complete-AuraDraftHandoffInsert",
    "Invalidate-AuraDraftHandoffTarget",
    "Update-AuraDraftHandoff",
    "Dispose-AuraDraftHandoff",
  ]) powershellFunction(handoff, name);

  const controlParser = powershellFunction(
    handoff, "ConvertFrom-AuraDraftHandoffControlBytes");
  assert.match(controlParser, /DraftHandoffMaxControlBytes/);
  assert.match(controlParser, /DraftHandoffUtf8\.GetString\(\$Bytes\)/);
  assert.match(controlParser,
    /ConvertTo-Json -Compress -Depth 4[\s\S]*?\$canonical -cne \$text/,
    "Control frames must have one canonical exact JSON representation");

  const mac = powershellFunction(handoff, "Get-AuraDraftHandoffMac");
  assert.match(mac, /HMACSHA256/);
  assert.match(mac, /draft-handoff-v1`0\$Label`0/);
  assert.match(mac, /\[Array\]::Clear\(\$input, 0, \$input\.Length\)/);
  const verifyMac = powershellFunction(handoff, "Test-AuraDraftHandoffMac");
  assert.match(verifyMac, /-bor \(\$expected\[\$index\] -bxor \$actual\[\$index\]\)/,
    "MAC comparison must not return on the first mismatched byte");

  const hello = powershellFunction(handoff, "Test-AuraDraftHandoffClientHello");
  for (const correlation of [
    "commandId",
    "commandSequence",
    "authorizationId",
    "localTargetId",
    "adapterEpoch",
    "navigationEpoch",
    "clientNonce",
    "bodyBytes",
    "expiresAt",
  ]) assert(hello.includes(`'${correlation}'`) || hello.includes(`.${correlation}`),
    `Client hello omits ${correlation}`);
  assert.match(hello, /Test-AuraDraftHandoffExactFields/);
  assert.match(hello, /Test-AuraDraftHandoffMac/);
  assert.match(hello,
    /\$Message\.commandId -cne \$script:DraftHandoffDescriptor\.commandId[\s\S]{0,180}?\$Message\.commandSequence[\s\S]{0,120}?\$script:DraftHandoffDescriptor\.commandSequence/,
    "A valid hello must match the one advertised command id and sequence");
  const bodyProof = powershellFunction(handoff, "Test-AuraDraftHandoffBodyProof");
  assert.match(bodyProof, /'commandId', 'commandSequence'/);
  assert.match(bodyProof,
    /\$hello\.commandId -cne \$script:DraftHandoffDescriptor\.commandId[\s\S]{0,180}?\$hello\.commandSequence[\s\S]{0,120}?\$script:DraftHandoffDescriptor\.commandSequence/,
    "Body authentication must remain bound to the advertised command id and sequence");

  const receipt = powershellFunction(handoff, "New-AuraDraftHandoffReceipt");
  assert.match(receipt, /ValidateSet\('review-ready', 'user-inserted'\)/);
  assert.match(receipt, /commandSequence = \[long\]\$hello\.commandSequence/);
  assert.match(receipt, /sequence = if \(\$review\) \{ 1 \} else \{ 2 \}/);
  assert.match(receipt, /certainty = 'certain'/);
  assert.match(receipt, /draft-handoff-receipt:\$Phase/);
  assert.doesNotMatch(receipt, /\b(?:body|text|prompt|response|account)\b/i,
    "Receipts must not carry provider content");

  const update = powershellFunction(handoff, "Update-AuraDraftHandoff");
  assert.match(update,
    /\$script:DraftHandoffAttemptConsumed\s*=\s*\$true[\s\S]{0,300}?Remove-Item -LiteralPath \$script:DraftHandoffDescriptorPath/,
    "Accepting a body-bearing attempt must consume discovery before transfer");
  assert.match(update,
    /New-AuraDraftHandoffReceipt -Phase 'review-ready'[\s\S]*?'waiting-insert'[\s\S]*?New-AuraDraftHandoffReceipt -Phase 'user-inserted'/,
    "The insertion receipt must follow review readiness and an explicit user action");
  assert.doesNotMatch(update, /Invoke-AuraDraftHandoffInsertTransient/,
    "The transport loop must never trigger insertion itself");

  const initialize = powershellFunction(handoff, "Initialize-AuraDraftHandoff");
  assert.match(initialize,
    /commandId = \[Guid\]::NewGuid\(\)\.ToString\(\)[\s\S]{0,120}?commandSequence = \[long\]\$now/,
    "Each advertised grant must bind one fresh command id to one monotonic sequence");

  const failure = powershellFunction(handoff, "Stop-AuraDraftHandoffAfterFailure");
  assert.match(failure, /-not \$script:DraftHandoffAttemptConsumed/);
  assert.match(failure, /Dispose-AuraDraftHandoff/,
    "A possibly accepted attempt must fail closed without automatic replay");

  const eventWriter = powershellFunction(handoff, "Write-AuraDraftHandoffEvent");
  assert.match(eventWriter,
    /param\(\[Parameter\(Mandatory = \$true\)\]\[string\]\$Code\)/);
  assert.doesNotMatch(eventWriter, /\$(?:Body|Text|Prompt|Response|Account)\b/i);
  assert.equal((handoff.match(/Write-AuraUiLog/g) ?? []).length, 1,
    "All draft-handoff logging must pass through one body-free event boundary");

  const publish = powershellFunction(handoff, "Publish-AuraDraftHandoffTransient");
  assert.match(publish, /Test-AuraPromptShelfText -Text \$text/);
  assert.match(publish, /Show-AuraPromptShelf/);
  assert.match(publish, /\$script:PromptShelfDraftBox\.Text\s*=\s*\$text/);
  assert.doesNotMatch(publish,
    /\b(?:Save-AuraPromptShelfCandidate|Write-AuraPromptShelfItems|WriteAllBytes|Set-Content|Add-Content|Out-File)\b/,
    "A transient body must never enter Prompt Shelf persistence");

  const addOrSave = powershellFunction(shelf, "Invoke-AuraPromptShelfAddOrSave");
  assert.match(addOrSave,
    /Test-AuraDraftHandoffTransientActive[\s\S]{0,180}?return/,
    "Prompt Shelf persistence must reject an active transient body");
  const actions = powershellFunction(shelf, "Update-AuraPromptShelfActions");
  assert.match(actions,
    /PromptShelfAddButton\.Enabled[\s\S]{0,180}?-not \$draftHandoff/,
    "The Save action must stay disabled while a transient body is visible");

  const dispose = powershellFunction(handoff, "Dispose-AuraDraftHandoff");
  assert.match(dispose,
    /\[Array\]::Clear\(\$script:DraftHandoffKey, 0, \$script:DraftHandoffKey\.Length\)/);
  assert.match(dispose, /Remove-AuraDraftHandoffDiscovery/);
});

runIfMain(import.meta.url);
