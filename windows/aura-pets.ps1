# Claude Aura pet controls.
#
# The installed companion currently consumes the body-free
# gemini-aura-pet-selection-v1 compatibility intent. Aura writes only that
# selection/visibility record; pet assets and conversation content stay outside
# this bridge.

$script:AuraPetContractId = 'gemini-aura-pet-selection-v1'
$script:AuraPetCatalogVersion = 1
$script:AuraPetIds = @('nori', 'pip', 'moss')
$script:AuraPetIntentRoot = Join-Path $env:LOCALAPPDATA 'GeminiAura\pet-plugin'
$script:AuraPetIntentPath = Join-Path $script:AuraPetIntentRoot 'selection-v1.json'
$script:AuraPetIntentMaximumBytes = 4096

function Test-AuraPetUuid {
  param([AllowEmptyString()][string]$Value)
  return $Value -cmatch '^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
}

function New-AuraPetIntent {
  return [PSCustomObject][ordered]@{
    schemaVersion = 1
    contractId = $script:AuraPetContractId
    sourceApp = 'claude-aura'
    writerId = [Guid]::NewGuid().ToString('D').ToLowerInvariant()
    catalogVersion = $script:AuraPetCatalogVersion
    revision = [long]0
    enabled = $false
    selectedPetId = $null
    changedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
}

function ConvertTo-AuraPetIntent {
  param([Parameter(Mandatory = $true)][object]$Value)
  $names = @(Get-AuraTaskboardPropertyNames -Value $Value)
  $selectedPetId = Get-AuraTaskboardProperty -Value $Value -Name 'selectedPetId'
  $legacy = $names.Count -eq 8 -and $names -cnotcontains 'sourceApp'
  if (($names.Count -ne 9 -and -not $legacy) -or $names -cnotcontains 'schemaVersion' -or
      $names -cnotcontains 'contractId' -or $names -cnotcontains 'writerId' -or
      (-not $legacy -and $names -cnotcontains 'sourceApp') -or
      $names -cnotcontains 'catalogVersion' -or $names -cnotcontains 'revision' -or
      $names -cnotcontains 'enabled' -or $names -cnotcontains 'selectedPetId' -or
      $names -cnotcontains 'changedAt' -or $Value.schemaVersion -ne 1 -or
      [string]$Value.contractId -cne $script:AuraPetContractId -or
      (-not $legacy -and [string]$Value.sourceApp -cnotin @('gemini-aura', 'claude-aura')) -or
      $Value.writerId -isnot [string] -or -not (Test-AuraPetUuid -Value ([string]$Value.writerId)) -or
      $Value.catalogVersion -ne $script:AuraPetCatalogVersion -or
      -not (Test-AuraTaskboardInteger -Value $Value.revision -Minimum 0 -Maximum 9007199254740991) -or
      $Value.enabled -isnot [bool] -or
      -not ($null -eq $selectedPetId -or
        ($selectedPetId -is [string] -and $script:AuraPetIds -ccontains [string]$selectedPetId)) -or
      ([bool]$Value.enabled -and $null -eq $selectedPetId) -or
      -not (Test-AuraTaskboardInteger -Value $Value.changedAt -Minimum 0 -Maximum 9007199254740991)) {
    throw 'Pet selection intent is invalid.'
  }
  return [PSCustomObject][ordered]@{
    schemaVersion = 1
    contractId = $script:AuraPetContractId
    sourceApp = if ($legacy) { 'gemini-aura' } else { [string]$Value.sourceApp }
    writerId = [string]$Value.writerId
    catalogVersion = $script:AuraPetCatalogVersion
    revision = [long]$Value.revision
    enabled = [bool]$Value.enabled
    selectedPetId = if ($null -eq $selectedPetId) { $null } else { [string]$selectedPetId }
    changedAt = [long]$Value.changedAt
  }
}

function Assert-AuraPetStoragePath {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'Pet selection root is unavailable.'
  }
  $localRoot = [IO.Path]::GetFullPath($env:LOCALAPPDATA).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $expectedRoot = [IO.Path]::GetFullPath((Join-Path $localRoot 'GeminiAura\pet-plugin'))
  $expectedPath = [IO.Path]::GetFullPath((Join-Path $expectedRoot 'selection-v1.json'))
  if (-not [string]::Equals($expectedRoot, [IO.Path]::GetFullPath($script:AuraPetIntentRoot),
      [StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals($expectedPath, [IO.Path]::GetFullPath($script:AuraPetIntentPath),
        [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Pet selection path escaped its directory.'
  }
  foreach ($candidate in @($localRoot, (Join-Path $localRoot 'GeminiAura'), $expectedRoot, $expectedPath)) {
    if (-not (Test-Path -LiteralPath $candidate)) { continue }
    $item = Get-Item -LiteralPath $candidate -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Pet selection path is redirected.'
    }
  }
  [void][IO.Directory]::CreateDirectory($expectedRoot)
  return $expectedPath
}

function Read-AuraPetIntent {
  $path = Assert-AuraPetStoragePath
  if (-not (Test-Path -LiteralPath $path)) { return New-AuraPetIntent }
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw 'Pet selection path is invalid.'
  }
  $bytes = [IO.File]::ReadAllBytes($path)
  try {
    if ($bytes.Length -lt 2 -or $bytes.Length -gt $script:AuraPetIntentMaximumBytes -or
        ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)) {
      throw 'Pet selection file is invalid.'
    }
    $json = [Text.UTF8Encoding]::new($false, $true).GetString($bytes)
    foreach ($field in @(
        'schemaVersion', 'contractId', 'sourceApp', 'writerId', 'catalogVersion',
        'revision', 'enabled', 'selectedPetId', 'changedAt')) {
      $occurrences = [regex]::Matches($json, ('"{0}"\s*:' -f [regex]::Escape($field))).Count
      if ($(if ($field -ceq 'sourceApp') { $occurrences -gt 1 } else { $occurrences -ne 1 })) {
        throw 'Pet selection file is invalid.'
      }
    }
    return ConvertTo-AuraPetIntent -Value ($json | ConvertFrom-Json)
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
}

function Write-AuraPetIntent {
  param([Parameter(Mandatory = $true)][object]$Intent)
  $normalized = ConvertTo-AuraPetIntent -Value $Intent
  $path = Assert-AuraPetStoragePath
  $directory = Split-Path -Parent $path
  $temporary = Join-Path $directory ('.selection-v1.{0}.tmp' -f [Guid]::NewGuid().ToString('N'))
  $backup = Join-Path $directory ('.selection-v1.{0}.bak' -f [Guid]::NewGuid().ToString('N'))
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes(
    (($normalized | ConvertTo-Json -Depth 4) + [Environment]::NewLine))
  try {
    if ($bytes.Length -gt $script:AuraPetIntentMaximumBytes) {
      throw 'Pet selection intent exceeds its limit.'
    }
    [IO.File]::WriteAllBytes($temporary, $bytes)
    if (Test-Path -LiteralPath $path -PathType Leaf) {
      [IO.File]::Replace($temporary, $path, $backup, $true)
    } else {
      [IO.File]::Move($temporary, $path)
    }
    return Read-AuraPetIntent
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
    foreach ($candidate in @($temporary, $backup)) {
      if (Test-Path -LiteralPath $candidate -PathType Leaf) {
        try { Remove-Item -LiteralPath $candidate -Force } catch {}
      }
    }
  }
}

function Get-AuraPetManagerExecutable {
  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { return $null }
  $expectedRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'PetStatus\app'))
  $executable = [IO.Path]::GetFullPath((Join-Path $expectedRoot 'PetStatus.exe'))
  if (-not [string]::Equals((Split-Path -Parent $executable), $expectedRoot,
      [StringComparison]::OrdinalIgnoreCase) -or
      -not (Test-Path -LiteralPath $executable -PathType Leaf)) { return $null }
  foreach ($candidate in @($expectedRoot, $executable)) {
    $item = Get-Item -LiteralPath $candidate -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $null }
  }
  return $executable
}

