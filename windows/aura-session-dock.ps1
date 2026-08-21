# Claude Aura recent-session projection for the native pet runway.
#
# Aura stores the private Claude route only inside this DPAPI-protected history.
# The companion receives opaque local IDs, prefixed titles, local timestamps,
# active/open/past navigation state, and body-free request evidence. Prompt text
# is accepted only for an explicit Queue or Steer command, remains in memory,
# and is never written to history or logs.

$script:AuraSessionDockContractId = 'gemini-aura-session-dock-v2'
$script:AuraSessionDockFrameMaximumBytes = 32768
$script:AuraSessionDockTextMaximum = 8000
$script:AuraSessionHistoryLimit = 100
$script:AuraSessionProjectionLimit = 12
$script:AuraSessionHistoryRoot = Join-Path $DataRoot 'session-history'
$script:AuraSessionHistoryPath = Join-Path $script:AuraSessionHistoryRoot 'sessions.bin'
$script:AuraSessionHistoryMagic = [Text.Encoding]::ASCII.GetBytes("CLAUDE-AURA-SESSIONS-1`n")
$script:AuraSessionHistoryEntropy = [Text.Encoding]::UTF8.GetBytes('ClaudeAura.SessionHistory.v1')
$script:AuraSessionHistoryMaximumBytes = 512 * 1024
$script:AuraSessionHistoryDocument = $null
$script:AuraSessionProjectionSequence = [long]0
$script:AuraSessionProjectionRevision = [long]0
$script:AuraSessionProjectionChangedAt = [long]0
$script:AuraSessionProjectionFingerprint = $null
$script:AuraSessionWorkHubRevision = [long]0
$script:AuraSessionWorkHubChangedAt = [long]0
$script:AuraSessionWorkHubFingerprint = $null
$script:AuraSessionResponseRequests = @{}
$script:AuraSessionResponseLiveByRoute = @{}
$script:AuraSessionResponseChangedAtByRoute = @{}
$script:AuraSessionResponseObservers = @{}
$script:AuraSessionDockReceipts = [Collections.Specialized.OrderedDictionary]::new()
$script:AuraSessionDockPromptOperations = [Collections.Specialized.OrderedDictionary]::new()
$script:AuraSessionDockDiscoveryRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\pet-plugin'
$script:AuraSessionDockDiscoveryPath = Join-Path $script:AuraSessionDockDiscoveryRoot 'session-dock-v2.json'
$script:AuraSessionDockInitialized = $false
$script:AuraSessionDockInstanceId = ''
$script:AuraSessionDockPipeName = ''
$script:AuraSessionDockToken = ''
$script:AuraSessionDockPipe = $null
$script:AuraSessionDockAcceptTask = $null
$script:AuraSessionDockReadTask = $null
$script:AuraSessionDockReadBuffer = $null
$script:AuraSessionDockInbound = [byte[]]::new(0)
$script:AuraSessionDockWriteTask = $null
$script:AuraSessionDockWriteBuffer = $null
$script:AuraSessionDockWriteQueue = [Collections.Generic.Queue[byte[]]]::new()
$script:AuraSessionDockAuthenticated = $false
$script:AuraSessionDockLastProjectionRevision = [long]-1
$script:AuraSessionDockUtf8 = [Text.UTF8Encoding]::new($false, $true)
$script:AuraSessionAccountTransitionActive = $false

function Test-AuraSessionDockUuid {
  param([AllowEmptyString()][string]$Value)
  return $Value -cmatch '^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
}

function Test-AuraSessionDockInteger {
  param([AllowNull()][object]$Value)
  return ($Value -is [int] -or $Value -is [long]) -and
    [long]$Value -ge 0 -and [long]$Value -le 9007199254740991
}

function Test-AuraSessionDockText {
  param(
    [AllowEmptyString()][string]$Value,
    [Parameter(Mandatory = $true)][int]$Maximum,
    [switch]$Required
  )
  if ($null -eq $Value -or $Value.Length -gt $Maximum) { return $false }
  if ($Required -and [string]::IsNullOrWhiteSpace($Value)) { return $false }
  $pattern = if ($Maximum -eq $script:AuraSessionDockTextMaximum) {
    '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]'
  } else { '[\x00-\x1F\x7F]' }
  return -not [regex]::IsMatch($Value, $pattern)
}

function ConvertTo-AuraSessionRoute {
  param([AllowNull()][object]$Value)
  $uri = $null
  if ($Value -is [Uri]) { $uri = $Value }
  elseif ($Value -is [string] -and
      [Uri]::TryCreate([string]$Value, [UriKind]::Absolute, [ref]$uri)) {}
  else { return $null }
  if ($uri.Scheme -cne [Uri]::UriSchemeHttps -or $uri.Host -cne 'claude.ai' -or
      -not $uri.IsDefaultPort -or $uri.UserInfo.Length -ne 0) { return $null }
  $match = [regex]::Match(
    $uri.AbsolutePath,
    '^/(?<kind>chat|code)/(?<key>[A-Za-z0-9_-]+)$',
    [Text.RegularExpressions.RegexOptions]::CultureInvariant)
  if (-not $match.Success) { return $null }
  $kind = if ($match.Groups['kind'].Value -ceq 'code') { 'code' } else { 'chat' }
  return [PSCustomObject][ordered]@{
    kind = $kind
    route = "https://claude.ai/$kind/$($match.Groups['key'].Value)"
  }
}

function New-AuraSessionHistoryDocument {
  return [PSCustomObject][ordered]@{
    schemaVersion = 2
    revision = [long]0
    changedAt = [long]0
    sessions = @()
  }
}

function ConvertTo-AuraSessionHistoryDocument {
  param([Parameter(Mandatory = $true)][object]$Value)
  $names = @($Value.PSObject.Properties | ForEach-Object { $_.Name })
  if ($null -eq $Value -or $Value -is [string] -or $Value -is [Array] -or
      $names.Count -ne 4 -or $names -cnotcontains 'schemaVersion' -or
      $names -cnotcontains 'revision' -or $names -cnotcontains 'changedAt' -or
      $names -cnotcontains 'sessions' -or $Value.schemaVersion -notin @(1, 2) -or
      -not (Test-AuraSessionDockInteger -Value $Value.revision) -or
      -not (Test-AuraSessionDockInteger -Value $Value.changedAt) -or
      $Value.sessions -is [string]) {
    throw 'Aura session history has an invalid shape.'
  }
  $rawSessions = @($Value.sessions)
  if ($rawSessions.Count -gt $script:AuraSessionHistoryLimit) {
    throw 'Aura session history exceeds its limit.'
  }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $routes = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $sessions = @()
  foreach ($session in $rawSessions) {
    $sessionNames = @($session.PSObject.Properties | ForEach-Object { $_.Name })
    $route = ConvertTo-AuraSessionRoute -Value $session.route
    $legacy = [int]$Value.schemaVersion -eq 1
    $expectedSessionFields = if ($legacy) { 6 } else { 8 }
    $responseState = if ($legacy) { 'unknown' } else { [string]$session.responseState }
    $responseChangedAt = if ($legacy) { $null } else { $session.responseChangedAt }
    if ($null -eq $session -or $session -is [string] -or $session -is [Array] -or
        $sessionNames.Count -ne $expectedSessionFields -or $sessionNames -cnotcontains 'id' -or
        $sessionNames -cnotcontains 'kind' -or $sessionNames -cnotcontains 'route' -or
        $sessionNames -cnotcontains 'title' -or $sessionNames -cnotcontains 'firstSeenAt' -or
        $sessionNames -cnotcontains 'lastOpenedAt' -or
        (-not $legacy -and ($sessionNames -cnotcontains 'responseState' -or
          $sessionNames -cnotcontains 'responseChangedAt')) -or
        $session.id -isnot [string] -or
        -not (Test-AuraSessionDockUuid -Value ([string]$session.id)) -or
        -not $ids.Add([string]$session.id) -or $null -eq $route -or
        [string]$session.kind -cne [string]$route.kind -or
        -not $routes.Add([string]$route.route) -or
        $session.title -isnot [string] -or
        -not (Test-AuraSessionDockText -Value ([string]$session.title) -Maximum 140 -Required) -or
        -not (Test-AuraSessionDockInteger -Value $session.firstSeenAt) -or
        -not (Test-AuraSessionDockInteger -Value $session.lastOpenedAt) -or
        [long]$session.lastOpenedAt -lt [long]$session.firstSeenAt -or
        $responseState -notin @('unknown', 'completed', 'failed') -or
        (($responseState -ceq 'unknown') -ne ($null -eq $responseChangedAt)) -or
        ($null -ne $responseChangedAt -and
          -not (Test-AuraSessionDockInteger -Value $responseChangedAt))) {
      throw 'Aura session history entry is invalid.'
    }
    $sessions += [PSCustomObject][ordered]@{
      id = [string]$session.id
      kind = [string]$route.kind
      route = [string]$route.route
      title = [string]$session.title
      firstSeenAt = [long]$session.firstSeenAt
      lastOpenedAt = [long]$session.lastOpenedAt
      responseState = $responseState
      responseChangedAt = if ($null -eq $responseChangedAt) { $null } else { [long]$responseChangedAt }
    }
  }
  return [PSCustomObject][ordered]@{
    schemaVersion = 2
    revision = [long]$Value.revision
    changedAt = [long]$Value.changedAt
    sessions = @($sessions)
  }
}

