[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [switch]$RemoveData,
  [switch]$Interactive,
  [switch]$NativeBackend
)

$ErrorActionPreference = 'Stop'
$productRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ClaudeAura'))
$installRoot = [IO.Path]::GetFullPath((Join-Path $productRoot 'app'))
$dataRoot = [IO.Path]::GetFullPath((Join-Path $productRoot 'data'))
$webViewRoot = [IO.Path]::GetFullPath((Join-Path $productRoot 'webview'))
$separator = [IO.Path]::DirectorySeparatorChar
$nativeUninstallKey =
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{49DD4496-1ABF-5202-B127-3D7E919318C5}_is1'
$nativeBackendVersion = $null
if ($NativeBackend) {
  $backendRoot = [IO.Path]::GetFullPath($PSScriptRoot)
  $expectedMaintenanceRoot = [IO.Path]::GetFullPath((Join-Path $productRoot 'installer'))
  $backendName = Split-Path $backendRoot -Leaf
  $backendMatch = [regex]::Match(
    $backendName,
    '^backend-(?<version>\d+\.\d+\.\d+(?:\.\d+)?)$',
    [Text.RegularExpressions.RegexOptions]::CultureInvariant)
  $scriptPath = [IO.Path]::GetFullPath($PSCommandPath)
  if (-not $backendMatch.Success -or
      -not [string]::Equals((Split-Path $backendRoot -Parent),
        $expectedMaintenanceRoot, [StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals((Split-Path $scriptPath -Parent),
        $backendRoot, [StringComparison]::OrdinalIgnoreCase) -or
      (Split-Path $scriptPath -Leaf) -cne 'uninstall.ps1' -or
      -not (Test-Path -LiteralPath $backendRoot -PathType Container) -or
      -not (Test-Path -LiteralPath $scriptPath -PathType Leaf)) {
    throw 'Claude Aura refused a native uninstall request outside its registered maintenance backend.'
  }
  foreach ($candidate in @($backendRoot, $scriptPath)) {
    $item = Get-Item -LiteralPath $candidate -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Claude Aura refused a redirected native uninstall backend.'
    }
  }
  $nativeBackendVersion = $backendMatch.Groups['version'].Value
}
. (Join-Path $PSScriptRoot 'common.ps1')

function Assert-AuraOwnedPath([string]$Path) {
  $candidate = [IO.Path]::GetFullPath($Path)
  if (-not $candidate.StartsWith("$productRoot$separator", [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove a path outside $productRoot"
  }
}

function Assert-AuraOwnedTreeHasNoReparsePoints {
  param([Parameter(Mandatory = $true)][string]$Path)
  Assert-AuraOwnedPath -Path $Path
  $root = [IO.Path]::GetFullPath($Path).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    throw "Refusing to recursively remove a non-directory Aura path: $root"
  }
  $pending = [Collections.Generic.Stack[string]]::new()
  $pending.Push($root)
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    $directoryItem = Get-Item -LiteralPath $directory -Force
    if (($directoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Refusing to remove an Aura tree that contains a reparse point: $directory"
    }
    foreach ($entry in @(Get-ChildItem -LiteralPath $directory -Force)) {
      $entryPath = [IO.Path]::GetFullPath($entry.FullName)
      if (-not $entryPath.StartsWith("$root$separator", [StringComparison]::OrdinalIgnoreCase)) {
        throw "Aura uninstall tree entry escaped its validated root: $entryPath"
      }
      if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Refusing to remove an Aura tree that contains a reparse point: $entryPath"
      }
      if ($entry.PSIsContainer) { $pending.Push($entryPath) }
    }
  }
}

function Test-AuraOwnedShortcutTarget {
  param(
    [Parameter(Mandatory = $true)][object]$Shell,
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$ExpectedPowerShell,
    [Parameter(Mandatory = $true)][string]$ExpectedScript,
    [Parameter(Mandatory = $true)][string]$ExpectedArguments
  )
  $shortcut = $null
  try {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    $item = Get-Item -LiteralPath $Path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { return $false }
    $shortcut = $Shell.CreateShortcut($Path)
    if (-not [string]::Equals([IO.Path]::GetFullPath("$($shortcut.TargetPath)"),
        $ExpectedPowerShell, [StringComparison]::OrdinalIgnoreCase) -or
        -not [string]::Equals("$($shortcut.Arguments)", $ExpectedArguments,
          [StringComparison]::Ordinal)) {
      return $false
    }
    $fileMatch = [regex]::Match("$($shortcut.Arguments)",
      '(?i)(?:^|\s)-File\s+"(?<script>[^"]+)"(?:\s|$)')
    return $fileMatch.Success -and
      [string]::Equals([IO.Path]::GetFullPath($fileMatch.Groups['script'].Value),
        $ExpectedScript, [StringComparison]::OrdinalIgnoreCase)
  } catch {
    Write-Verbose "Could not validate shortcut $Path`: $($_.Exception.Message)"
    return $false
  } finally {
    if ($null -ne $shortcut -and [Runtime.InteropServices.Marshal]::IsComObject($shortcut)) {
      try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut) } catch {}
    }
  }
}