function Start-AuraPetManager {
  $executable = Get-AuraPetManagerExecutable
  if ($null -eq $executable) { return $false }
  try {
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $executable
    $startInfo.WorkingDirectory = Split-Path -Parent $executable
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
    $process = [Diagnostics.Process]::Start($startInfo)
    if ($null -eq $process) { return $false }
    $process.Dispose()
    return $true
  } catch {
    return $false
  }
}

function New-AuraPetIntentRevision {
  param(
    [Parameter(Mandatory = $true)][object]$Current,
    [Parameter(Mandatory = $true)][bool]$Enabled,
    [AllowNull()][object]$SelectedPetId
  )
  if ([long]$Current.revision -ge 9007199254740991) {
    throw 'Pet selection revision is exhausted.'
  }
  return ConvertTo-AuraPetIntent -Value ([PSCustomObject][ordered]@{
    schemaVersion = 1
    contractId = $script:AuraPetContractId
    sourceApp = 'claude-aura'
    writerId = [string]$Current.writerId
    catalogVersion = $script:AuraPetCatalogVersion
    revision = [long]$Current.revision + 1
    enabled = $Enabled
    selectedPetId = $SelectedPetId
    changedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  })
}

function Get-AuraPetPluginMainActionModel {
  param(
    [Parameter(Mandatory = $true)][object]$Intent,
    [Parameter(Mandatory = $true)][object]$Copy
  )
  $normalized = ConvertTo-AuraPetIntent -Value $Intent
  $showPet = [string](Get-AuraTaskboardProperty -Value $Copy -Name 'showPet')
  $hidePet = [string](Get-AuraTaskboardProperty -Value $Copy -Name 'hidePet')
  $petSettings = [string](Get-AuraTaskboardProperty -Value $Copy -Name 'petSettings')
  if ([string]::IsNullOrWhiteSpace($showPet) -or
      [string]::IsNullOrWhiteSpace($hidePet) -or
      [string]::IsNullOrWhiteSpace($petSettings)) {
    throw 'Pet action copy is unavailable.'
  }
  $visibilityType = if ([bool]$normalized.enabled) { 'pet-plugin-hide' } else { 'pet-plugin-show' }
  return [PSCustomObject][ordered]@{
    visibilityText = if ([bool]$normalized.enabled) { $hidePet } else { $showPet }
    visibilityRequest = [PSCustomObject][ordered]@{ type = $visibilityType }
    settingsText = $petSettings
    settingsRequest = [PSCustomObject][ordered]@{ type = 'pet-plugin-open-settings' }
  }
}