function Initialize-AuraSessionHistoryStorage {
  param([string]$Path = $script:AuraSessionHistoryPath)
  Add-Type -AssemblyName System.Security -ErrorAction Stop
  $fullPath = [IO.Path]::GetFullPath($Path)
  $root = [IO.Path]::GetFullPath($script:AuraSessionHistoryRoot)
  if (-not [string]::Equals(
      [IO.Path]::GetFullPath((Split-Path -Parent $fullPath)), $root,
      [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Aura session history escaped its data directory.'
  }
  Assert-AuraTaskboardNotReparsePoint -Path $DataRoot
  [void][IO.Directory]::CreateDirectory($root)
  Set-AuraTaskboardSecureAcl -Path $root -Directory
  return $fullPath
}

function Read-AuraSessionHistoryDocument {
  param([string]$Path = $script:AuraSessionHistoryPath)
  $Path = Initialize-AuraSessionHistoryStorage -Path $Path
  if (-not (Test-Path -LiteralPath $Path)) { return New-AuraSessionHistoryDocument }
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw 'Aura session history path is invalid.'
  }
  Assert-AuraTaskboardNotReparsePoint -Path $Path
  Set-AuraTaskboardSecureAcl -Path $Path
  $envelope = [IO.File]::ReadAllBytes($Path)
  $cipher = $null
  $plain = $null
  try {
    if ($envelope.Length -le $script:AuraSessionHistoryMagic.Length -or
        $envelope.Length -gt ($script:AuraSessionHistoryMaximumBytes + 4096)) {
      throw 'Aura session history has an invalid size.'
    }
    for ($index = 0; $index -lt $script:AuraSessionHistoryMagic.Length; $index += 1) {
      if ($envelope[$index] -ne $script:AuraSessionHistoryMagic[$index]) {
        throw 'Aura session history has an invalid header.'
      }
    }
    $cipher = [byte[]]::new($envelope.Length - $script:AuraSessionHistoryMagic.Length)
    [Array]::Copy($envelope, $script:AuraSessionHistoryMagic.Length, $cipher, 0, $cipher.Length)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect(
      $cipher, $script:AuraSessionHistoryEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $json = [Text.UTF8Encoding]::new($false, $true).GetString($plain)
    return ConvertTo-AuraSessionHistoryDocument -Value ($json | ConvertFrom-Json)
  } finally {
    if ($null -ne $plain) { [Array]::Clear($plain, 0, $plain.Length) }
    if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
    if ($null -ne $envelope) { [Array]::Clear($envelope, 0, $envelope.Length) }
  }
}

function Write-AuraSessionHistoryDocument {
  param(
    [Parameter(Mandatory = $true)][object]$Document,
    [string]$Path = $script:AuraSessionHistoryPath
  )
  $normalized = ConvertTo-AuraSessionHistoryDocument -Value $Document
  $plain = [Text.UTF8Encoding]::new($false).GetBytes(
    (($normalized | ConvertTo-Json -Depth 8 -Compress) + [Environment]::NewLine))
  if ($plain.Length -gt $script:AuraSessionHistoryMaximumBytes) {
    [Array]::Clear($plain, 0, $plain.Length)
    throw 'Aura session history exceeds its byte limit.'
  }
  $Path = Initialize-AuraSessionHistoryStorage -Path $Path
  $directory = Split-Path -Parent $Path
  $temporary = Join-Path $directory ('.sessions-{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
  $backup = Join-Path $directory ('.sessions-{0}.bak' -f [Guid]::NewGuid().ToString('N'))
  $cipher = $null
  $envelope = $null
  $hadExisting = Test-Path -LiteralPath $Path -PathType Leaf
  try {
    $cipher = [Security.Cryptography.ProtectedData]::Protect(
      $plain, $script:AuraSessionHistoryEntropy,
      [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $envelope = [byte[]]::new($script:AuraSessionHistoryMagic.Length + $cipher.Length)
    [Array]::Copy($script:AuraSessionHistoryMagic, 0, $envelope, 0, $script:AuraSessionHistoryMagic.Length)
    [Array]::Copy($cipher, 0, $envelope, $script:AuraSessionHistoryMagic.Length, $cipher.Length)
    [IO.File]::WriteAllBytes($temporary, $envelope)
    Set-AuraTaskboardSecureAcl -Path $temporary
    if ($hadExisting) { [IO.File]::Replace($temporary, $Path, $backup, $true) }
    else { [IO.File]::Move($temporary, $Path) }
    Set-AuraTaskboardSecureAcl -Path $Path
    $verified = Read-AuraSessionHistoryDocument -Path $Path
    if (Test-Path -LiteralPath $backup -PathType Leaf) { Remove-Item -LiteralPath $backup -Force }
    return $verified
  } finally {
    [Array]::Clear($plain, 0, $plain.Length)
    if ($null -ne $cipher) { [Array]::Clear($cipher, 0, $cipher.Length) }
    if ($null -ne $envelope) { [Array]::Clear($envelope, 0, $envelope.Length) }
    foreach ($candidate in @($temporary, $backup)) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        try { Remove-Item -LiteralPath $candidate -Force } catch {}
      }
    }
  }
}

function Publish-AuraSessionBoardInvalidation {
  $json = '{"type":"session-board-invalidate","version":1}'
  $delivered = $false
  foreach ($name in @('StudioWebView', 'AuraWebTabWorkHubWebView')) {
    $variable = Get-Variable -Name $name -Scope Script -ErrorAction SilentlyContinue
    if ($null -eq $variable) { continue }
    $view = $variable.Value
    if ($null -eq $view -or $view.IsDisposed -or $null -eq $view.CoreWebView2) { continue }
    try {
      $view.CoreWebView2.PostWebMessageAsJson($json)
      $delivered = $true
    } catch {}
  }
  return $delivered
}

function Reset-AuraSessionHistoryForAccountTransition {
  if ($script:AuraSessionAccountTransitionActive) { return $false }
  $script:AuraSessionAccountTransitionActive = $true
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $previousRevision = if ($null -ne $script:AuraSessionHistoryDocument) {
    [long]$script:AuraSessionHistoryDocument.revision
  } else { [long]0 }
  $document = New-AuraSessionHistoryDocument
  $document.revision = [long][Math]::Min(9007199254740991, $previousRevision + 1)
  $document.changedAt = [long]$now
  try {
    $script:AuraSessionHistoryDocument = Write-AuraSessionHistoryDocument -Document $document
  } catch {
    $script:AuraSessionHistoryDocument = $document
    if (Get-Command Write-AuraUiLog -ErrorAction SilentlyContinue) {
      Write-AuraUiLog -Message 'Aura could not persist the account-transition session reset.'
    }
  }
  $script:AuraSessionResponseRequests.Clear()
  $script:AuraSessionResponseLiveByRoute.Clear()
  $script:AuraSessionResponseChangedAtByRoute.Clear()
  $script:AuraSessionResponseObservers.Clear()
  $script:AuraSessionDockReceipts.Clear()
  $script:AuraSessionDockPromptOperations.Clear()
  $script:AuraSessionProjectionFingerprint = $null
  $script:AuraSessionWorkHubFingerprint = $null
  [void](Publish-AuraSessionBoardInvalidation)
  return $true
}

function Register-AuraSessionObservation {
  param(
    [Parameter(Mandatory = $true)][object]$Url,
    [Parameter(Mandatory = $true)][string]$Title,
    [long]$ObservedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(),
    [switch]$Opened
  )
  $route = ConvertTo-AuraSessionRoute -Value $Url
  if ($null -eq $route -or
      -not (Test-AuraSessionDockText -Value $Title -Maximum 140 -Required) -or
      -not (Test-AuraSessionDockInteger -Value $ObservedAt)) { return $false }
  $script:AuraSessionAccountTransitionActive = $false
  if ($null -eq $script:AuraSessionHistoryDocument) {
    try { $script:AuraSessionHistoryDocument = Read-AuraSessionHistoryDocument }
    catch { $script:AuraSessionHistoryDocument = New-AuraSessionHistoryDocument }
  }
  $changed = $false
  $session = @($script:AuraSessionHistoryDocument.sessions | Where-Object {
    [string]$_.route -ceq [string]$route.route
  })[0]
  if ($null -eq $session) {
    $session = [PSCustomObject][ordered]@{
      id = [Guid]::NewGuid().ToString('D').ToLowerInvariant()
      kind = [string]$route.kind
      route = [string]$route.route
      title = $Title.Trim()
      firstSeenAt = [long]$ObservedAt
      lastOpenedAt = [long]$ObservedAt
      responseState = 'unknown'
      responseChangedAt = $null
    }
    $script:AuraSessionHistoryDocument.sessions = @($script:AuraSessionHistoryDocument.sessions) + $session
    $changed = $true
  } else {
    if ([string]$session.title -cne $Title.Trim()) {
      $session.title = $Title.Trim()
      $changed = $true
    }
    if ($Opened -and [long]$ObservedAt -gt [long]$session.lastOpenedAt) {
      $session.lastOpenedAt = [long]$ObservedAt
      $changed = $true
    }
  }
  if (-not $changed) { return $true }
  $script:AuraSessionHistoryDocument.sessions = @(
    $script:AuraSessionHistoryDocument.sessions |
      Sort-Object -Property @{ Expression = { [long]$_.lastOpenedAt }; Descending = $true },
        @{ Expression = { [string]$_.id }; Descending = $false } |
      Select-Object -First $script:AuraSessionHistoryLimit)
  $script:AuraSessionHistoryDocument.revision = [long]$script:AuraSessionHistoryDocument.revision + 1
  $script:AuraSessionHistoryDocument.changedAt = [long][Math]::Max(
    [long]$script:AuraSessionHistoryDocument.changedAt, [long]$ObservedAt)
  try {
    $script:AuraSessionHistoryDocument = Write-AuraSessionHistoryDocument `
      -Document $script:AuraSessionHistoryDocument
  } catch {
    try { Write-AuraUiLog -Message 'Recent session history could not be saved.' } catch {}
    return $false
  }
  if (Get-Command Request-AuraUiHostWork -ErrorAction SilentlyContinue) {
    try { Request-AuraUiHostWork } catch {}
  }
  return $true
}

function Get-AuraSessionRouteForTabId {
  param([Parameter(Mandatory = $true)][string]$TabId)
  if ($null -eq $script:AuraWebTabDocument) { return $null }
  $tab = @($script:AuraWebTabDocument.tabs | Where-Object {
    [string]$_.id -ceq $TabId
  })[0]
  if ($null -eq $tab) { return $null }
  return ConvertTo-AuraSessionRoute -Value $tab.url
}

function Test-AuraSessionResponseRequest {
  param(
    [AllowEmptyString()][string]$Method,
    [AllowEmptyString()][string]$Url
  )
  if ($Method -cne 'POST') { return $false }
  $uri = $null
  if (-not [Uri]::TryCreate($Url, [UriKind]::Absolute, [ref]$uri) -or
      $uri.Scheme -cne [Uri]::UriSchemeHttps -or $uri.Host -cne 'claude.ai' -or
      -not $uri.IsDefaultPort -or $uri.UserInfo.Length -ne 0) { return $false }
  return [regex]::IsMatch(
    $uri.AbsolutePath,
    '^/api/organizations/[^/]{1,160}/chat_conversations/[^/]{1,160}/(?:retry_)?completion$',
    [Text.RegularExpressions.RegexOptions]::CultureInvariant)
}

function Start-AuraSessionResponseObservation {
  param(
    [Parameter(Mandatory = $true)][string]$TabId,
    [Parameter(Mandatory = $true)][string]$RequestId,
    [AllowEmptyString()][string]$RequestUrl = '',
    [long]$ObservedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  )
  if (-not (Test-AuraSessionDockText -Value $RequestId -Maximum 256 -Required) -or
      -not (Test-AuraSessionDockInteger -Value $ObservedAt) -or
      $script:AuraSessionResponseRequests.ContainsKey($RequestId)) { return $false }
  $route = Get-AuraSessionRouteForTabId -TabId $TabId
  if ($null -eq $route -or [string]$route.kind -cne 'chat') { return $false }
  $session = @($script:AuraSessionHistoryDocument.sessions | Where-Object {
    [string]$_.route -ceq [string]$route.route
  })[0]
  if ($null -eq $session) { return $false }
  $routeKey = [string]$route.route
  $script:AuraSessionResponseRequests[$RequestId] = [PSCustomObject][ordered]@{
    RequestId = $RequestId
    TabId = $TabId
    Route = $routeKey
    RequestUrl = $RequestUrl
    StartedAt = [long]$ObservedAt
    DeadlineUtc = [DateTime]::UtcNow.AddMinutes(2)
  }
  $count = if ($script:AuraSessionResponseLiveByRoute.ContainsKey($routeKey)) {
    [int]$script:AuraSessionResponseLiveByRoute[$routeKey]
  } else { 0 }
  $script:AuraSessionResponseLiveByRoute[$routeKey] = $count + 1
  if ($count -eq 0) {
    $script:AuraSessionResponseChangedAtByRoute[$routeKey] = [long]$ObservedAt
  }
  if (Get-Command Request-AuraUiHostWork -ErrorAction SilentlyContinue) {
    try { Request-AuraUiHostWork } catch {}
  }
  return $true
}

function Stop-AuraSessionResponseObservation {
  param([Parameter(Mandatory = $true)][string]$RequestId)
  if (-not $script:AuraSessionResponseRequests.ContainsKey($RequestId)) { return $null }
  $record = $script:AuraSessionResponseRequests[$RequestId]
  [void]$script:AuraSessionResponseRequests.Remove($RequestId)
  $routeKey = [string]$record.Route
  $count = if ($script:AuraSessionResponseLiveByRoute.ContainsKey($routeKey)) {
    [int]$script:AuraSessionResponseLiveByRoute[$routeKey]
  } else { 0 }
  if ($count -le 1) {
    [void]$script:AuraSessionResponseLiveByRoute.Remove($routeKey)
    [void]$script:AuraSessionResponseChangedAtByRoute.Remove($routeKey)
  } else {
    $script:AuraSessionResponseLiveByRoute[$routeKey] = $count - 1
  }
  return $record
}

function Complete-AuraSessionResponseObservation {
  param(
    [Parameter(Mandatory = $true)][string]$RequestId,
    [Parameter(Mandatory = $true)][ValidateSet('unknown', 'completed', 'failed')][string]$Outcome,
    [long]$ObservedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  )
  if (-not (Test-AuraSessionDockInteger -Value $ObservedAt)) { return $false }
  $record = Stop-AuraSessionResponseObservation -RequestId $RequestId
  if ($null -eq $record) { return $false }
  $session = @($script:AuraSessionHistoryDocument.sessions | Where-Object {
    [string]$_.route -ceq [string]$record.Route
  })[0]
  if ($null -eq $session) { return $false }
  $session.responseState = $Outcome
  $session.responseChangedAt = if ($Outcome -ceq 'unknown') {
    $null
  } else { [long][Math]::Max([long]$session.firstSeenAt, $ObservedAt) }
  $script:AuraSessionHistoryDocument.revision = [long]$script:AuraSessionHistoryDocument.revision + 1
  $script:AuraSessionHistoryDocument.changedAt = [long][Math]::Max(
    [long]$script:AuraSessionHistoryDocument.changedAt, $ObservedAt)
  try {
    $script:AuraSessionHistoryDocument = Write-AuraSessionHistoryDocument `
      -Document $script:AuraSessionHistoryDocument
  } catch {
    try { Write-AuraUiLog -Message 'Recent session request evidence could not be saved.' } catch {}
    return $false
  }
  if (Get-Command Request-AuraUiHostWork -ErrorAction SilentlyContinue) {
    try { Request-AuraUiHostWork } catch {}
  }
  return $true
}

function Receive-AuraSessionResponseRequestEvent {
  param(
    [Parameter(Mandatory = $true)][string]$TabId,
    [AllowEmptyString()][string]$Method,
    [AllowEmptyString()][string]$Url
  )
  if (-not (Test-AuraSessionResponseRequest -Method $Method -Url $Url)) { return $false }
  $requestId = [Guid]::NewGuid().ToString('N')
  return Start-AuraSessionResponseObservation -TabId $TabId -RequestId $requestId `
    -RequestUrl $Url
}

function Receive-AuraSessionResponseEvent {
  param(
    [Parameter(Mandatory = $true)][string]$TabId,
    [AllowEmptyString()][string]$Method,
    [AllowEmptyString()][string]$Url,
    [int]$StatusCode = 0
  )
  if (-not (Test-AuraSessionResponseRequest -Method $Method -Url $Url)) { return $false }
  $record = @($script:AuraSessionResponseRequests.Values | Where-Object {
      [string]$_.TabId -ceq $TabId -and [string]$_.RequestUrl -ceq $Url
    } | Sort-Object -Property @{ Expression = { [long]$_.StartedAt }; Descending = $false },
      @{ Expression = { [string]$_.RequestId }; Descending = $false } |
    Select-Object -First 1)[0]
  if ($null -eq $record) { return $false }
  $outcome = if ($StatusCode -ge 200 -and $StatusCode -lt 300) {
    'completed'
  } elseif ($StatusCode -ge 100 -and $StatusCode -le 599) {
    'failed'
  } else { 'unknown' }
  return Complete-AuraSessionResponseObservation -RequestId ([string]$record.RequestId) `
    -Outcome $outcome
}

function Register-AuraSessionResponseObserver {
  param(
    [Parameter(Mandatory = $true)][object]$Core,
    [Parameter(Mandatory = $true)][string]$TabId
  )
  if ($script:AuraSessionResponseObservers.ContainsKey($TabId)) { return $true }
  $filter = '*'
  $context = 'All'
  $sourceKinds = 'All'
  $requestHandler = $null
  $responseHandler = $null
  $filterAdded = $false
  try {
    $capturedTabId = $TabId
    $requestHandler = {
      param($sender, $eventArgs)
      try {
        [void](Receive-AuraSessionResponseRequestEvent -TabId $capturedTabId `
          -Method ([string]$eventArgs.Request.Method) -Url ([string]$eventArgs.Request.Uri))
      } catch {}
    }.GetNewClosure()
    $responseHandler = {
      param($sender, $eventArgs)
      try {
        [void](Receive-AuraSessionResponseEvent -TabId $capturedTabId `
          -Method ([string]$eventArgs.Request.Method) -Url ([string]$eventArgs.Request.Uri) `
          -StatusCode ([int]$eventArgs.Response.StatusCode))
      } catch {}
    }.GetNewClosure()
    $Core.AddWebResourceRequestedFilter($filter, $context, $sourceKinds)
    $filterAdded = $true
    $Core.add_WebResourceRequested($requestHandler)
    $Core.add_WebResourceResponseReceived($responseHandler)
    $script:AuraSessionResponseObservers[$TabId] = [PSCustomObject]@{
      Core = $Core
      Filter = $filter
      Context = $context
      RequestHandler = $requestHandler
      ResponseHandler = $responseHandler
    }
    return $true
  } catch {
    if ($null -ne $requestHandler) {
      try { $Core.remove_WebResourceRequested($requestHandler) } catch {}
    }
    if ($null -ne $responseHandler) {
      try { $Core.remove_WebResourceResponseReceived($responseHandler) } catch {}
    }
    if ($filterAdded) {
      try { $Core.RemoveWebResourceRequestedFilter($filter, $context) } catch {}
    }
    return $false
  }
}

function Register-AuraSessionResponseObserverForWebView {
  param([Parameter(Mandatory = $true)][object]$WebView)
  if ($null -eq $WebView.CoreWebView2) { return $false }
  foreach ($tabId in @($script:AuraWebTabRuntime.Keys)) {
    $runtime = $script:AuraWebTabRuntime[[string]$tabId]
    if ($null -ne $runtime -and $runtime.View -eq $WebView) {
      return Register-AuraSessionResponseObserver -Core $WebView.CoreWebView2 -TabId ([string]$tabId)
    }
  }
  return $false
}

function Unregister-AuraSessionResponseObserver {
  param([Parameter(Mandatory = $true)][string]$TabId)
  if ($script:AuraSessionResponseObservers.ContainsKey($TabId)) {
    $record = $script:AuraSessionResponseObservers[$TabId]
    try { $record.Core.remove_WebResourceRequested($record.RequestHandler) } catch {}
    try { $record.Core.remove_WebResourceResponseReceived($record.ResponseHandler) } catch {}
    try { $record.Core.RemoveWebResourceRequestedFilter($record.Filter, $record.Context) } catch {}
    [void]$script:AuraSessionResponseObservers.Remove($TabId)
  }
  foreach ($requestId in @($script:AuraSessionResponseRequests.Keys)) {
    $request = $script:AuraSessionResponseRequests[[string]$requestId]
    if ($null -ne $request -and [string]$request.TabId -ceq $TabId) {
      [void](Stop-AuraSessionResponseObservation -RequestId ([string]$requestId))
    }
  }
}

function Dispose-AuraSessionResponseObservers {
  foreach ($tabId in @($script:AuraSessionResponseObservers.Keys)) {
    Unregister-AuraSessionResponseObserver -TabId ([string]$tabId)
  }
  $script:AuraSessionResponseObservers = @{}
  $script:AuraSessionResponseRequests = @{}
  $script:AuraSessionResponseLiveByRoute = @{}
  $script:AuraSessionResponseChangedAtByRoute = @{}
}

function Update-AuraSessionResponseObservers {
  $now = [DateTime]::UtcNow
  foreach ($requestId in @($script:AuraSessionResponseRequests.Keys)) {
    $record = $script:AuraSessionResponseRequests[[string]$requestId]
    if ($null -ne $record -and $null -ne $record.DeadlineUtc -and
        $now -ge [DateTime]$record.DeadlineUtc) {
      [void](Complete-AuraSessionResponseObservation -RequestId ([string]$requestId) `
        -Outcome unknown)
    }
  }
}

function Get-AuraSessionObservedItems {
  if ($null -eq $script:AuraSessionHistoryDocument) {
    try { $script:AuraSessionHistoryDocument = Read-AuraSessionHistoryDocument }
    catch { $script:AuraSessionHistoryDocument = New-AuraSessionHistoryDocument }
  }
  $openRoutes = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $activeRoute = ''
  if ($null -ne $script:AuraWebTabDocument) {
    foreach ($tab in @($script:AuraWebTabDocument.tabs)) {
      $route = ConvertTo-AuraSessionRoute -Value $tab.url
      if ($null -eq $route) { continue }
      [void]$openRoutes.Add([string]$route.route)
      if ([string]$tab.id -ceq [string]$script:AuraWebTabDocument.activeTabId) {
        $activeRoute = [string]$route.route
      }
    }
  }
  $stateRank = @{ active = 0; open = 1; past = 2 }
  return @($script:AuraSessionHistoryDocument.sessions | ForEach-Object {
    $normalized = ConvertTo-AuraSessionRoute -Value $_.route
    if ($null -eq $normalized -or
        [string]$normalized.route -cne [string]$_.route -or
        [string]$normalized.kind -cne [string]$_.kind -or
        -not (Test-AuraSessionDockUuid -Value ([string]$_.id))) {
      return
    }
    $state = if ([string]$normalized.route -ceq $activeRoute) { 'active' }
      elseif ($openRoutes.Contains([string]$normalized.route)) { 'open' }
      else { 'past' }
    $liveCount = if ($script:AuraSessionResponseLiveByRoute.ContainsKey(
        [string]$normalized.route)) {
      [int]$script:AuraSessionResponseLiveByRoute[[string]$normalized.route]
    } else { 0 }
    $response = if ($liveCount -gt 0) {
      [PSCustomObject][ordered]@{
        state = 'working'
        evidence = 'network'
        changedAt = [long]$script:AuraSessionResponseChangedAtByRoute[
          [string]$normalized.route]
      }
    } elseif ([string]$_.responseState -in @('completed', 'failed') -and
        $null -ne $_.responseChangedAt) {
      [PSCustomObject][ordered]@{
        state = [string]$_.responseState
        evidence = 'network'
        changedAt = [long]$_.responseChangedAt
      }
    } else {
      [PSCustomObject][ordered]@{ state = 'unknown'; evidence = 'none'; changedAt = $null }
    }
    [PSCustomObject][ordered]@{
      id = [string]$_.id
      url = [string]$normalized.route
      title = [string]$_.title
      kind = [string]$normalized.kind
      state = $state
      firstSeenAt = [long]$_.firstSeenAt
      lastOpenedAt = [long]$_.lastOpenedAt
      response = $response
    }
  } | Sort-Object -Property @{ Expression = { $stateRank[[string]$_.state] }; Descending = $false },
      @{ Expression = { [long]$_.lastOpenedAt }; Descending = $true },
      @{ Expression = { [string]$_.id }; Descending = $false })
}

function Get-AuraSessionDockProjection {
  $observedItems = @(Get-AuraSessionObservedItems)
  $sessions = @($observedItems | Select-Object -First $script:AuraSessionProjectionLimit |
    ForEach-Object {
      $source = if ([string]$_.kind -ceq 'code') { '[Claude Code]' } else { '[Claude Chat]' }
      [PSCustomObject][ordered]@{
        id = [string]$_.id
        title = "$source $([string]$_.title)"
        state = [string]$_.state
        firstSeenAt = [long]$_.firstSeenAt
        lastOpenedAt = [long]$_.lastOpenedAt
        response = $_.response
      }
    })
  $capabilities = [PSCustomObject][ordered]@{
    openSession = [bool]($null -ne $script:AuraWebTabDocument)
    queueSession = [bool]($null -ne $script:AuraWebTabDocument)
    steerSession = [bool]($null -ne $script:AuraWebTabDocument)
  }
  $fingerprint = ([PSCustomObject][ordered]@{
      sessions = @($sessions)
      capabilities = $capabilities
    } |
    ConvertTo-Json -Compress -Depth 6)
  if ($null -eq $script:AuraSessionProjectionFingerprint -or
      [string]$script:AuraSessionProjectionFingerprint -cne $fingerprint) {
    if ($script:AuraSessionProjectionRevision -ge 2147483647) {
      throw 'Aura session dock revision is exhausted.'
    }
    $script:AuraSessionProjectionFingerprint = $fingerprint
    $script:AuraSessionProjectionRevision += 1
    $script:AuraSessionProjectionChangedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
  $script:AuraSessionProjectionSequence += 1
  return [PSCustomObject][ordered]@{
    schemaVersion = 2
    contractId = $script:AuraSessionDockContractId
    kind = 'projection'
    sequence = [long]$script:AuraSessionProjectionSequence
    revision = [long]$script:AuraSessionProjectionRevision
    changedAt = [long]$script:AuraSessionProjectionChangedAt
    sessions = @($sessions)
    capabilities = $capabilities
  }
}

function Get-AuraSessionWorkHubProjection {
  $sessions = @(Get-AuraSessionObservedItems | ForEach-Object {
    [PSCustomObject][ordered]@{
      id = [string]$_.id
      url = [string]$_.url
      title = [string]$_.title
      kind = [string]$_.kind
      state = [string]$_.state
      firstSeenAt = [long]$_.firstSeenAt
      lastOpenedAt = [long]$_.lastOpenedAt
      response = $_.response
    }
  } | Select-Object -First $script:AuraSessionHistoryLimit)
  $fingerprint = ([PSCustomObject][ordered]@{ sessions = @($sessions) } |
    ConvertTo-Json -Compress -Depth 6)
  if ($null -eq $script:AuraSessionWorkHubFingerprint -or
      [string]$script:AuraSessionWorkHubFingerprint -cne $fingerprint) {
    if ($script:AuraSessionWorkHubRevision -ge 9007199254740991 -or
        $script:AuraSessionWorkHubChangedAt -ge 9007199254740991) {
      throw 'Aura Work Hub session board evidence is exhausted.'
    }
    $script:AuraSessionWorkHubFingerprint = $fingerprint
    $script:AuraSessionWorkHubRevision += 1
    $now = [long][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $script:AuraSessionWorkHubChangedAt = if (
        $now -gt [long]$script:AuraSessionWorkHubChangedAt) {
      $now
    } else {
      [long]$script:AuraSessionWorkHubChangedAt + 1
    }
  }
  return [PSCustomObject][ordered]@{
    schemaVersion = 1
    kind = 'session-board-state'
    revision = [long]$script:AuraSessionWorkHubRevision
    changedAt = [long]$script:AuraSessionWorkHubChangedAt
    sessions = @($sessions)
  }
}

function Test-AuraSessionDockExactFields {
  param(
    [Parameter(Mandatory = $true)][object]$Value,
    [Parameter(Mandatory = $true)][string[]]$Fields
  )
  if ($Value -isnot [Management.Automation.PSCustomObject]) { return $false }
  $names = @($Value.PSObject.Properties | ForEach-Object { $_.Name })
  return $names.Count -eq $Fields.Count -and
    @($names | Where-Object { $Fields -cnotcontains $_ }).Count -eq 0
}

function Test-AuraSessionBoardDocumentUri {
  param(
    [Parameter(Mandatory = $true)][Uri]$Uri,
    [Parameter(Mandatory = $true)][ValidateSet('studio', 'compact', 'desktop')][string]$Surface
  )
  if ($Uri.Scheme -cne [Uri]::UriSchemeHttps -or $Uri.Host -cne 'aura.studio' -or
      -not $Uri.IsDefaultPort -or $Uri.UserInfo.Length -ne 0) {
    return $false
  }
  if ($Surface -cin @('compact', 'desktop')) {
    return $Uri.AbsolutePath -ceq '/work-hub.html' -and
      $Uri.Query.Length -eq 0 -and $Uri.Fragment.Length -eq 0
  }
  if ($Uri.AbsolutePath -cne '/index.html') { return $false }
  $queryMatch = [regex]::Match(
    $Uri.Query,
    '^\?locale=([^&]+)(?:&view=([^&]+))?$',
    [Text.RegularExpressions.RegexOptions]::CultureInvariant)
  if (-not $queryMatch.Success) { return $false }
  try {
    $locale = [Uri]::UnescapeDataString($queryMatch.Groups[1].Value)
    $view = if ($queryMatch.Groups[2].Success) {
      [Uri]::UnescapeDataString($queryMatch.Groups[2].Value)
    } else { '' }
  } catch { return $false }
  if ($locale -cnotin @(
      'en', 'hi', 'es', 'fr', 'id', 'ja', 'ko', 'pt-BR', 'de', 'it',
      'vi', 'pl', 'tr', 'zh-CN', 'zh-HKTW') -or
      ($view -and $view -cnotin @(
        'tasks', 'themes', 'pets', 'prompt-shelf', 'background', 'create', 'settings'))) {
    return $false
  }
  return $Uri.Fragment -cin @(
    '', '#tasks', '#themes', '#pets', '#prompt-shelf', '#background',
    '#create', '#settings', '#editor')
}

function Test-AuraSessionBoardPresentationMessage {
  param([AllowNull()][object]$Value)
  if (-not (Test-AuraSessionDockExactFields -Value $Value -Fields @(
        'type', 'version', 'revision', 'locale', 'themeId', 'appearance', 'enabled')) -or
      $Value.type -isnot [string] -or [string]$Value.type -cne 'session-board-presentation' -or
      ($Value.version -isnot [int] -and $Value.version -isnot [long]) -or
      [long]$Value.version -ne 1 -or
      ($Value.revision -isnot [int] -and $Value.revision -isnot [long]) -or
      [long]$Value.revision -lt 0 -or [long]$Value.revision -gt 9007199254740991 -or
      $Value.locale -isnot [string] -or [string]$Value.locale -cnotin @(
        'en', 'hi', 'es', 'fr', 'id', 'ja', 'ko', 'pt-BR', 'de', 'it',
        'vi', 'pl', 'tr', 'zh-CN', 'zh-HKTW') -or
      $Value.themeId -isnot [string] -or [string]$Value.themeId -cnotin @(
        'default', 'japanese-film-editorial', 'korean-prestige', 'cartoon-studio',
        'anime-twilight', 'study-library', 'japanese-idol', 'korean-idol') -or
      $Value.appearance -isnot [string] -or
      [string]$Value.appearance -cnotin @('system', 'light', 'dark') -or
      $Value.enabled -isnot [bool]) {
    return $false
  }
  return $true
}

function Resolve-AuraSessionBoardPresentationThemeId {
  param(
    [AllowEmptyString()][string]$ThemeId,
    [AllowNull()][object]$SourceRecipe
  )
  $permanent = @(
    'default', 'japanese-film-editorial', 'korean-prestige', 'cartoon-studio',
    'anime-twilight', 'study-library', 'japanese-idol', 'korean-idol')
  if ($permanent -ccontains $ThemeId) { return $ThemeId }
  if ($SourceRecipe -is [string] -and $permanent -ccontains [string]$SourceRecipe) {
    return [string]$SourceRecipe
  }
  return 'default'
}

function New-AuraSessionBoardPresentationMessage {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet(
      'en', 'hi', 'es', 'fr', 'id', 'ja', 'ko', 'pt-BR', 'de', 'it',
      'vi', 'pl', 'tr', 'zh-CN', 'zh-HKTW')]
    [string]$Locale,
    [Parameter(Mandatory = $true)]
    [ValidateSet(
      'default', 'japanese-film-editorial', 'korean-prestige', 'cartoon-studio',
      'anime-twilight', 'study-library', 'japanese-idol', 'korean-idol')]
    [string]$ThemeId,
    [Parameter(Mandatory = $true)][ValidateSet('system', 'light', 'dark')][string]$Appearance,
    [Parameter(Mandatory = $true)][bool]$Enabled,
    [Parameter(Mandatory = $true)][ValidateRange(0, 9007199254740991)][long]$Revision
  )
  return [PSCustomObject][ordered]@{
    type = 'session-board-presentation'
    version = 1
    revision = [long]$Revision
    locale = $Locale
    themeId = $ThemeId
    appearance = $Appearance
    enabled = [bool]$Enabled
  }
}

function Get-AuraSessionBoardHostRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Json,
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][ValidateSet('studio', 'compact', 'desktop')][string]$Surface
  )
  if ($Json.Length -gt 4096) { throw 'Aura session board request is too large.' }
  $sourceUri = $null
  if ($Source.Length -gt 2048 -or
      -not [Uri]::TryCreate($Source, [UriKind]::Absolute, [ref]$sourceUri) -or
      -not (Test-AuraSessionBoardDocumentUri -Uri $sourceUri -Surface $Surface)) {
    throw 'Aura session board request source is not allowed.'
  }
  try { $message = $Json | ConvertFrom-Json } catch {
    throw 'Aura session board request is not valid JSON.'
  }
  if ($message -isnot [Management.Automation.PSCustomObject] -or
      $message.type -isnot [string]) {
    throw 'Aura session board request must be an object.'
  }
  $type = [string]$message.type
  $fields = if ($type -ceq 'session-board-read') {
    @('type', 'version', 'requestId')
  } elseif ($type -ceq 'session-board-open') {
    @('type', 'version', 'requestId', 'sessionId')
  } else {
    throw 'Aura session board request type is not allowed.'
  }
  if (-not (Test-AuraSessionDockExactFields -Value $message -Fields $fields) -or
      ($message.version -isnot [int] -and $message.version -isnot [long]) -or
      [long]$message.version -ne 1 -or $message.requestId -isnot [string] -or
      -not (Test-AuraSessionDockUuid -Value ([string]$message.requestId)) -or
      ($type -ceq 'session-board-open' -and
        ($message.sessionId -isnot [string] -or
          -not (Test-AuraSessionDockUuid -Value ([string]$message.sessionId))))) {
    throw 'Aura session board request is invalid.'
  }
  if ($type -ceq 'session-board-read') {
    return [PSCustomObject][ordered]@{
      type = 'session-board-read'
      version = 1
      requestId = [string]$message.requestId
    }
  }
  return [PSCustomObject][ordered]@{
    type = 'session-board-open'
    version = 1
    requestId = [string]$message.requestId
    sessionId = [string]$message.sessionId
  }
}

function Test-AuraSessionBoardTitle {
  param([AllowNull()][object]$Value)
  if ($Value -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$Value) -or
      $Value.Length -gt 320 -or [regex]::IsMatch([string]$Value, '[\x00-\x1F\x7F-\x9F]')) {
    return $false
  }
  $scalars = 0
  for ($index = 0; $index -lt $Value.Length; $index += 1) {
    $code = [int][char]$Value[$index]
    if ($code -ge 0xD800 -and $code -le 0xDBFF) {
      if ($index + 1 -ge $Value.Length) { return $false }
      $next = [int][char]$Value[$index + 1]
      if ($next -lt 0xDC00 -or $next -gt 0xDFFF) { return $false }
      $index += 1
    } elseif ($code -ge 0xDC00 -and $code -le 0xDFFF) {
      return $false
    }
    $scalars += 1
    if ($scalars -gt 160) { return $false }
  }
  return $true
}