function Get-AuraRegisteredNativeUninstaller {
  if (-not (Test-Path -LiteralPath $nativeUninstallKey)) { return $null }
  $registration = Get-ItemProperty -LiteralPath $nativeUninstallKey -ErrorAction Stop
  $command = [string]$registration.UninstallString
  $match = [regex]::Match($command, '^\s*"(?<path>[^"]+)"\s*$')
  if (-not $match.Success) {
    throw 'Claude Aura found an invalid native uninstaller registration. Reinstall Claude Aura to repair it.'
  }
  $candidate = [IO.Path]::GetFullPath($match.Groups['path'].Value)
  $expectedParent = [IO.Path]::GetFullPath((Join-Path $productRoot 'installer'))
  if (-not [string]::Equals((Split-Path $candidate -Parent), $expectedParent,
      [StringComparison]::OrdinalIgnoreCase) -or
      (Split-Path $candidate -Leaf) -cnotmatch '^(?i:unins\d{3}\.exe)$' -or
      -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    throw 'Claude Aura found an invalid native uninstaller path. Reinstall Claude Aura to repair it.'
  }
  $item = Get-Item -LiteralPath $candidate -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Claude Aura refused a redirected native uninstaller.'
  }
  return $candidate
}

if ($NativeBackend) {
  $registeredUninstaller = Get-AuraRegisteredNativeUninstaller
  if (-not $registeredUninstaller) {
    throw 'Claude Aura refused an unregistered native uninstall backend.'
  }
  $registration = Get-ItemProperty -LiteralPath $nativeUninstallKey -ErrorAction Stop
  if ($registration.DisplayVersion -isnot [string] -or
      -not [string]::Equals([string]$registration.DisplayVersion,
        [string]$nativeBackendVersion, [StringComparison]::Ordinal)) {
    throw 'Claude Aura refused a native uninstall backend from a different installed version.'
  }
}

if (-not $NativeBackend -and -not $WhatIfPreference) {
  $nativeUninstaller = Get-AuraRegisteredNativeUninstaller
  if ($nativeUninstaller) {
    $nativeProcess = Start-Process -FilePath $nativeUninstaller -Wait -PassThru
    exit $nativeProcess.ExitCode
  }
}

$operationLock = Enter-AuraOperationLock
try {
  if (Test-Path -LiteralPath $productRoot) {
    if (-not (Test-Path -LiteralPath $productRoot -PathType Container)) {
      throw "Claude Aura product root is not a directory: $productRoot"
    }
    $productRootItem = Get-Item -LiteralPath $productRoot -Force
    if (($productRootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Refusing to uninstall through a redirected Claude Aura product root: $productRoot"
    }
  }
  Assert-AuraOwnedPath -Path $installRoot
  Assert-AuraOwnedPath -Path $dataRoot
  Assert-AuraOwnedPath -Path $webViewRoot

if ($Interactive -and -not $RemoveData) {
  Write-Host 'Claude Aura can keep your local theme settings and its separate WebView sign-in profile for a later reinstall.'
  $choice = Read-Host 'Also erase those local settings and sign-in data? [y/N]'
  $RemoveData = $choice -match '^(?i:y|yes)$'
}

$uiProbe = $null
try {
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $uiProbe = [System.Threading.Mutex]::OpenExisting("Local\ClaudeAura.$sid.Ui")
  throw 'Claude Aura is still open. Close its window, then run the uninstaller again.'
} catch [System.Threading.WaitHandleCannotBeOpenedException] {
  # No live UI owns the single-instance mutex.
} finally {
  if ($null -ne $uiProbe) { $uiProbe.Dispose() }
}

$uiScript = [regex]::Escape((Join-Path $installRoot 'windows\aura-ui.ps1'))
try {
  $activeAura = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    $_.ProcessId -ne $PID -and $_.CommandLine -match $uiScript
  })
  if ($activeAura.Count -gt 0) {
    throw 'Claude Aura is still open. Close its window, then run the uninstaller again.'
  }
} catch {
  if ($_.Exception.Message -like 'Claude Aura is still open*') { throw }
  Write-Verbose "Could not inspect running processes: $($_.Exception.Message)"
}

