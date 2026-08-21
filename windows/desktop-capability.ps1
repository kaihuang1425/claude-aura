[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

function Write-AuraDesktopCapability {
  param([Parameter(Mandatory = $true)][hashtable]$Result)
  $Result | ConvertTo-Json -Depth 6 -Compress
}

try {
  $install = Get-AuraClaudeInstall
} catch {
  Write-AuraDesktopCapability @{
    schemaVersion = 2
    status = 'blocked'
    reasonCode = 'desktop-not-found'
    install = $null
    alreadyRunning = $null
    processCount = $null
  }
  exit 0
}

$packageKind = "$($install.Packaging)"
$applicationId = "$($install.ApplicationId)"
$appUserModelId = "$($install.AppUserModelId)"
$msixIdentityValid = (
  $packageKind -ceq 'msix' -and
  "$($install.PackageFamilyName)" -ceq 'Claude_pzs8sxrjxfjjc' -and
  $applicationId -cmatch '^[A-Za-z0-9._-]{1,64}$' -and
  $appUserModelId -ceq "Claude_pzs8sxrjxfjjc!$applicationId"
)

if (-not $msixIdentityValid) {
  Write-AuraDesktopCapability @{
    schemaVersion = 2
    status = 'blocked'
    reasonCode = if ($packageKind -cne 'msix') {
      'desktop-msix-required'
    } else {
      'desktop-application-identity-unavailable'
    }
    install = @{
      packageKind = $packageKind
      signatureValid = $true
      productVersion = "$($install.Version)"
      applicationId = $null
      appUserModelId = $null
    }
    alreadyRunning = $null
    processCount = $null
  }
  exit 0
}

$executablePath = [IO.Path]::GetFullPath(
  (Get-Item -LiteralPath $install.Executable -ErrorAction Stop).FullName)
$signatureValid = Test-AuraAnthropicSignature -Path $executablePath
if (-not $signatureValid) {
  Write-AuraDesktopCapability @{
    schemaVersion = 2
    status = 'blocked'
    reasonCode = 'desktop-signature-invalid'
    install = @{
      packageKind = "$($install.Packaging)"
      signatureValid = $false
      productVersion = "$($install.Version)"
      applicationId = "$($install.ApplicationId)"
      appUserModelId = "$($install.AppUserModelId)"
    }
    alreadyRunning = $null
    processCount = $null
  }
  exit 0
}

try {
  $candidates = @(Get-CimInstance -ClassName Win32_Process -Filter "Name = 'Claude.exe'" `
    -Property ProcessId, ParentProcessId, ExecutablePath, CreationDate -ErrorAction Stop)
} catch {
  Write-AuraDesktopCapability @{
    schemaVersion = 2
    status = 'blocked'
    reasonCode = 'desktop-process-discovery-unavailable'
    install = @{
      packageKind = "$($install.Packaging)"
      signatureValid = $true
      productVersion = "$($install.Version)"
      applicationId = "$($install.ApplicationId)"
      appUserModelId = "$($install.AppUserModelId)"
    }
    alreadyRunning = $null
    processCount = $null
  }
  exit 0
}

$processes = @()
foreach ($candidate in $candidates) {
  if (-not $candidate.ExecutablePath -or
      -not (Test-AuraPathEqual -Left "$($candidate.ExecutablePath)" -Right $executablePath)) {
    continue
  }
  $created = if ($candidate.CreationDate -is [datetime]) {
    $candidate.CreationDate.ToUniversalTime()
  } else {
    [Management.ManagementDateTimeConverter]::ToDateTime(
      "$($candidate.CreationDate)").ToUniversalTime()
  }
  $processes += @{
    pid = [int]$candidate.ProcessId
    parentPid = [int]$candidate.ParentProcessId
    creationTime = $created.ToString('o')
  }
}

if ($processes.Count -gt 32) {
  Write-AuraDesktopCapability @{
    schemaVersion = 2
    status = 'blocked'
    reasonCode = 'desktop-process-set-oversized'
    install = @{
      packageKind = "$($install.Packaging)"
      signatureValid = $true
      productVersion = "$($install.Version)"
      applicationId = "$($install.ApplicationId)"
      appUserModelId = "$($install.AppUserModelId)"
    }
    alreadyRunning = $null
    processCount = $null
  }
  exit 0
}

Write-AuraDesktopCapability @{
  schemaVersion = 2
  status = 'ok'
  reasonCode = if ($processes.Count) { 'desktop-running' } else { 'desktop-installed-not-running' }
  install = @{
    packageKind = "$($install.Packaging)"
    signatureValid = $true
    productVersion = "$($install.Version)"
    applicationId = "$($install.ApplicationId)"
    appUserModelId = "$($install.AppUserModelId)"
  }
  alreadyRunning = [bool]$processes.Count
  processCount = [int]$processes.Count
}
