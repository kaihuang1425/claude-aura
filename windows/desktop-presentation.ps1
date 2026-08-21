[CmdletBinding()]
param(
  [ValidateSet('GateA', 'Profile', 'MainInspectorProof', 'MainThemeProof')]
  [string]$Mode = 'GateA',
  [ValidatePattern('^(?:default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)$')]
  [string]$ThemeId,
  [ValidateSet('system', 'light', 'dark')]
  [string]$Appearance,
  [ValidateRange(10, 120)]
  [int]$TimeoutSeconds = 45,
  [ValidateRange(10, 60)]
  [int]$HoldSeconds = 30,
  [switch]$ConfirmExperimentalGateA,
  [switch]$ConfirmUnsupportedDesktopExperiment
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$script:DesktopPresentationGateACandidateVersions = @()
$script:DesktopPresentationProfileEnabled = $false

function Write-AuraDesktopPresentationResult {
  param([Parameter(Mandatory = $true)][hashtable]$Result)
  $Result | ConvertTo-Json -Depth 10 -Compress
}

function ConvertTo-AuraProcessCreationTime {
  param([Parameter(Mandatory = $true)][object]$Value)
  if ($Value -is [datetime]) { return $Value.ToUniversalTime() }
  return [Management.ManagementDateTimeConverter]::ToDateTime("$Value").ToUniversalTime()
}

function Get-AuraDesktopProcesses {
  param([Parameter(Mandatory = $true)][string]$ExecutablePath)
  $processes = @()
  foreach ($candidate in @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'Claude.exe'" `
      -Property ProcessId, ParentProcessId, ExecutablePath, CreationDate -ErrorAction Stop)) {
    if (-not $candidate.ExecutablePath -or
        -not (Test-AuraPathEqual -Left "$($candidate.ExecutablePath)" -Right $ExecutablePath)) {
      continue
    }
    $processes += [pscustomobject]@{
      ProcessId = [int]$candidate.ProcessId
      ParentProcessId = [int]$candidate.ParentProcessId
      ExecutablePath = "$($candidate.ExecutablePath)"
      CreationTime = ConvertTo-AuraProcessCreationTime -Value $candidate.CreationDate
    }
  }
  return @($processes)
}

function Get-AuraRandomLoopbackPort {
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
  try {
    $listener.Start()
    $port = [int]$listener.LocalEndpoint.Port
    if ($port -lt 1024 -or $port -gt 65535) {
      throw 'Windows returned an invalid loopback port.'
    }
    return $port
  } finally {
    $listener.Stop()
  }
}