function Send-AuraPetPluginState {
  param(
    [Parameter(Mandatory = $true)][object]$Intent,
    [Parameter(Mandatory = $true)][string]$Availability,
    [Parameter(Mandatory = $true)][string]$Action,
    [Parameter(Mandatory = $true)][bool]$ActionSucceeded,
    [AllowNull()][object]$ErrorCode = $null
  )
  if ($null -eq $script:StudioWebView -or $script:StudioWebView.IsDisposed -or
      $null -eq $script:StudioWebView.CoreWebView2) { return $false }
  $message = [ordered]@{
    type = 'pet-plugin-state'
    version = 1
    contractId = $script:AuraPetContractId
    catalogVersion = $script:AuraPetCatalogVersion
    availability = $Availability
    applyMode = 'when-companion-running'
    liveReceipt = $false
    pets = @(
      [PSCustomObject][ordered]@{ id = 'nori'; name = 'Nori' }
      [PSCustomObject][ordered]@{ id = 'pip'; name = 'Pip' }
      [PSCustomObject][ordered]@{ id = 'moss'; name = 'Moss' }
    )
    selection = [PSCustomObject][ordered]@{
      enabled = [bool]$Intent.enabled
      selectedPetId = $Intent.selectedPetId
      revision = [long]$Intent.revision
    }
    action = $Action
    actionSucceeded = $ActionSucceeded
    errorCode = $ErrorCode
  }
  try {
    $script:StudioWebView.CoreWebView2.PostWebMessageAsJson((
      $message | ConvertTo-Json -Depth 6 -Compress))
    return $true
  } catch {
    Write-AuraUiLog -Message 'Pet control result could not be delivered to Studio.'
    return $false
  }
}