function ConvertTo-AuraSessionBoardRendererState {
  param([Parameter(Mandatory = $true)][object]$Projection)
  if (-not (Test-AuraSessionDockExactFields -Value $Projection `
      -Fields @('schemaVersion', 'kind', 'revision', 'changedAt', 'sessions')) -or
      $Projection.schemaVersion -ne 1 -or [string]$Projection.kind -cne 'session-board-state' -or
      -not (Test-AuraSessionDockInteger -Value $Projection.revision) -or
      -not (Test-AuraSessionDockInteger -Value $Projection.changedAt) -or
      $Projection.sessions -is [string] -or @($Projection.sessions).Count -gt 100) {
    throw 'Aura session board projection is invalid.'
  }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  $sessions = @()
  foreach ($session in @($Projection.sessions)) {
    if (-not (Test-AuraSessionDockExactFields -Value $session -Fields @(
          'id', 'url', 'title', 'kind', 'state', 'firstSeenAt', 'lastOpenedAt', 'response')) -or
        $session.id -isnot [string] -or
        -not (Test-AuraSessionDockUuid -Value ([string]$session.id)) -or
        -not $ids.Add([string]$session.id) -or
        -not (Test-AuraSessionBoardTitle -Value $session.title) -or
        [string]$session.kind -cnotin @('chat', 'code') -or
        [string]$session.state -cnotin @('active', 'open', 'past') -or
        -not (Test-AuraSessionDockInteger -Value $session.firstSeenAt) -or
        -not (Test-AuraSessionDockInteger -Value $session.lastOpenedAt) -or
        [long]$session.lastOpenedAt -lt [long]$session.firstSeenAt) {
      throw 'Aura session board projection is invalid.'
    }
    $route = ConvertTo-AuraSessionRoute -Value $session.url
    if ($null -eq $route -or [string]$route.route -cne [string]$session.url -or
        [string]$route.kind -cne [string]$session.kind -or
        -not (Test-AuraSessionDockExactFields -Value $session.response `
          -Fields @('state', 'evidence', 'changedAt'))) {
      throw 'Aura session board projection is invalid.'
    }
    $responseState = [string]$session.response.state
    if ($responseState -cnotin @('unknown', 'working', 'completed', 'failed') -or
        ($responseState -ceq 'unknown' -and
          ([string]$session.response.evidence -cne 'none' -or
            $null -ne $session.response.changedAt)) -or
        ($responseState -cne 'unknown' -and
          ([string]$session.response.evidence -cne 'network' -or
            -not (Test-AuraSessionDockInteger -Value $session.response.changedAt)))) {
      throw 'Aura session board projection is invalid.'
    }
    $sessions += [PSCustomObject][ordered]@{
      id = [string]$session.id
      title = [string]$session.title
      kind = [string]$session.kind
      state = [string]$session.state
      firstSeenAt = [long]$session.firstSeenAt
      lastOpenedAt = [long]$session.lastOpenedAt
      response = [PSCustomObject][ordered]@{
        state = $responseState
        evidence = [string]$session.response.evidence
        changedAt = if ($null -eq $session.response.changedAt) {
          $null
        } else { [long]$session.response.changedAt }
      }
    }
  }
  return [PSCustomObject][ordered]@{
    schemaVersion = 1
    kind = 'session-board-state'
    revision = [long]$Projection.revision
    changedAt = [long]$Projection.changedAt
    sessions = @($sessions)
  }
}