function Start-AuraDesktopApplicationActivation {
  param(
    [Parameter(Mandatory = $true)][string]$AppUserModelId,
    [Parameter(Mandatory = $true)][int]$Port,
    [ValidateSet('RendererCdp', 'MainInspector')]
    [string]$DebugKind = 'RendererCdp'
  )
  if ($AppUserModelId -cne 'Claude_pzs8sxrjxfjjc!Claude') {
    throw 'desktop-presentation-package-identity-invalid'
  }
  if ($Port -lt 1024 -or $Port -gt 65535) {
    throw 'desktop-presentation-port-invalid'
  }
  if (-not ('ClaudeAura.ApplicationActivator' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace ClaudeAura {
  [ComImport]
  [Guid("2e941141-7f97-4756-ba1d-9decde894a3d")]
  [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IApplicationActivationManager {
    [PreserveSig]
    int ActivateApplication(
      [MarshalAs(UnmanagedType.LPWStr)] string appUserModelId,
      [MarshalAs(UnmanagedType.LPWStr)] string arguments,
      uint options,
      out uint processId);
  }

  public static class ApplicationActivator {
    [DllImport("ole32.dll")]
    private static extern int CoCreateInstance(
      ref Guid classId,
      IntPtr outer,
      uint context,
      ref Guid interfaceId,
      out IntPtr instance);

    public static uint Activate(string appUserModelId, string arguments) {
      Guid classId = new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C");
      Guid interfaceId = new Guid("2e941141-7f97-4756-ba1d-9decde894a3d");
      IntPtr pointer;
      int result = CoCreateInstance(ref classId, IntPtr.Zero, 4,
        ref interfaceId, out pointer);
      Marshal.ThrowExceptionForHR(result);
      IApplicationActivationManager manager = null;
      try {
        manager = (IApplicationActivationManager)Marshal.GetObjectForIUnknown(pointer);
        uint processId;
        result = manager.ActivateApplication(appUserModelId, arguments, 0,
          out processId);
        Marshal.ThrowExceptionForHR(result);
        return processId;
      } finally {
        if (manager != null) Marshal.FinalReleaseComObject(manager);
        Marshal.Release(pointer);
      }
    }
  }
}
'@
  }
  $arguments = if ($DebugKind -ceq 'MainInspector') {
    "--inspect=127.0.0.1:$Port"
  } else {
    "--remote-debugging-port=$Port"
  }
  $processId = [ClaudeAura.ApplicationActivator]::Activate($AppUserModelId, $arguments)
  if ($processId -le 0) { throw 'desktop-presentation-activation-failed' }
  return [int]$processId
}

function Test-AuraDesktopLaunchLineage {
  param(
    [Parameter(Mandatory = $true)][object[]]$Processes,
    [Parameter(Mandatory = $true)][int]$OwnerProcessId,
    [Parameter(Mandatory = $true)][int]$LaunchProcessId
  )
  $byId = @{}
  foreach ($process in $Processes) {
    $byId[[int]$process.ProcessId] = $process
  }
  $visited = @{}
  $currentId = $OwnerProcessId
  for ($depth = 0; $depth -lt 64; $depth += 1) {
    if ($currentId -eq $LaunchProcessId) { return $true }
    if ($visited.ContainsKey($currentId) -or -not $byId.ContainsKey($currentId)) {
      return $false
    }
    $visited[$currentId] = $true
    $currentId = [int]$byId[$currentId].ParentProcessId
  }
  return $false
}

function Get-AuraDesktopEndpointIdentity {
  param(
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [int]$LaunchProcessId = 0,
    [Parameter(Mandatory = $true)][datetime]$NotBefore,
    [Parameter(Mandatory = $true)][int]$Port
  )
  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
    throw 'Get-NetTCPConnection is required to verify Desktop endpoint ownership.'
  }
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  $localAddress = if ($listeners.Count -eq 1) { "$($listeners[0].LocalAddress)" } else { '' }
  if ($listeners.Count -ne 1 -or $localAddress -notin @('127.0.0.1', '::1')) {
    return $null
  }
  $processes = @(Get-AuraDesktopProcesses -ExecutablePath $ExecutablePath)
  $ownerProcessId = [int]$listeners[0].OwningProcess
  $owner = @($processes | Where-Object { $_.ProcessId -eq $ownerProcessId })
  $lineageMatches = $LaunchProcessId -le 0 -or
    (Test-AuraDesktopLaunchLineage -Processes $processes `
      -OwnerProcessId $ownerProcessId -LaunchProcessId $LaunchProcessId)
  if ($owner.Count -ne 1 -or $owner[0].CreationTime -lt $NotBefore.AddSeconds(-2) -or
      -not $lineageMatches) {
    return $null
  }
  try {
    $httpHost = if ($localAddress -ceq '::1') { '[::1]' } else { '127.0.0.1' }
    $httpEndpoint = "http://${httpHost}:$Port/"
    $version = Invoke-RestMethod -Uri "${httpEndpoint}json/version" `
      -TimeoutSec 2 -MaximumRedirection 0 -ErrorAction Stop
    $webSocketUrl = [Uri]"$($version.webSocketDebuggerUrl)"
    if ($webSocketUrl.Scheme -ne 'ws' -or
        $webSocketUrl.Host -notin @('127.0.0.1', 'localhost', '::1', '[::1]') -or
        $webSocketUrl.Port -ne $Port -or $webSocketUrl.UserInfo -or
        $webSocketUrl.Query -or $webSocketUrl.Fragment) {
      return $null
    }
    $match = [regex]::Match(
      $webSocketUrl.AbsolutePath,
      '^/devtools/browser/(?<id>[A-Za-z0-9._-]{1,200})$')
    if (-not $match.Success) { return $null }
    return [pscustomobject]@{
      BrowserId = $match.Groups['id'].Value
      OwnershipMatch = $true
      LoopbackOnly = $true
      OwningProcessId = $ownerProcessId
      HttpEndpoint = $httpEndpoint
    }
  } catch {
    return $null
  }
}

function Get-AuraDesktopMainInspectorIdentity {
  param(
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [int]$LaunchProcessId = 0,
    [Parameter(Mandatory = $true)][datetime]$NotBefore,
    [Parameter(Mandatory = $true)][int]$Port
  )
  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
    throw 'Get-NetTCPConnection is required to verify Desktop inspector ownership.'
  }
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  $localAddress = if ($listeners.Count -eq 1) { "$($listeners[0].LocalAddress)" } else { '' }
  if ($listeners.Count -ne 1 -or $localAddress -notin @('127.0.0.1', '::1')) {
    return $null
  }
  $processes = @(Get-AuraDesktopProcesses -ExecutablePath $ExecutablePath)
  $ownerProcessId = [int]$listeners[0].OwningProcess
  $owner = @($processes | Where-Object { $_.ProcessId -eq $ownerProcessId })
  $lineageMatches = $LaunchProcessId -le 0 -or
    (Test-AuraDesktopLaunchLineage -Processes $processes `
      -OwnerProcessId $ownerProcessId -LaunchProcessId $LaunchProcessId)
  if ($owner.Count -ne 1 -or $owner[0].CreationTime -lt $NotBefore.AddSeconds(-2) -or
      -not $lineageMatches) {
    return $null
  }
  try {
    $httpHost = if ($localAddress -ceq '::1') { '[::1]' } else { '127.0.0.1' }
    $httpEndpoint = "http://${httpHost}:$Port/"
    $targets = @(Invoke-RestMethod -Uri "${httpEndpoint}json/list" `
      -TimeoutSec 2 -MaximumRedirection 0 -ErrorAction Stop)
    if ($targets.Count -ne 1 -or "$($targets[0].type)" -cne 'node' -or
        "$($targets[0].id)" -notmatch '^[A-Za-z0-9._-]{1,200}$') {
      return $null
    }
    $webSocketUrl = [Uri]"$($targets[0].webSocketDebuggerUrl)"
    if ($webSocketUrl.Scheme -ne 'ws' -or
        $webSocketUrl.Host -notin @('127.0.0.1', 'localhost', '::1', '[::1]') -or
        $webSocketUrl.Port -ne $Port -or $webSocketUrl.UserInfo -or
        $webSocketUrl.Query -or $webSocketUrl.Fragment) {
      return $null
    }
    $match = [regex]::Match(
      $webSocketUrl.AbsolutePath,
      '^/(?<id>[A-Za-z0-9._-]{1,200})$')
    if (-not $match.Success -or
        $match.Groups['id'].Value -cne "$($targets[0].id)") {
      return $null
    }
    return [pscustomobject]@{
      InspectorId = $match.Groups['id'].Value
      OwnershipMatch = $true
      LoopbackOnly = $true
      OwningProcessId = $ownerProcessId
      HttpEndpoint = $httpEndpoint
    }
  } catch {
    return $null
  }
}

