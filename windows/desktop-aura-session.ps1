[CmdletBinding()]
param(
  [ValidateSet('Run', 'Install', 'Remove', 'Status')]
  [string]$Action = 'Run',
  [ValidatePattern('^[a-z][a-z0-9-]{1,39}$')]
  [string]$ThemeId,
  [ValidateSet('system', 'light', 'dark')]
  [string]$Appearance,
  [switch]$FrameOnly,
  [switch]$DoNotLaunchClaude,
  [switch]$NoPersist,
  [switch]$NoShellTint,
  [switch]$NoArtwork,
  [switch]$NoIdentity,
  [switch]$NoStructureAccents,
  [switch]$NoColorFilter,
  [switch]$ConfirmUnsupportedDesktopExperiment
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

function Write-AuraDesktopSessionResult {
  param([Parameter(Mandatory = $true)][hashtable]$Result)
  $Result | ConvertTo-Json -Depth 4 -Compress
}

function ConvertTo-AuraDesktopSessionArgument {
  param([AllowEmptyString()][string]$Value)
  if ($Value -notmatch '[\s"]') { return $Value }
  return '"' + ([regex]::Replace($Value, '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"'
}

function Get-AuraDesktopSessionStudioPresentationState {
  param([Parameter(Mandatory = $true)][string]$ConfigPath)
  $themeId = 'default'
  $appearance = 'system'
  $enabled = $true
  if (Test-Path -LiteralPath $ConfigPath -PathType Leaf) {
    $configItem = Get-Item -LiteralPath $ConfigPath -Force -ErrorAction Stop
    $directoryItem = Get-Item -LiteralPath $configItem.DirectoryName -Force -ErrorAction Stop
    if ($configItem.Length -lt 2 -or $configItem.Length -gt 262144 -or
        ($configItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        ($directoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'desktop-session-config-invalid'
    }
    try {
      $config = [IO.File]::ReadAllText(
        $configItem.FullName, [Text.UTF8Encoding]::new($false, $true)) |
        ConvertFrom-Json -ErrorAction Stop
    } catch {
      throw 'desktop-session-config-invalid'
    }
    if ($null -ne $config.PSObject.Properties['theme']) {
      if ($config.theme -isnot [string] -or
          "$($config.theme)" -cnotmatch '^[a-z][a-z0-9-]{1,39}$') {
        throw 'desktop-session-config-invalid'
      }
      $themeId = "$($config.theme)"
    }
    if ($null -ne $config.PSObject.Properties['appearance']) {
      if ($config.appearance -isnot [string] -or
          "$($config.appearance)" -cnotin @('system', 'light', 'dark')) {
        throw 'desktop-session-config-invalid'
      }
      $appearance = "$($config.appearance)"
    }
    if ($null -ne $config.PSObject.Properties['enabled']) {
      if ($config.enabled -isnot [bool]) { throw 'desktop-session-config-invalid' }
      $enabled = [bool]$config.enabled
    }
  }
  return [pscustomobject]@{
    ThemeId = $themeId
    Appearance = if ($enabled) { $appearance } else { 'system' }
    OriginalLook = -not $enabled
  }
}

$shortcutShell = $null
try {
  $projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
  $sourceMarker = Get-Item -LiteralPath (Join-Path $projectRoot '.git') `
    -Force -ErrorAction Stop
  if (-not $sourceMarker.PSIsContainer -or
      ($sourceMarker.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'desktop-session-source-checkout-required'
  }
  $overlayPath = [IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot 'desktop-overlay-proof.ps1'))
  $sessionPath = [IO.Path]::GetFullPath($PSCommandPath)
  $iconPath = [IO.Path]::GetFullPath(
    (Join-Path $projectRoot 'assets\brand\claude-aura.ico'))
  foreach ($required in @($overlayPath, $sessionPath, $iconPath)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
      throw 'desktop-session-source-invalid'
    }
    $requiredItem = Get-Item -LiteralPath $required -Force -ErrorAction Stop
    if (($requiredItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'desktop-session-source-invalid'
    }
  }

  $programsRoot = [Environment]::GetFolderPath(
    [Environment+SpecialFolder]::Programs)
  if (-not $programsRoot) { throw 'desktop-session-programs-folder-unavailable' }
  $programsRoot = [IO.Path]::GetFullPath($programsRoot).TrimEnd('\')
  $shortcutDirectory = [IO.Path]::GetFullPath(
    (Join-Path $programsRoot 'Claude Aura Source Experiments'))
  $shortcutPath = [IO.Path]::GetFullPath(
    (Join-Path $shortcutDirectory 'Claude Aura Desktop.lnk'))
  if (-not $shortcutDirectory.StartsWith(
      $programsRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or
      -not $shortcutPath.StartsWith(
        $shortcutDirectory + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'desktop-session-shortcut-boundary-invalid'
  }
  $powerShellPath = [IO.Path]::GetFullPath((Join-Path $PSHOME 'powershell.exe'))
  if (-not (Test-Path -LiteralPath $powerShellPath -PathType Leaf)) {
    throw 'desktop-session-powershell-unavailable'
  }
  $shortcutArguments = (@(
      '-NoProfile',
      '-WindowStyle', 'Hidden',
      '-ExecutionPolicy', 'Bypass',
      '-File', $sessionPath,
      '-Action', 'Run',
      '-ConfirmUnsupportedDesktopExperiment'
    ) | ForEach-Object {
      ConvertTo-AuraDesktopSessionArgument -Value "$_"
    }) -join ' '

  $shortcutShell = New-Object -ComObject WScript.Shell
  $shortcutPresent = Test-Path -LiteralPath $shortcutPath -PathType Leaf
  $shortcutOwned = $false
  if ($shortcutPresent) {
    $shortcutItem = Get-Item -LiteralPath $shortcutPath -Force -ErrorAction Stop
    if (($shortcutItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) {
      $existing = $shortcutShell.CreateShortcut($shortcutPath)
      $shortcutOwned = (Test-AuraPathEqual -Left "$($existing.TargetPath)" `
          -Right $powerShellPath) -and
        "$($existing.Arguments)" -ceq $shortcutArguments -and
        (Test-AuraPathEqual -Left "$($existing.WorkingDirectory)" `
          -Right $projectRoot)
    }
  }

  if ($Action -ceq 'Status') {
    Write-AuraDesktopSessionResult @{
      schemaVersion = 1
      status = 'ok'
      action = 'status'
      shortcutPresent = [bool]$shortcutPresent
      shortcutOwned = [bool]$shortcutOwned
      sourceOnly = $true
    }
    exit 0
  }
  if (-not $ConfirmUnsupportedDesktopExperiment) {
    throw 'desktop-session-consent-required'
  }

  if ($Action -ceq 'Install') {
    if ($shortcutPresent -and -not $shortcutOwned) {
      throw 'desktop-session-shortcut-conflict'
    }
    $sessionDataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\data'
    if (-not (Test-Path -LiteralPath $sessionDataRoot -PathType Container)) {
      [void](New-Item -ItemType Directory -Path $sessionDataRoot)
    }
    $sessionDataItem = Get-Item -LiteralPath $sessionDataRoot -Force -ErrorAction Stop
    if (-not $sessionDataItem.PSIsContainer -or
        ($sessionDataItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'desktop-session-config-invalid'
    }
    $studioPresentation = Get-AuraDesktopSessionStudioPresentationState `
      -ConfigPath (Join-Path $sessionDataRoot 'config.json')
    [void](Sync-AuraDesktopPresentationState `
      -StatePath (Join-Path $sessionDataRoot 'desktop-presentation.json') `
      -ThemeId ([string]$studioPresentation.ThemeId) `
      -Appearance ([string]$studioPresentation.Appearance) `
      -OriginalLook ([bool]$studioPresentation.OriginalLook) `
      -SignalMode sync -CreateIfMissing)
    if (-not (Test-Path -LiteralPath $shortcutDirectory)) {
      [void](New-Item -ItemType Directory -Path $shortcutDirectory)
    }
    $shortcutDirectoryItem = Get-Item -LiteralPath $shortcutDirectory `
      -Force -ErrorAction Stop
    if (-not $shortcutDirectoryItem.PSIsContainer -or
        ($shortcutDirectoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'desktop-session-shortcut-boundary-invalid'
    }
    if (-not $shortcutPresent) {
      $temporaryPath = Join-Path $shortcutDirectory `
        ('.claude-aura-desktop-' + [Guid]::NewGuid().ToString('N') + '.lnk')
      try {
        $shortcut = $shortcutShell.CreateShortcut($temporaryPath)
        $shortcut.TargetPath = $powerShellPath
        $shortcut.Arguments = $shortcutArguments
        $shortcut.WorkingDirectory = $projectRoot
        $shortcut.IconLocation = "$iconPath,0"
        $shortcut.Description = 'Claude Aura Desktop'
        $shortcut.WindowStyle = 7
        $shortcut.Save()
        if (-not (Test-Path -LiteralPath $temporaryPath -PathType Leaf)) {
          throw 'desktop-session-shortcut-write-failed'
        }
        Move-Item -LiteralPath $temporaryPath -Destination $shortcutPath
      } finally {
        if (Test-Path -LiteralPath $temporaryPath -PathType Leaf) {
          Remove-Item -LiteralPath $temporaryPath -Force
        }
      }
    }
    Write-AuraDesktopSessionResult @{
      schemaVersion = 1
      status = 'ok'
      action = 'install'
      shortcutPresent = $true
      shortcutOwned = $true
      sourceOnly = $true
    }
    exit 0
  }

  if ($Action -ceq 'Remove') {
    if ($shortcutPresent -and -not $shortcutOwned) {
      throw 'desktop-session-shortcut-conflict'
    }
    if ($shortcutPresent) { Remove-Item -LiteralPath $shortcutPath -Force }
    if (Test-Path -LiteralPath $shortcutDirectory -PathType Container) {
      $remaining = @(Get-ChildItem -LiteralPath $shortcutDirectory -Force)
      if ($remaining.Count -eq 0) {
        Remove-Item -LiteralPath $shortcutDirectory -Force
      }
    }
    Write-AuraDesktopSessionResult @{
      schemaVersion = 1
      status = 'ok'
      action = 'remove'
      shortcutPresent = $false
      shortcutOwned = $false
      sourceOnly = $true
    }
    exit 0
  }

  $overlayArguments = @{
    RunUntilClaudeCloses = $true
    ConfirmUnsupportedDesktopExperiment = $true
  }
  foreach ($name in @('ThemeId', 'Appearance')) {
    if ($PSBoundParameters.ContainsKey($name)) {
      $overlayArguments[$name] = $PSBoundParameters[$name]
    }
  }
  foreach ($name in @(
      'FrameOnly', 'DoNotLaunchClaude', 'NoPersist', 'NoShellTint',
      'NoArtwork', 'NoIdentity', 'NoStructureAccents', 'NoColorFilter')) {
    if ([bool]$PSBoundParameters[$name]) { $overlayArguments[$name] = $true }
  }
  $definitionReloadCount = 0
  $definitionReloadWindowStart = [DateTime]::UtcNow
  while ($true) {
    $output = & $overlayPath @overlayArguments
    $exitCode = $LASTEXITCODE
    $lastOutput = @($output | Where-Object { $null -ne $_ }) | Select-Object -Last 1
    $result = $null
    if ($lastOutput) {
      try { $result = "$lastOutput" | ConvertFrom-Json -ErrorAction Stop }
      catch { $result = $null }
    }
    if ($exitCode -eq 0 -and $null -ne $result -and
        "$($result.reasonCode)" -ceq 'desktop-overlay-state-reload-requested') {
      $now = [DateTime]::UtcNow
      if (($now - $definitionReloadWindowStart).TotalSeconds -gt 15) {
        $definitionReloadCount = 0
        $definitionReloadWindowStart = $now
      }
      $definitionReloadCount += 1
      if ($definitionReloadCount -gt 8) { throw 'desktop-session-reload-loop' }
      continue
    }
    if ($null -ne $result) {
      $result | Add-Member -NotePropertyName definitionReloadCount `
        -NotePropertyValue $definitionReloadCount -Force
      $result | ConvertTo-Json -Depth 4 -Compress | Write-Output
    } elseif ($null -ne $output) {
      $output | Write-Output
    }
    exit $exitCode
  }
} catch {
  $reasonCode = if ($_.Exception.Message -cmatch '^desktop-session-[a-z0-9-]+$') {
    $_.Exception.Message
  } else {
    'desktop-session-failed'
  }
  Write-AuraDesktopSessionResult @{
    schemaVersion = 1
    status = 'blocked'
    action = $Action.ToLowerInvariant()
    reasonCode = $reasonCode
    sourceOnly = $true
  }
  exit 2
} finally {
  if ($null -ne $shortcutShell) {
    try { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($shortcutShell) } catch { }
  }
}