$desktop = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
$menuRoot = Join-Path $programs 'Claude Aura'
$shortcutShell = $null
try {
  $powershellTarget = [IO.Path]::GetFullPath((Get-Command powershell.exe -ErrorAction Stop).Source)
  $uiScriptPath = [IO.Path]::GetFullPath((Join-Path $installRoot 'windows\aura-ui.ps1'))
  $uninstallScriptPath = [IO.Path]::GetFullPath((Join-Path $installRoot 'windows\uninstall.ps1'))
  $baseArguments = "-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$uiScriptPath`""
  $shortcutDefinitions = @(
    [PSCustomObject]@{ Path = (Join-Path $desktop 'Claude Aura.lnk'); Script = $uiScriptPath; Arguments = $baseArguments },
    [PSCustomObject]@{ Path = (Join-Path $desktop 'Claude Aura Studio.lnk'); Script = $uiScriptPath; Arguments = "$baseArguments -OpenStudio" },
    [PSCustomObject]@{ Path = (Join-Path $menuRoot 'Claude Aura.lnk'); Script = $uiScriptPath; Arguments = $baseArguments },
    [PSCustomObject]@{ Path = (Join-Path $menuRoot 'Claude Aura Studio.lnk'); Script = $uiScriptPath; Arguments = "$baseArguments -OpenStudio" },
    [PSCustomObject]@{
      Path = (Join-Path $menuRoot 'Uninstall Claude Aura.lnk')
      Script = $uninstallScriptPath
      Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$uninstallScriptPath`" -Interactive"
    }
  )
  $shortcutShell = New-Object -ComObject WScript.Shell
  foreach ($definition in $shortcutDefinitions) {
    if ((Test-AuraOwnedShortcutTarget -Shell $shortcutShell -Path $definition.Path `
        -ExpectedPowerShell $powershellTarget -ExpectedScript $definition.Script `
        -ExpectedArguments $definition.Arguments) -and
        $PSCmdlet.ShouldProcess($definition.Path, 'Remove Claude Aura shortcut')) {
      Remove-Item -LiteralPath $definition.Path -Force -ErrorAction SilentlyContinue
    }
  }
} catch {
  Write-Verbose "Could not validate installed shortcuts: $($_.Exception.Message)"
} finally {
  if ($null -ne $shortcutShell -and [Runtime.InteropServices.Marshal]::IsComObject($shortcutShell)) {
    try { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcutShell) } catch {}
  }
}

$safeWorkingDirectory = if (Test-Path -LiteralPath $env:TEMP -PathType Container) { $env:TEMP } else { $env:LOCALAPPDATA }
Set-Location -LiteralPath $safeWorkingDirectory

$managedAppRoots = [Collections.Generic.List[string]]::new()
if (Test-Path -LiteralPath $installRoot) { $managedAppRoots.Add($installRoot) }
if (Test-Path -LiteralPath $productRoot -PathType Container) {
  foreach ($entry in @(Get-ChildItem -LiteralPath $productRoot -Force | Sort-Object Name)) {
    if ($entry.Name -cnotmatch '^\.app-(?:stage|backup|rollback)-[0-9a-f]{32}$') { continue }
    if (-not $entry.PSIsContainer) {
      throw "Refusing a non-directory Aura transaction artifact: $($entry.FullName)"
    }
    $managedAppRoots.Add($entry.FullName)
  }
}
foreach ($managedAppRoot in $managedAppRoots) {
  Assert-AuraOwnedTreeHasNoReparsePoints -Path $managedAppRoot
  if ($PSCmdlet.ShouldProcess($managedAppRoot, 'Remove Claude Aura application files')) {
    Remove-Item -LiteralPath $managedAppRoot -Recurse -Force
  }
}

if ($RemoveData -and (Test-Path -LiteralPath $dataRoot)) {
  Assert-AuraOwnedTreeHasNoReparsePoints -Path $dataRoot
  if ($PSCmdlet.ShouldProcess($dataRoot, 'Remove Claude Aura settings and logs')) {
    Remove-Item -LiteralPath $dataRoot -Recurse -Force
  }
}

if ($RemoveData -and (Test-Path -LiteralPath $webViewRoot)) {
  Assert-AuraOwnedTreeHasNoReparsePoints -Path $webViewRoot
  if ($PSCmdlet.ShouldProcess($webViewRoot, 'Remove Claude Aura WebView sign-in data')) {
    Remove-Item -LiteralPath $webViewRoot -Recurse -Force
  }
}

if (Test-Path -LiteralPath $menuRoot) {
  $remaining = @(Get-ChildItem -LiteralPath $menuRoot -Force -ErrorAction SilentlyContinue)
  if ($remaining.Count -eq 0 -and $PSCmdlet.ShouldProcess($menuRoot, 'Remove empty Claude Aura Start-menu folder')) {
    Remove-Item -LiteralPath $menuRoot -Force
  }
}

if (Test-Path -LiteralPath $productRoot) {
  $remaining = @(Get-ChildItem -LiteralPath $productRoot -Force -ErrorAction SilentlyContinue)
  if ($remaining.Count -eq 0 -and $PSCmdlet.ShouldProcess($productRoot, 'Remove empty Claude Aura data folder')) {
    Remove-Item -LiteralPath $productRoot -Force
  }
}

if ($WhatIfPreference) {
  Write-Host 'Dry run complete. No files were removed.'
} else {
  Write-Host 'Claude Aura application files and owned shortcuts were removed.'
  if ($RemoveData) {
    Write-Host 'Local theme settings and the separate WebView sign-in profile were also removed.'
  } else {
    Write-Host "Local theme settings were kept at $dataRoot"
    Write-Host "The separate WebView sign-in profile was kept at $webViewRoot"
  }
}
} finally {
  Exit-AuraOperationLock -Mutex $operationLock
}