function Close-AuraDesktopDiagnosticInstance {
  param(
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [Parameter(Mandatory = $true)][int]$LaunchProcessId,
    [Parameter(Mandatory = $true)][datetime]$NotBefore,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][string]$BrowserId,
    [Parameter(Mandatory = $true)][int]$OwningProcessId
  )
  $identity = Get-AuraDesktopEndpointIdentity -ExecutablePath $ExecutablePath `
    -LaunchProcessId $LaunchProcessId -NotBefore $NotBefore -Port $Port
  if ($null -eq $identity) {
    $processes = @(Get-AuraDesktopProcesses -ExecutablePath $ExecutablePath |
      Where-Object { $_.CreationTime -ge $NotBefore.AddSeconds(-2) })
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port `
      -ErrorAction SilentlyContinue)
    return $processes.Count -eq 0 -and $listeners.Count -eq 0
  }
  if ("$($identity.BrowserId)" -cne $BrowserId -or
      [int]$identity.OwningProcessId -ne $OwningProcessId) {
    return $false
  }
  $process = Get-Process -Id $OwningProcessId -ErrorAction SilentlyContinue
  if ($null -eq $process -or $process.MainWindowHandle -eq [IntPtr]::Zero -or
      -not $process.CloseMainWindow()) {
    return $false
  }
  if (-not $process.WaitForExit(5000)) { return $false }
  $deadline = [DateTime]::UtcNow.AddSeconds(5)
  do {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port `
      -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) { return $true }
    Start-Sleep -Milliseconds 200
  } while ([DateTime]::UtcNow -lt $deadline)
  return $false
}

function Wait-AuraDesktopMainInspectorExit {
  param(
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [Parameter(Mandatory = $true)][datetime]$NotBefore,
    [Parameter(Mandatory = $true)][int]$Port
  )
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  do {
    $processes = @(Get-AuraDesktopProcesses -ExecutablePath $ExecutablePath |
      Where-Object { $_.CreationTime -ge $NotBefore.AddSeconds(-2) })
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port `
      -ErrorAction SilentlyContinue)
    if ($processes.Count -eq 0 -and $listeners.Count -eq 0) { return $true }
    Start-Sleep -Milliseconds 200
  } while ([DateTime]::UtcNow -lt $deadline)
  return $false
}