function Assert-AuraPetPluginStudioRequest {
  param([Parameter(Mandatory = $true)][object]$Message)
  $type = [string](Get-AuraTaskboardProperty -Value $Message -Name 'type')
  $expected = if ($type -ceq 'pet-plugin-select') { @('type', 'petId') } else { @('type') }
  $names = @(Get-AuraTaskboardPropertyNames -Value $Message)
  if ($names.Count -ne $expected.Count -or @($names | Where-Object { $expected -cnotcontains $_ }).Count -ne 0 -or
      $type -cnotin @('pet-plugin-read', 'pet-plugin-select', 'pet-plugin-show',
        'pet-plugin-hide', 'pet-plugin-open-settings')) {
    throw 'Pet control request is invalid.'
  }
  if ($type -ceq 'pet-plugin-select') {
    $petId = Get-AuraTaskboardProperty -Value $Message -Name 'petId'
    if ($petId -isnot [string] -or $script:AuraPetIds -cnotcontains [string]$petId) {
      throw 'Pet selection is invalid.'
    }
  }
}

function Invoke-AuraPetPluginStudioRequest {
  param([Parameter(Mandatory = $true)][object]$Message)
  Assert-AuraPetPluginStudioRequest -Message $Message
  $type = [string]$Message.type
  $action = $type.Substring('pet-plugin-'.Length)
  # Hide is a local intent write. Select, Show, and Settings require the
  # separately installed, path-verified companion executable.
  $availability = 'ready'
  $intent = $null
  $repairRequired = $false
  try { $intent = Read-AuraPetIntent } catch {
    $intent = New-AuraPetIntent
    $repairRequired = $true
  }
  if ($repairRequired) { $availability = 'repair-required' }
  if ($type -ceq 'pet-plugin-read') {
    [void](Send-AuraPetPluginState -Intent $intent -Availability $availability `
      -Action $action -ActionSucceeded $true)
    return
  }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = [Threading.Mutex]::new($false, "Local\ClaudeAura.PetPlugin.Store.$sid")
  $ownsMutex = $false
  try {
    try { $ownsMutex = $mutex.WaitOne(3000) } catch [Threading.AbandonedMutexException] {
      $ownsMutex = $true
    }
    if (-not $ownsMutex) { throw 'Pet selection store is busy.' }
    try { $intent = Read-AuraPetIntent } catch { $intent = New-AuraPetIntent }
    if ($type -ceq 'pet-plugin-select') {
      # Start first so a failed launch leaves the prior intent byte-for-byte
      # unchanged. One successful atomic replacement selects and enables.
      if (-not (Start-AuraPetManager)) { throw 'companion-unavailable' }
      $intent = Write-AuraPetIntent -Intent (New-AuraPetIntentRevision `
        -Current $intent -Enabled $true -SelectedPetId ([string]$Message.petId))
    } elseif ($type -ceq 'pet-plugin-show') {
      if ($null -eq $intent.selectedPetId) { throw 'pet-not-selected' }
      # As with Select, launch before the sole atomic write so failure leaves
      # the saved intent and revision unchanged.
      if (-not (Start-AuraPetManager)) { throw 'companion-unavailable' }
      $intent = Write-AuraPetIntent -Intent (New-AuraPetIntentRevision `
        -Current $intent -Enabled $true -SelectedPetId $intent.selectedPetId)
    } elseif ($type -ceq 'pet-plugin-hide') {
      $intent = Write-AuraPetIntent -Intent (New-AuraPetIntentRevision `
        -Current $intent -Enabled $false -SelectedPetId $intent.selectedPetId)
    } elseif ($type -ceq 'pet-plugin-open-settings') {
      if (-not (Start-AuraPetManager)) { throw 'companion-unavailable' }
    }
    [void](Send-AuraPetPluginState -Intent $intent -Availability 'ready' `
      -Action $action -ActionSucceeded $true)
  } catch {
    $code = if ($_.Exception.Message -ceq 'pet-not-selected') { 'pet-not-selected' }
      elseif ($_.Exception.Message -ceq 'companion-unavailable') { 'companion-unavailable' }
      else { 'operation-failed' }
    [void](Send-AuraPetPluginState -Intent $intent -Availability $availability `
      -Action $action -ActionSucceeded $false -ErrorCode $code)
  } finally {
    if ($ownsMutex) { try { $mutex.ReleaseMutex() } catch {} }
    $mutex.Dispose()
  }
}