function Invoke-AuraSessionBoardHostRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Json,
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][ValidateSet('studio', 'compact', 'desktop')][string]$Surface
  )
  $message = Get-AuraSessionBoardHostRequest -Json $Json -Source $Source -Surface $Surface
  if ([string]$message.type -ceq 'session-board-read') {
    try {
      $state = ConvertTo-AuraSessionBoardRendererState -Projection (Get-AuraSessionWorkHubProjection)
      return [PSCustomObject][ordered]@{
        type = 'session-board-state'
        version = 1
        requestId = [string]$message.requestId
        state = $state
      }
    } catch {
      return [PSCustomObject][ordered]@{
        type = 'session-board-error'
        version = 1
        requestId = [string]$message.requestId
        action = 'read'
        code = 'unavailable'
      }
    }
  }
  $outcome = try {
    [string](Open-AuraSessionWorkHubSession -SessionId ([string]$message.sessionId))
  } catch { 'uncertain' }
  if ($outcome -cnotin @('opened', 'unavailable', 'not-found', 'uncertain')) {
    $outcome = 'unavailable'
  }
  $ok = $outcome -ceq 'opened'
  if ($ok -and $Surface -ceq 'studio' -and
      (Get-Command Show-AuraUiMain -ErrorAction SilentlyContinue)) {
    try { Show-AuraUiMain } catch {}
  }
  return [PSCustomObject][ordered]@{
    type = 'session-board-open-result'
    version = 1
    requestId = [string]$message.requestId
    sessionId = [string]$message.sessionId
    ok = [bool]$ok
    outcome = $outcome
  }
}