function Restore-AuraStockDesktop {
  param(
    [Parameter(Mandatory = $true)][string]$AppUserModelId,
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [Parameter(Mandatory = $true)][int]$DiagnosticPort
  )
  if ($AppUserModelId -notmatch '^[A-Za-z0-9._-]{1,128}![A-Za-z0-9._-]{1,128}$') {
    return $false
  }
  $started = [DateTime]::UtcNow
  $explorer = Join-Path $env:WINDIR 'explorer.exe'
  $null = Start-Process -FilePath $explorer `
    -ArgumentList @("shell:AppsFolder\$AppUserModelId") -PassThru
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  do {
    $processes = @(Get-AuraDesktopProcesses -ExecutablePath $ExecutablePath |
      Where-Object { $_.CreationTime -ge $started.AddSeconds(-2) })
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $DiagnosticPort `
      -ErrorAction SilentlyContinue)
    if ($processes.Count -gt 0 -and $listeners.Count -eq 0) { return $true }
    Start-Sleep -Milliseconds 250
  } while ([DateTime]::UtcNow -lt $deadline)
  return $false
}

try {
  $isMainInspector = $Mode -in @('MainInspectorProof', 'MainThemeProof')
  $isThemeInspector = $Mode -ceq 'MainThemeProof'
  if ($isMainInspector -and -not $ConfirmUnsupportedDesktopExperiment) {
    throw 'desktop-main-inspector-consent-required'
  }
  if ($isThemeInspector -and (
      -not $PSBoundParameters.ContainsKey('ThemeId') -or
      -not $PSBoundParameters.ContainsKey('Appearance'))) {
    throw 'desktop-main-inspector-theme-invalid'
  }
  if (-not $isMainInspector -and -not $ConfirmExperimentalGateA) {
    throw 'desktop-presentation-consent-required'
  }
  $install = Get-AuraClaudeInstall
  if ("$($install.Packaging)" -cne 'msix' -or -not $install.AppUserModelId) {
    throw 'desktop-presentation-msix-required'
  }
  if ($script:DesktopPresentationGateACandidateVersions -cnotcontains "$($install.Version)") {
    throw 'desktop-presentation-build-not-authorized'
  }
  if ($Mode -ceq 'Profile' -and -not $script:DesktopPresentationProfileEnabled) {
    throw 'desktop-presentation-profile-not-enabled'
  }
  $executablePath = [IO.Path]::GetFullPath(
    (Get-Item -LiteralPath $install.Executable -ErrorAction Stop).FullName)
  if (-not (Test-AuraAnthropicSignature -Path $executablePath)) {
    throw 'desktop-presentation-signature-invalid'
  }
  $existing = @(Get-AuraDesktopProcesses -ExecutablePath $executablePath)
  if ($existing.Count -gt 0) {
    Write-AuraDesktopPresentationResult @{
      schemaVersion = 1
      status = 'blocked'
      reasonCode = 'desktop-restart-required'
      packageKind = "$($install.Packaging)"
      productVersion = "$($install.Version)"
      signatureValid = $true
      alreadyRunning = $true
    }
    exit 2
  }

  $node = Get-AuraNodeRuntime
  $port = Get-AuraRandomLoopbackPort
  $launchStarted = [DateTime]::UtcNow
  $debugKind = if ($isMainInspector) { 'MainInspector' } else { 'RendererCdp' }
  $launchProcessId = Start-AuraDesktopApplicationActivation `
    -AppUserModelId "$($install.AppUserModelId)" -Port $port -DebugKind $debugKind
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  $identity = $null
  while ($null -eq $identity -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 350
    $identity = if ($isMainInspector) {
      Get-AuraDesktopMainInspectorIdentity -ExecutablePath $executablePath `
        -LaunchProcessId $launchProcessId -NotBefore $launchStarted -Port $port
    } else {
      Get-AuraDesktopEndpointIdentity -ExecutablePath $executablePath `
        -LaunchProcessId $launchProcessId -NotBefore $launchStarted -Port $port
    }
  }
  if ($null -eq $identity) {
    $newProcesses = @(Get-AuraDesktopProcesses -ExecutablePath $executablePath |
      Where-Object { $_.CreationTime -ge $launchStarted.AddSeconds(-2) })
    if ($newProcesses.Count -gt 0) {
      throw 'desktop-presentation-manual-cleanup-required'
    }
    if (-not (Restore-AuraStockDesktop -AppUserModelId $install.AppUserModelId `
        -ExecutablePath $executablePath -DiagnosticPort $port)) {
      throw 'desktop-presentation-stock-relaunch-failed'
    }
    if ($isMainInspector) { throw 'desktop-main-inspector-endpoint-unverified' }
    throw 'desktop-presentation-endpoint-unverified'
  }

  try {
    if ($isMainInspector) {
      $mainInspectorScript = [IO.Path]::GetFullPath(
        (Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\desktop-main-inspector.mjs'))
      $mainInspectorArguments = @(
        '--endpoint', $identity.HttpEndpoint,
        '--inspector-id', $identity.InspectorId,
        '--desktop-version', "$($install.Version)",
        '--packaging', "$($install.Packaging)",
        '--timeout-ms', ($TimeoutSeconds * 1000),
        '--hold-ms', ($HoldSeconds * 1000)
      )
      if ($isThemeInspector) {
        $mainInspectorArguments += @(
          '--theme-id', $ThemeId,
          '--appearance', $Appearance
        )
      }
      $mainInspectorOutput = @(& $node.Path $mainInspectorScript `
        @mainInspectorArguments 2>$null)
      $mainInspectorExitCode = $LASTEXITCODE
      if ($mainInspectorExitCode -ne 0) { throw 'desktop-main-inspector-proof-failed' }
      $mainInspector = ($mainInspectorOutput -join "`n") | ConvertFrom-Json -ErrorAction Stop
      if ("$($mainInspector.status)" -cne 'ok' -or
          -not [bool]$mainInspector.inspectorPinned -or
          -not [bool]$mainInspector.cleanupComplete -or
          -not [bool]$mainInspector.quitScheduled) {
        throw 'desktop-main-inspector-proof-failed'
      }
      if ($isThemeInspector -and (
          -not [bool]$mainInspector.rendererPayloadApplied -or
          -not [bool]$mainInspector.contentAccess -or
          [bool]$mainInspector.contentEgress -or
          "$($mainInspector.themeId)" -cne $ThemeId -or
          "$($mainInspector.appearance)" -cne $Appearance)) {
        throw 'desktop-main-inspector-theme-proof-failed'
      }
    } elseif ($Mode -ceq 'GateA') {
      $probeScript = [IO.Path]::GetFullPath(
        (Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\desktop-probe.mjs'))
      $probeOutput = @(& $node.Path $probeScript `
        --endpoint $identity.HttpEndpoint `
        --browser-id $identity.BrowserId `
        --desktop-version "$($install.Version)" `
        --packaging "$($install.Packaging)" `
        --timeout-ms ($TimeoutSeconds * 1000) 2>$null)
      $probeExitCode = $LASTEXITCODE
      if ($probeExitCode -ne 0) { throw 'desktop-presentation-gate-a-probe-failed' }
      $probe = ($probeOutput -join "`n") | ConvertFrom-Json -ErrorAction Stop
      if ("$($probe.status)" -cne 'ok' -or -not [bool]$probe.browserPinned) {
        throw 'desktop-presentation-gate-a-probe-failed'
      }
    } else {
      $profileScript = [IO.Path]::GetFullPath(
        (Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\desktop-profile.mjs'))
      $profileOutput = @(& $node.Path $profileScript `
        --endpoint $identity.HttpEndpoint `
        --browser-id $identity.BrowserId `
        --timeout-ms ($TimeoutSeconds * 1000) 2>$null)
      $profileExitCode = $LASTEXITCODE
      if ($profileExitCode -ne 0) { throw 'desktop-presentation-profile-failed' }
      $profile = ($profileOutput -join "`n") | ConvertFrom-Json -ErrorAction Stop
      if ("$($profile.status)" -cne 'ok') { throw 'desktop-presentation-profile-failed' }
    }
    if (-not $isMainInspector) {
      $identityAfter = Get-AuraDesktopEndpointIdentity -ExecutablePath $executablePath `
        -LaunchProcessId $launchProcessId -NotBefore $launchStarted -Port $port
      if ($null -eq $identityAfter -or
          "$($identityAfter.BrowserId)" -cne "$($identity.BrowserId)" -or
          [int]$identityAfter.OwningProcessId -ne [int]$identity.OwningProcessId) {
        throw 'desktop-presentation-identity-changed'
      }
    }

    $result = @{
        schemaVersion = 1
        status = 'ok'
        reasonCode = if ($isMainInspector) {
          if ($isThemeInspector) {
            'desktop-main-inspector-theme-proof-complete'
          } else {
            'desktop-main-inspector-proof-complete'
          }
        } elseif ($Mode -ceq 'GateA') {
          'desktop-presentation-gate-a-complete'
        } else {
          'desktop-presentation-profile-complete'
        }
        mode = $Mode
        launchRoute = 'activation-manager'
        packageKind = "$($install.Packaging)"
        productVersion = "$($install.Version)"
        signatureValid = $true
        ownershipMatch = [bool]$identity.OwnershipMatch
        identityStable = $true
        loopbackOnly = [bool]$identity.LoopbackOnly
      }
    if ($isMainInspector) {
      $result.mainInspector = $mainInspector
    } elseif ($Mode -ceq 'GateA') {
      $result.probe = $probe
    } else {
      $result.profile = $profile
    }
  } finally {
    if ($isMainInspector) {
      if (-not (Wait-AuraDesktopMainInspectorExit -ExecutablePath $executablePath `
          -NotBefore $launchStarted -Port $port)) {
        throw 'desktop-main-inspector-manual-cleanup-required'
      }
    } elseif (-not (Close-AuraDesktopDiagnosticInstance -ExecutablePath $executablePath `
        -LaunchProcessId $launchProcessId -NotBefore $launchStarted -Port $port `
        -BrowserId $identity.BrowserId -OwningProcessId $identity.OwningProcessId)) {
      throw 'desktop-presentation-cleanup-failed'
    }
    if (-not (Restore-AuraStockDesktop -AppUserModelId $install.AppUserModelId `
        -ExecutablePath $executablePath -DiagnosticPort $port)) {
      throw 'desktop-presentation-stock-relaunch-failed'
    }
  }
  $result.cleanupComplete = $true
  $result.stockRelaunch = $true
  Write-AuraDesktopPresentationResult $result
} catch {
  $reason = "$($_.Exception.Message)"
  if ($reason -notmatch '^[a-z][a-z0-9-]{1,63}$') {
    $reason = 'desktop-presentation-failed'
  }
  Write-AuraDesktopPresentationResult @{
    schemaVersion = 1
    status = 'blocked'
    reasonCode = $reason
  }
  exit 1
}
