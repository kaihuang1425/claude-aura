[CmdletBinding()]
param(
  [ValidateSet('Profile')]
  [string]$Mode = 'Profile',
  [ValidateRange(10, 120)]
  [int]$TimeoutSeconds = 45,
  [switch]$ConfirmExperimentalGateA
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

$script:DesktopPresentationGateAEnabled = $false

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

function Start-AuraDesktopPackage {
  param(
    [Parameter(Mandatory = $true)][string]$ExecutablePath,
    [Parameter(Mandatory = $true)][int]$Port
  )
  if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf) -or
      -not (Test-AuraAnthropicSignature -Path $ExecutablePath)) {
    throw 'The registered Claude Desktop executable is invalid.'
  }
  if ($Port -lt 1024 -or $Port -gt 65535) { throw 'The Desktop CDP port is invalid.' }
  $process = Start-Process -FilePath $ExecutablePath -ArgumentList @(
    '--remote-debugging-address=127.0.0.1',
    "--remote-debugging-port=$Port"
  ) -PassThru
  if ($null -eq $process -or $process.Id -le 0) {
    throw 'Windows did not return a Claude Desktop process identity.'
  }
  return $process
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
    [Parameter(Mandatory = $true)][int]$LaunchProcessId,
    [Parameter(Mandatory = $true)][datetime]$NotBefore,
    [Parameter(Mandatory = $true)][int]$Port
  )
  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
    throw 'Get-NetTCPConnection is required to verify Desktop endpoint ownership.'
  }
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($listeners.Count -ne 1 -or "$($listeners[0].LocalAddress)" -cne '127.0.0.1') {
    return $null
  }
  $processes = @(Get-AuraDesktopProcesses -ExecutablePath $ExecutablePath)
  $ownerProcessId = [int]$listeners[0].OwningProcess
  $owner = @($processes | Where-Object { $_.ProcessId -eq $ownerProcessId })
  if ($owner.Count -ne 1 -or $owner[0].CreationTime -lt $NotBefore.AddSeconds(-2) -or
      -not (Test-AuraDesktopLaunchLineage -Processes $processes `
        -OwnerProcessId $ownerProcessId -LaunchProcessId $LaunchProcessId)) {
    return $null
  }
  try {
    $version = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" `
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
  if (-not $ConfirmExperimentalGateA) {
    throw 'desktop-presentation-consent-required'
  }
  if (-not $script:DesktopPresentationGateAEnabled) {
    throw 'desktop-presentation-gate-a-no-go'
  }
  $install = Get-AuraClaudeInstall
  if ("$($install.Packaging)" -cne 'msix') {
    throw 'desktop-presentation-msix-required'
  }
  $applicationIdentity = Get-AuraClaudeMsixApplicationIdentity -Install $install
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
  $launchProcess = Start-AuraDesktopPackage -ExecutablePath $executablePath -Port $port
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  $identity = $null
  while ($null -eq $identity -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 350
    $identity = Get-AuraDesktopEndpointIdentity -ExecutablePath $executablePath `
      -LaunchProcessId $launchProcess.Id -NotBefore $launchStarted -Port $port
  }
  if ($null -eq $identity) {
    $newProcesses = @(Get-AuraDesktopProcesses -ExecutablePath $executablePath |
      Where-Object { $_.CreationTime -ge $launchStarted.AddSeconds(-2) })
    if ($newProcesses.Count -gt 0) {
      throw 'desktop-presentation-manual-cleanup-required'
    }
    if (-not (Restore-AuraStockDesktop `
        -AppUserModelId $applicationIdentity.AppUserModelId `
        -ExecutablePath $executablePath -DiagnosticPort $port)) {
      throw 'desktop-presentation-stock-relaunch-failed'
    }
    throw 'desktop-presentation-endpoint-unverified'
  }

  try {
    $profileScript = [IO.Path]::GetFullPath(
      (Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\desktop-profile.mjs'))
    $profileOutput = @(& $node.Path $profileScript `
      --endpoint "http://127.0.0.1:$port/" `
      --browser-id $identity.BrowserId `
      --timeout-ms ($TimeoutSeconds * 1000) 2>$null)
    $profileExitCode = $LASTEXITCODE
    if ($profileExitCode -ne 0) { throw 'desktop-presentation-profile-failed' }
    $profile = ($profileOutput -join "`n") | ConvertFrom-Json -ErrorAction Stop
    if ("$($profile.status)" -cne 'ok') { throw 'desktop-presentation-profile-failed' }
    $identityAfter = Get-AuraDesktopEndpointIdentity -ExecutablePath $executablePath `
      -LaunchProcessId $launchProcess.Id -NotBefore $launchStarted -Port $port
    if ($null -eq $identityAfter -or
        "$($identityAfter.BrowserId)" -cne "$($identity.BrowserId)" -or
        [int]$identityAfter.OwningProcessId -ne [int]$identity.OwningProcessId) {
      throw 'desktop-presentation-identity-changed'
    }

    $result = @{
      schemaVersion = 1
      status = 'ok'
      reasonCode = 'desktop-presentation-profile-complete'
      packageKind = "$($install.Packaging)"
      productVersion = "$($install.Version)"
      signatureValid = $true
      ownershipMatch = [bool]$identity.OwnershipMatch
      identityStable = $true
      loopbackOnly = [bool]$identity.LoopbackOnly
      profile = $profile
    }
  } finally {
    if (-not (Close-AuraDesktopDiagnosticInstance -ExecutablePath $executablePath `
        -LaunchProcessId $launchProcess.Id -NotBefore $launchStarted -Port $port `
        -BrowserId $identity.BrowserId -OwningProcessId $identity.OwningProcessId)) {
      throw 'desktop-presentation-cleanup-failed'
    }
    if (-not (Restore-AuraStockDesktop `
        -AppUserModelId $applicationIdentity.AppUserModelId `
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