function New-AuraSessionDockReceipt {
  param(
    [Parameter(Mandatory = $true)][object]$Command,
    [Parameter(Mandatory = $true)]
    [ValidateSet(
      'opened', 'queued', 'placed-review-required', 'refreshed', 'unavailable',
      'stale', 'not-found', 'rejected', 'uncertain')]
    [string]$Outcome
  )
  return [PSCustomObject][ordered]@{
    schemaVersion = 2
    contractId = $script:AuraSessionDockContractId
    kind = 'receipt'
    commandId = [string]$Command.commandId
    action = [string]$Command.action
    outcome = $Outcome
    evidence = 'local'
    revision = [long]$script:AuraSessionProjectionRevision
    at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
}

function Assert-AuraSessionDockCommand {
  param([Parameter(Mandatory = $true)][object]$Message)
  $action = [string]$Message.action
  $sessionAction = $action -in @('open-session', 'queue-session', 'steer-session')
  $textAction = $action -in @('queue-session', 'steer-session')
  $fields = if ($textAction) {
    @(
      'schemaVersion', 'contractId', 'kind', 'commandId', 'expectedRevision',
      'action', 'sessionId', 'text')
  } elseif ($sessionAction) {
    @('schemaVersion', 'contractId', 'kind', 'commandId', 'expectedRevision', 'action', 'sessionId')
  } else {
    @('schemaVersion', 'contractId', 'kind', 'commandId', 'expectedRevision', 'action')
  }
  if (-not (Test-AuraSessionDockExactFields -Value $Message -Fields $fields) -or
      $Message.schemaVersion -ne 2 -or
      [string]$Message.contractId -cne $script:AuraSessionDockContractId -or
      [string]$Message.kind -cne 'command' -or
      -not (Test-AuraSessionDockUuid -Value ([string]$Message.commandId)) -or
      -not (Test-AuraSessionDockInteger -Value $Message.expectedRevision) -or
      [long]$Message.expectedRevision -gt 2147483647 -or
      $action -cnotin @('open-session', 'queue-session', 'steer-session', 'refresh') -or
      ($sessionAction -and
        -not (Test-AuraSessionDockUuid -Value ([string]$Message.sessionId))) -or
      ($textAction -and
        -not (Test-AuraSessionDockText -Value ([string]$Message.text) `
          -Maximum $script:AuraSessionDockTextMaximum -Required))) {
    throw 'Aura session dock command is invalid.'
  }
}

function Open-AuraKnownSession {
  param([Parameter(Mandatory = $true)][string]$SessionId)
  if (-not (Test-AuraSessionDockUuid -Value $SessionId)) { return 'not-found' }
  if ($null -eq $script:AuraSessionHistoryDocument) {
    try { $script:AuraSessionHistoryDocument = Read-AuraSessionHistoryDocument }
    catch { $script:AuraSessionHistoryDocument = New-AuraSessionHistoryDocument }
  }
  $session = @($script:AuraSessionHistoryDocument.sessions | Where-Object {
    [string]$_.id -ceq $SessionId
  })[0]
  if ($null -eq $session) { return 'not-found' }
  $sessionRoute = ConvertTo-AuraSessionRoute -Value $session.route
  if ($null -eq $sessionRoute -or
      [string]$sessionRoute.route -cne [string]$session.route -or
      [string]$sessionRoute.kind -cne [string]$session.kind) {
    return 'not-found'
  }
  if ($null -eq $script:AuraWebTabDocument) { return 'unavailable' }
  foreach ($tab in @($script:AuraWebTabDocument.tabs)) {
    $route = ConvertTo-AuraSessionRoute -Value $tab.url
    if ($null -ne $route -and
        [string]$route.route -ceq [string]$sessionRoute.route) {
      if (-not (Get-Command Request-AuraUiSelectWebTab -ErrorAction SilentlyContinue)) {
        return 'unavailable'
      }
      try {
        return $(if (Request-AuraUiSelectWebTab -Id ([string]$tab.id)) {
          'opened'
        } else { 'unavailable' })
      } catch { return 'uncertain' }
    }
  }
  if (-not (Get-Command Request-AuraUiNewWebTab -ErrorAction SilentlyContinue)) {
    return 'unavailable'
  }
  try {
    return $(if (Request-AuraUiNewWebTab -Url ([string]$sessionRoute.route)) {
      'opened'
    } else { 'unavailable' })
  } catch { return 'uncertain' }
}

function Open-AuraSessionDockSession {
  param([Parameter(Mandatory = $true)][string]$SessionId)
  return Open-AuraKnownSession -SessionId $SessionId
}

function Open-AuraSessionWorkHubSession {
  param([Parameter(Mandatory = $true)][string]$SessionId)
  return Open-AuraKnownSession -SessionId $SessionId
}

function Get-AuraSessionDockPromptTarget {
  param([Parameter(Mandatory = $true)][string]$Route)
  if ($null -eq $script:AuraWebTabDocument) { return $null }
  foreach ($tab in @($script:AuraWebTabDocument.tabs)) {
    $normalized = ConvertTo-AuraSessionRoute -Value $tab.url
    if ($null -eq $normalized -or [string]$normalized.route -cne $Route) { continue }
    $runtime = $script:AuraWebTabRuntime[[string]$tab.id]
    if ($null -eq $runtime -or $null -eq $runtime.View -or
        $runtime.View.IsDisposed -or $null -eq $runtime.View.CoreWebView2 -or
        -not [bool]$runtime.Initialized -or -not [bool]$runtime.PageReady) { return $null }
    $current = ConvertTo-AuraSessionRoute -Value $runtime.View.Source
    if ($null -eq $current -or [string]$current.route -cne $Route) { return $null }
    return [PSCustomObject]@{
      TabId = [string]$tab.id
      Core = $runtime.View.CoreWebView2
    }
  }
  return $null
}

function Test-AuraSessionResponseWorking {
  param([Parameter(Mandatory = $true)][string]$Route)
  return $script:AuraSessionResponseLiveByRoute.ContainsKey($Route) -and
    [int]$script:AuraSessionResponseLiveByRoute[$Route] -gt 0
}

function New-AuraSessionDockPromptScript {
  param(
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][string]$OperationId,
    [Parameter(Mandatory = $true)][string]$Route,
    [Parameter(Mandatory = $true)]
    [ValidateSet('queue-session', 'steer-session')][string]$Mode
  )
  $textJson = $Text | ConvertTo-Json -Compress
  $operationJson = $OperationId | ConvertTo-Json -Compress
  $routeJson = $Route | ConvertTo-Json -Compress
  $modeJson = $Mode | ConvertTo-Json -Compress
  $submitJson = if ($Mode -ceq 'queue-session') { 'true' } else { 'false' }
  return @"
((text, operationId, expectedRoute, mode, submit) => {
  const route = location.origin + location.pathname;
  const result = (inserted, submitScheduled, reason) => ({
    operationId, route, inserted, submitScheduled, reason,
  });
  if (route !== expectedRoute) return result(false, false, "stale-target");
  if (typeof text !== "string" || !text.trim() || text.length > 8000
      || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) {
    return result(false, false, "invalid-text");
  }
  const found = window.__CLAUDE_AURA_STATE__?.discoverComposer?.();
  const editor = found?.editor;
  if (!editor || !document.body.contains(editor)
      || editor.matches("[readonly],[disabled],[aria-disabled=true]")) {
    return result(false, false, "composer-unavailable");
  }
  try {
    editor.focus();
    let insertion = text;
    if (editor.tagName === "TEXTAREA") {
      const existing = String(editor.value || "");
      insertion = existing.trim() ? "\n\n" + text : text;
      editor.setSelectionRange(existing.length, existing.length);
      editor.setRangeText(insertion, existing.length, existing.length, "end");
    } else {
      const selection = document.getSelection();
      if (!selection) return result(false, false, "composer-unavailable");
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      insertion = String(editor.textContent || "").trim() ? "\n\n" + text : text;
      if (!document.execCommand("insertText", false, insertion)) {
        const node = document.createTextNode(insertion);
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    try {
      editor.dispatchEvent(new InputEvent("input", {
        bubbles: true, composed: true, inputType: "insertText", data: insertion,
      }));
    } catch {
      editor.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
    if (!submit) return result(true, false, mode);
    let attempts = 0;
    const submitWhenReady = () => {
      attempts += 1;
      const current = window.__CLAUDE_AURA_STATE__?.discoverComposer?.();
      const shell = current?.shell || editor.closest("form") || editor.parentElement;
      const candidates = Array.from(shell?.querySelectorAll?.("button") || []);
      const button = candidates.find((candidate) => {
        const label = String(candidate.getAttribute?.("aria-label") || "");
        const testId = String(candidate.getAttribute?.("data-testid") || "");
        return !candidate.disabled && candidate.getAttribute?.("aria-disabled") !== "true"
          && (candidate.type === "submit" || /send|submit/i.test(testId)
            || /send|submit/i.test(label));
      });
      if (button) { button.click(); return; }
      if (attempts < 30) setTimeout(submitWhenReady, 100);
    };
    setTimeout(submitWhenReady, 60);
    return result(true, true, mode);
  } catch {
    return result(false, false, "insertion-failed");
  }
})($textJson, $operationJson, $routeJson, $modeJson, $submitJson)
"@
}

function Add-AuraSessionDockCachedReceipt {
  param(
    [Parameter(Mandatory = $true)][object]$Command,
    [Parameter(Mandatory = $true)][string]$Fingerprint,
    [Parameter(Mandatory = $true)][object]$Receipt
  )
  if (-not $script:AuraSessionDockReceipts.Contains([string]$Command.commandId)) {
    $script:AuraSessionDockReceipts.Add([string]$Command.commandId, [PSCustomObject]@{
      Fingerprint = $Fingerprint
      Receipt = $Receipt
    })
  }
  while ($script:AuraSessionDockReceipts.Count -gt 200) {
    $script:AuraSessionDockReceipts.RemoveAt(0)
  }
}

function Complete-AuraSessionDockPromptReceipt {
  param(
    [Parameter(Mandatory = $true)][object]$Operation,
    [Parameter(Mandatory = $true)]
    [ValidateSet('placed-review-required', 'uncertain')][string]$Outcome
  )
  $receipt = New-AuraSessionDockReceipt -Command $Operation.Command -Outcome $Outcome
  Add-AuraSessionDockCachedReceipt -Command $Operation.Command `
    -Fingerprint ([string]$Operation.Fingerprint) -Receipt $receipt
  if ($script:AuraSessionDockAuthenticated) {
    Add-AuraSessionDockFrame -Value $receipt
    Send-AuraSessionDockProjection
  }
  return $receipt
}

function Start-AuraSessionDockPromptOperation {
  param(
    [Parameter(Mandatory = $true)][object]$Command,
    [Parameter(Mandatory = $true)][string]$Fingerprint
  )
  $session = @($script:AuraSessionHistoryDocument.sessions | Where-Object {
    [string]$_.id -ceq [string]$Command.sessionId
  })[0]
  if ($null -eq $session) {
    return [PSCustomObject]@{ Deferred = $false; Outcome = 'not-found' }
  }
  $opened = Open-AuraSessionDockSession -SessionId ([string]$Command.sessionId)
  if ($opened -cne 'opened') {
    return [PSCustomObject]@{ Deferred = $false; Outcome = $opened }
  }
  $operation = [PSCustomObject]@{
    Command = [PSCustomObject]@{
      commandId = [string]$Command.commandId
      action = [string]$Command.action
    }
    Fingerprint = $Fingerprint
    SessionId = [string]$Command.sessionId
    Route = [string]$session.route
    Mode = [string]$Command.action
    Text = [string]$Command.text
    OperationId = New-AuraSessionDockRandomHex -Count 16
    State = 'waiting'
    Task = $null
    DeadlineUtc = if ([string]$Command.action -ceq 'queue-session') {
      [DateTime]::UtcNow.AddMinutes(2)
    } else { [DateTime]::UtcNow.AddMilliseconds(3500) }
  }
  $script:AuraSessionDockPromptOperations.Add([string]$Command.commandId, $operation)
  if (Get-Command Request-AuraUiHostWork -ErrorAction SilentlyContinue) {
    try { Request-AuraUiHostWork } catch {}
  }
  return [PSCustomObject]@{
    Deferred = [string]$Command.action -ceq 'steer-session'
    Outcome = if ([string]$Command.action -ceq 'queue-session') { 'queued' } else { $null }
  }
}

function Update-AuraSessionDockPromptOperations {
  foreach ($commandId in @($script:AuraSessionDockPromptOperations.Keys)) {
    $operation = $script:AuraSessionDockPromptOperations[[string]$commandId]
    if ($null -eq $operation) { continue }
    if ([DateTime]::UtcNow -ge [DateTime]$operation.DeadlineUtc) {
      $operation.Text = ''
      if ([string]$operation.Mode -ceq 'steer-session') {
        [void](Complete-AuraSessionDockPromptReceipt -Operation $operation -Outcome uncertain)
      }
      $script:AuraSessionDockPromptOperations.Remove([string]$commandId)
      continue
    }
    if ([string]$operation.State -ceq 'waiting') {
      if ([string]$operation.Mode -ceq 'queue-session' -and
          (Test-AuraSessionResponseWorking -Route ([string]$operation.Route))) { continue }
      $target = Get-AuraSessionDockPromptTarget -Route ([string]$operation.Route)
      if ($null -eq $target) { continue }
      try {
        $source = New-AuraSessionDockPromptScript -Text ([string]$operation.Text) `
          -OperationId ([string]$operation.OperationId) -Route ([string]$operation.Route) `
          -Mode ([string]$operation.Mode)
        $operation.Text = ''
        $operation.Task = $target.Core.ExecuteScriptAsync($source)
        $operation.State = 'executing'
      } catch {
        $operation.Text = ''
        if ([string]$operation.Mode -ceq 'steer-session') {
          [void](Complete-AuraSessionDockPromptReceipt -Operation $operation -Outcome uncertain)
        }
        $script:AuraSessionDockPromptOperations.Remove([string]$commandId)
        continue
      }
    }
    if ([string]$operation.State -cne 'executing' -or
        $null -eq $operation.Task -or -not $operation.Task.IsCompleted) { continue }
    $outcome = 'uncertain'
    try {
      $raw = $operation.Task.GetAwaiter().GetResult()
      if ($raw -isnot [string] -or $raw.Length -lt 2 -or $raw.Length -gt 4096) {
        throw 'Session prompt result is invalid.'
      }
      $result = $raw | ConvertFrom-Json
      if (-not (Test-AuraSessionDockExactFields -Value $result -Fields @(
          'operationId', 'route', 'inserted', 'submitScheduled', 'reason')) -or
          [string]$result.operationId -cne [string]$operation.OperationId -or
          [string]$result.route -cne [string]$operation.Route -or
          $result.inserted -isnot [bool] -or $result.submitScheduled -isnot [bool] -or
          [string]$result.reason -cnotin @(
            'queue-session', 'steer-session', 'stale-target', 'invalid-text',
            'composer-unavailable', 'insertion-failed')) {
        throw 'Session prompt result is invalid.'
      }
      if ([string]$operation.Mode -ceq 'steer-session' -and
          [bool]$result.inserted -and -not [bool]$result.submitScheduled -and
          [string]$result.reason -ceq 'steer-session') {
        $outcome = 'placed-review-required'
      }
    } catch {
      $outcome = 'uncertain'
    }
    if ([string]$operation.Mode -ceq 'steer-session') {
      [void](Complete-AuraSessionDockPromptReceipt -Operation $operation -Outcome $outcome)
    }
    $script:AuraSessionDockPromptOperations.Remove([string]$commandId)
  }
}

function Invoke-AuraSessionDockCommand {
  param([Parameter(Mandatory = $true)][object]$Message)
  Assert-AuraSessionDockCommand -Message $Message
  if ($null -eq $script:AuraSessionHistoryDocument) {
    try { $script:AuraSessionHistoryDocument = Read-AuraSessionHistoryDocument }
    catch { $script:AuraSessionHistoryDocument = New-AuraSessionHistoryDocument }
  }
  $currentProjection = Get-AuraSessionDockProjection
  $fingerprint = $Message | ConvertTo-Json -Compress -Depth 4
  if ($script:AuraSessionDockReceipts.Contains([string]$Message.commandId)) {
    $cached = $script:AuraSessionDockReceipts[[string]$Message.commandId]
    if ([string]$cached.Fingerprint -ceq $fingerprint) { return $cached.Receipt }
    return New-AuraSessionDockReceipt -Command $Message -Outcome 'rejected'
  }
  if ($script:AuraSessionDockPromptOperations.Contains([string]$Message.commandId)) {
    $pending = $script:AuraSessionDockPromptOperations[[string]$Message.commandId]
    if ([string]$pending.Fingerprint -ceq $fingerprint) { return $null }
    return New-AuraSessionDockReceipt -Command $Message -Outcome 'rejected'
  }
  $deferred = $false
  $outcome = if ([long]$Message.expectedRevision -ne
      [long]$currentProjection.revision) {
    'stale'
  } elseif ([string]$Message.action -ceq 'refresh') {
    'refreshed'
  } elseif ([string]$Message.action -in @('queue-session', 'steer-session')) {
    $started = Start-AuraSessionDockPromptOperation -Command $Message -Fingerprint $fingerprint
    $deferred = [bool]$started.Deferred
    [string]$started.Outcome
  } else {
    Open-AuraSessionDockSession -SessionId ([string]$Message.sessionId)
  }
  [void](Get-AuraSessionDockProjection)
  if ($deferred) { return $null }
  $receipt = New-AuraSessionDockReceipt -Command $Message -Outcome $outcome
  Add-AuraSessionDockCachedReceipt -Command $Message -Fingerprint $fingerprint -Receipt $receipt
  return $receipt
}

function New-AuraSessionDockRandomHex {
  param([Parameter(Mandatory = $true)][ValidateRange(1, 64)][int]$Count)
  $bytes = [byte[]]::new($Count)
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
    return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
  } finally {
    $rng.Dispose()
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
}

function Initialize-AuraSessionDockNative {
  if ('AuraSessionDockNative' -as [type]) { return }
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;

public static class AuraSessionDockNative {
  [StructLayout(LayoutKind.Sequential)]
  private struct SecurityAttributes {
    public uint Length;
    public IntPtr SecurityDescriptor;
    [MarshalAs(UnmanagedType.Bool)] public bool InheritHandle;
  }

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern IntPtr CreateNamedPipe(
    string name, uint openMode, uint pipeMode, uint maxInstances,
    uint outBufferSize, uint inBufferSize, uint defaultTimeout,
    ref SecurityAttributes securityAttributes);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool GetNamedPipeClientProcessId(
    SafePipeHandle pipe, out uint processId);

  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern bool ImpersonateNamedPipeClient(SafePipeHandle pipe);

  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern bool RevertToSelf();

  public static SafePipeHandle CreateLocalOnlyPipe(
      string pipeName, byte[] securityDescriptor) {
    if (String.IsNullOrEmpty(pipeName)) throw new ArgumentException("pipeName");
    if (securityDescriptor == null || securityDescriptor.Length == 0) {
      throw new ArgumentException("securityDescriptor");
    }
    IntPtr descriptor = Marshal.AllocHGlobal(securityDescriptor.Length);
    try {
      Marshal.Copy(securityDescriptor, 0, descriptor, securityDescriptor.Length);
      SecurityAttributes attributes = new SecurityAttributes();
      attributes.Length = (uint)Marshal.SizeOf(typeof(SecurityAttributes));
      attributes.SecurityDescriptor = descriptor;
      attributes.InheritHandle = false;
      const uint PipeAccessDuplex = 0x00000003;
      const uint FileFlagOverlapped = 0x40000000;
      const uint PipeRejectRemoteClients = 0x00000008;
      IntPtr handle = CreateNamedPipe(
        @"\\.\pipe\" + pipeName,
        PipeAccessDuplex | FileFlagOverlapped,
        PipeRejectRemoteClients,
        1, 32768, 32768, 0, ref attributes);
      if (handle == new IntPtr(-1)) {
        throw new Win32Exception(Marshal.GetLastWin32Error());
      }
      return new SafePipeHandle(handle, true);
    } finally {
      Marshal.FreeHGlobal(descriptor);
    }
  }

  public static string GetNamedPipeClientSid(SafePipeHandle pipe) {
    if (!ImpersonateNamedPipeClient(pipe)) {
      throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    try {
      using (WindowsIdentity identity = WindowsIdentity.GetCurrent(true)) {
        if (identity == null || identity.User == null) {
          throw new InvalidOperationException("Client identity is unavailable.");
        }
        return identity.User.Value;
      }
    } finally {
      if (!RevertToSelf()) {
        throw new Win32Exception(Marshal.GetLastWin32Error());
      }
    }
  }
}
'@
}

function Assert-AuraSessionDockDiscoveryPath {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'Aura session dock discovery root is unavailable.'
  }
  $localRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $expectedRoot = [IO.Path]::GetFullPath((Join-Path $localRoot 'ClaudeAura\pet-plugin'))
  $expectedPath = [IO.Path]::GetFullPath((Join-Path $expectedRoot 'session-dock-v2.json'))
  if (-not [string]::Equals(
      [IO.Path]::GetFullPath($script:AuraSessionDockDiscoveryRoot), $expectedRoot,
      [StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals(
        [IO.Path]::GetFullPath($script:AuraSessionDockDiscoveryPath), $expectedPath,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Aura session dock discovery path escaped its directory.'
  }
  foreach ($candidate in @(
      $localRoot, (Join-Path $localRoot 'ClaudeAura'), $expectedRoot, $expectedPath)) {
    if (-not (Test-Path -LiteralPath $candidate)) { continue }
    $item = Get-Item -LiteralPath $candidate -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Aura session dock discovery path is redirected.'
    }
  }
  [void][IO.Directory]::CreateDirectory($expectedRoot)
  Set-AuraTaskboardSecureAcl -Path $expectedRoot -Directory
  return $expectedPath
}

function Write-AuraSessionDockDiscovery {
  $path = Assert-AuraSessionDockDiscoveryPath
  $directory = Split-Path -Parent $path
  $temporary = Join-Path $directory ('.session-dock-v2.{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
  $backup = Join-Path $directory ('.session-dock-v2.{0}.bak' -f [Guid]::NewGuid().ToString('N'))
  $descriptor = [PSCustomObject][ordered]@{
    schemaVersion = 2
    contractId = $script:AuraSessionDockContractId
    pipe = $script:AuraSessionDockPipeName
    token = $script:AuraSessionDockToken
    instanceId = $script:AuraSessionDockInstanceId
    createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
  $bytes = $script:AuraSessionDockUtf8.GetBytes(
    (($descriptor | ConvertTo-Json -Compress) + [Environment]::NewLine))
  try {
    if ($bytes.Length -gt 4096) { throw 'Aura session dock discovery is too large.' }
    [IO.File]::WriteAllBytes($temporary, $bytes)
    Set-AuraTaskboardSecureAcl -Path $temporary
    if (Test-Path -LiteralPath $path -PathType Leaf) {
      [IO.File]::Replace($temporary, $path, $backup, $true)
    } else {
      [IO.File]::Move($temporary, $path)
    }
    Set-AuraTaskboardSecureAcl -Path $path
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
    foreach ($candidate in @($temporary, $backup)) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        try { Remove-Item -LiteralPath $candidate -Force } catch {}
      }
    }
  }
}

function Remove-AuraSessionDockDiscovery {
  try {
    $path = Assert-AuraSessionDockDiscoveryPath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return }
    $bytes = [IO.File]::ReadAllBytes($path)
    try {
      $value = $script:AuraSessionDockUtf8.GetString($bytes) | ConvertFrom-Json
      if ([string]$value.instanceId -ceq $script:AuraSessionDockInstanceId) {
        Remove-Item -LiteralPath $path -Force
      }
    } finally {
      [Array]::Clear($bytes, 0, $bytes.Length)
    }
  } catch {}
}

function New-AuraSessionDockPipe {
  Initialize-AuraSessionDockNative
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if ($null -eq $sid) { throw 'Aura session dock user is unavailable.' }
  $security = [IO.Pipes.PipeSecurity]::new()
  $security.SetAccessRuleProtection($true, $false)
  $security.SetOwner($sid)
  [void]$security.AddAccessRule([IO.Pipes.PipeAccessRule]::new(
      $sid, [IO.Pipes.PipeAccessRights]::FullControl,
      [Security.AccessControl.AccessControlType]::Allow))
  $descriptorBytes = $security.GetSecurityDescriptorBinaryForm()
  try {
    $handle = [AuraSessionDockNative]::CreateLocalOnlyPipe(
      $script:AuraSessionDockPipeName, $descriptorBytes)
    try {
      return [IO.Pipes.NamedPipeServerStream]::new(
        [IO.Pipes.PipeDirection]::InOut, $true, $false, $handle)
    } catch {
      $handle.Dispose()
      throw
    }
  } finally {
    [Array]::Clear($descriptorBytes, 0, $descriptorBytes.Length)
  }
}

function Test-AuraSessionDockClient {
  if ($null -eq $script:AuraSessionDockPipe -or
      -not $script:AuraSessionDockPipe.IsConnected) { return $false }
  try {
    [uint32]$clientProcessId = 0
    if (-not [AuraSessionDockNative]::GetNamedPipeClientProcessId(
        $script:AuraSessionDockPipe.SafePipeHandle, [ref]$clientProcessId)) {
      try { Write-AuraUiLog -Message 'Recent session runway client process was unavailable.' } catch {}
      return $false
    }
    $clientProcess = [Diagnostics.Process]::GetProcessById([int]$clientProcessId)
    $currentProcess = [Diagnostics.Process]::GetCurrentProcess()
    try {
      if ($clientProcess.SessionId -ne $currentProcess.SessionId) {
        try { Write-AuraUiLog -Message 'Recent session runway client session differed.' } catch {}
        return $false
      }
    } finally {
      $clientProcess.Dispose()
      $currentProcess.Dispose()
    }
    $clientSid = [AuraSessionDockNative]::GetNamedPipeClientSid(
      $script:AuraSessionDockPipe.SafePipeHandle)
    $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $matches = [string]::Equals(
      $clientSid, $currentSid, [StringComparison]::OrdinalIgnoreCase)
    if (-not $matches) {
      try { Write-AuraUiLog -Message 'Recent session runway client user differed.' } catch {}
    }
    return $matches
  } catch {
    try { Write-AuraUiLog -Message 'Recent session runway client check failed.' } catch {}
    return $false
  }
}

function Clear-AuraSessionDockConnection {
  if ($null -ne $script:AuraSessionDockReadBuffer) {
    [Array]::Clear($script:AuraSessionDockReadBuffer, 0, $script:AuraSessionDockReadBuffer.Length)
  }
  if ($null -ne $script:AuraSessionDockInbound) {
    [Array]::Clear($script:AuraSessionDockInbound, 0, $script:AuraSessionDockInbound.Length)
  }
  if ($null -ne $script:AuraSessionDockWriteBuffer) {
    [Array]::Clear($script:AuraSessionDockWriteBuffer, 0, $script:AuraSessionDockWriteBuffer.Length)
  }
  while ($script:AuraSessionDockWriteQueue.Count -gt 0) {
    $queued = $script:AuraSessionDockWriteQueue.Dequeue()
    [Array]::Clear($queued, 0, $queued.Length)
  }
  $script:AuraSessionDockReadTask = $null
  $script:AuraSessionDockReadBuffer = $null
  $script:AuraSessionDockInbound = [byte[]]::new(0)
  $script:AuraSessionDockWriteTask = $null
  $script:AuraSessionDockWriteBuffer = $null
  $script:AuraSessionDockAuthenticated = $false
  $script:AuraSessionDockLastProjectionRevision = [long]-1
  $script:AuraSessionDockAcceptTask = $null
  if ($null -ne $script:AuraSessionDockPipe) {
    try { $script:AuraSessionDockPipe.Dispose() } catch {}
  }
  $script:AuraSessionDockPipe = $null
}

function Start-AuraSessionDockAccept {
  Clear-AuraSessionDockConnection
  if (-not $script:AuraSessionDockInitialized) { return }
  $script:AuraSessionDockPipe = New-AuraSessionDockPipe
  $script:AuraSessionDockAcceptTask = $script:AuraSessionDockPipe.WaitForConnectionAsync()
}

function Start-AuraSessionDockRead {
  if ($null -ne $script:AuraSessionDockReadTask -or
      $null -eq $script:AuraSessionDockPipe -or
      -not $script:AuraSessionDockPipe.IsConnected) { return }
  $script:AuraSessionDockReadBuffer = [byte[]]::new($script:AuraSessionDockFrameMaximumBytes)
  $script:AuraSessionDockReadTask = $script:AuraSessionDockPipe.ReadAsync(
    $script:AuraSessionDockReadBuffer, 0, $script:AuraSessionDockReadBuffer.Length)
}

function Start-AuraSessionDockWrite {
  if ($null -ne $script:AuraSessionDockWriteTask -or
      $script:AuraSessionDockWriteQueue.Count -eq 0 -or
      $null -eq $script:AuraSessionDockPipe -or
      -not $script:AuraSessionDockPipe.IsConnected) { return }
  $script:AuraSessionDockWriteBuffer = $script:AuraSessionDockWriteQueue.Dequeue()
  $script:AuraSessionDockWriteTask = $script:AuraSessionDockPipe.WriteAsync(
    $script:AuraSessionDockWriteBuffer, 0, $script:AuraSessionDockWriteBuffer.Length)
}

function Add-AuraSessionDockFrame {
  param([Parameter(Mandatory = $true)][object]$Value)
  $bytes = $script:AuraSessionDockUtf8.GetBytes(
    (($Value | ConvertTo-Json -Compress -Depth 8) + [Environment]::NewLine))
  if ($bytes.Length -gt $script:AuraSessionDockFrameMaximumBytes) {
    [Array]::Clear($bytes, 0, $bytes.Length)
    throw 'Aura session dock frame exceeds its limit.'
  }
  $script:AuraSessionDockWriteQueue.Enqueue($bytes)
  Start-AuraSessionDockWrite
}

function Send-AuraSessionDockProjection {
  param([switch]$Force)
  if (-not $script:AuraSessionDockAuthenticated) { return }
  $projection = Get-AuraSessionDockProjection
  if (-not $Force -and [long]$projection.revision -eq
      [long]$script:AuraSessionDockLastProjectionRevision) { return }
  $script:AuraSessionDockLastProjectionRevision = [long]$projection.revision
  Add-AuraSessionDockFrame -Value $projection
}

function ConvertFrom-AuraSessionDockFrame {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  if ($Bytes.Length -lt 2 -or $Bytes.Length -gt $script:AuraSessionDockFrameMaximumBytes) {
    throw 'Aura session dock frame is invalid.'
  }
  try {
    $text = $script:AuraSessionDockUtf8.GetString($Bytes)
    $value = $text | ConvertFrom-Json
    if ($value -isnot [Management.Automation.PSCustomObject]) {
      throw 'Aura session dock frame is invalid.'
    }
    return $value
  } catch {
    throw 'Aura session dock frame is invalid.'
  } finally {
    $text = $null
  }
}

function Receive-AuraSessionDockFrame {
  param([Parameter(Mandatory = $true)][object]$Message)
  if (-not $script:AuraSessionDockAuthenticated) {
    if (-not (Test-AuraSessionDockClient)) {
      throw 'Aura session dock client identity is invalid.'
    }
    if (-not (Test-AuraSessionDockExactFields -Value $Message -Fields @(
        'schemaVersion', 'contractId', 'kind', 'token', 'clientId', 'clientVersion')) -or
        $Message.schemaVersion -ne 2 -or
        [string]$Message.contractId -cne $script:AuraSessionDockContractId -or
        [string]$Message.kind -cne 'hello' -or
        [string]$Message.token -cne $script:AuraSessionDockToken -or
        [string]$Message.clientId -cne 'pet-status' -or
        $Message.clientVersion -isnot [string] -or
        ([string]$Message.clientVersion).Length -gt 64 -or
        [string]$Message.clientVersion -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$') {
      throw 'Aura session dock hello is invalid.'
    }
    $script:AuraSessionDockAuthenticated = $true
    Send-AuraSessionDockProjection -Force
    return
  }
  $receipt = Invoke-AuraSessionDockCommand -Message $Message
  if ($null -ne $receipt) { Add-AuraSessionDockFrame -Value $receipt }
  Send-AuraSessionDockProjection
}

function Complete-AuraSessionDockRead {
  $task = $script:AuraSessionDockReadTask
  $buffer = $script:AuraSessionDockReadBuffer
  $script:AuraSessionDockReadTask = $null
  $script:AuraSessionDockReadBuffer = $null
  $combined = $null
  try {
    $count = [int]$task.GetAwaiter().GetResult()
    if ($count -le 0) { throw 'Aura session dock client disconnected.' }
    $combined = [byte[]]::new($script:AuraSessionDockInbound.Length + $count)
    [Array]::Copy($script:AuraSessionDockInbound, 0, $combined, 0,
      $script:AuraSessionDockInbound.Length)
    [Array]::Copy($buffer, 0, $combined, $script:AuraSessionDockInbound.Length, $count)
    [Array]::Clear($script:AuraSessionDockInbound, 0, $script:AuraSessionDockInbound.Length)
    $offset = 0
    while ($offset -lt $combined.Length) {
      $newline = [Array]::IndexOf($combined, [byte]10, $offset)
      if ($newline -lt 0) { break }
      $length = $newline - $offset
      if ($length -lt 2 -or $length -gt $script:AuraSessionDockFrameMaximumBytes) {
        throw 'Aura session dock frame is invalid.'
      }
      $line = [byte[]]::new($length)
      try {
        [Array]::Copy($combined, $offset, $line, 0, $length)
        Receive-AuraSessionDockFrame -Message (ConvertFrom-AuraSessionDockFrame -Bytes $line)
      } finally {
        [Array]::Clear($line, 0, $line.Length)
      }
      $offset = $newline + 1
    }
    $remaining = $combined.Length - $offset
    if ($remaining -gt $script:AuraSessionDockFrameMaximumBytes) {
      throw 'Aura session dock frame is invalid.'
    }
    $script:AuraSessionDockInbound = [byte[]]::new($remaining)
    if ($remaining -gt 0) {
      [Array]::Copy($combined, $offset, $script:AuraSessionDockInbound, 0, $remaining)
    }
  } finally {
    [Array]::Clear($buffer, 0, $buffer.Length)
    if ($null -ne $combined) { [Array]::Clear($combined, 0, $combined.Length) }
  }
  Start-AuraSessionDockRead
}

function Update-AuraSessionDock {
  if (-not $script:AuraSessionDockInitialized) { return }
  try {
    Update-AuraSessionResponseObservers
    if ($null -ne $script:AuraSessionDockAcceptTask -and
        $script:AuraSessionDockAcceptTask.IsCompleted) {
      $task = $script:AuraSessionDockAcceptTask
      $script:AuraSessionDockAcceptTask = $null
      [void]$task.GetAwaiter().GetResult()
      Start-AuraSessionDockRead
    }
    if ($null -ne $script:AuraSessionDockWriteTask -and
        $script:AuraSessionDockWriteTask.IsCompleted) {
      $task = $script:AuraSessionDockWriteTask
      $buffer = $script:AuraSessionDockWriteBuffer
      $script:AuraSessionDockWriteTask = $null
      $script:AuraSessionDockWriteBuffer = $null
      try { [void]$task.GetAwaiter().GetResult() }
      finally { [Array]::Clear($buffer, 0, $buffer.Length) }
      Start-AuraSessionDockWrite
    }
    if ($null -ne $script:AuraSessionDockReadTask -and
        $script:AuraSessionDockReadTask.IsCompleted) {
      Complete-AuraSessionDockRead
    }
    Update-AuraSessionDockPromptOperations
    Send-AuraSessionDockProjection
  } catch {
    try { Write-AuraUiLog -Message 'Recent session runway connection was reset.' } catch {}
    Start-AuraSessionDockAccept
  }
}

function Initialize-AuraSessionDock {
  if ($script:AuraSessionDockInitialized) { return $true }
  try {
    $script:AuraSessionDockInstanceId = [Guid]::NewGuid().ToString('D').ToLowerInvariant()
    $script:AuraSessionDockPipeName = 'GeminiAura.SessionDockV2.' + (New-AuraSessionDockRandomHex -Count 16)
    $script:AuraSessionDockToken = New-AuraSessionDockRandomHex -Count 32
    $script:AuraSessionDockInitialized = $true
    Start-AuraSessionDockAccept
    Write-AuraSessionDockDiscovery
    return $true
  } catch {
    $script:AuraSessionDockInitialized = $false
    Clear-AuraSessionDockConnection
    Remove-AuraSessionDockDiscovery
    try { Write-AuraUiLog -Message 'Recent session runway is unavailable.' } catch {}
    return $false
  }
}

function Dispose-AuraSessionDock {
  $script:AuraSessionDockInitialized = $false
  foreach ($operation in @($script:AuraSessionDockPromptOperations.Values)) {
    if ($null -ne $operation) { $operation.Text = '' }
  }
  $script:AuraSessionDockPromptOperations.Clear()
  Dispose-AuraSessionResponseObservers
  Clear-AuraSessionDockConnection
  Remove-AuraSessionDockDiscovery
  $script:AuraSessionDockToken = ''
  $script:AuraSessionDockPipeName = ''
  $script:AuraSessionDockInstanceId = ''
}
