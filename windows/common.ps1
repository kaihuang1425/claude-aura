$ErrorActionPreference = 'Stop'

function Enter-AuraOperationLock {
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = [System.Threading.Mutex]::new($false, "Local\ClaudeAura.$sid.Operation")
  $acquired = $false
  try { $acquired = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $acquired = $true }
  if (-not $acquired) {
    $mutex.Dispose()
    throw 'Another Claude Aura install or check is already running.'
  }
  return $mutex
}

function Exit-AuraOperationLock {
  param([Parameter(Mandatory = $true)][System.Threading.Mutex]$Mutex)
  try { $Mutex.ReleaseMutex() } finally { $Mutex.Dispose() }
}

function Test-AuraUiHostRunning {
  $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $probe = $null
  try {
    $probe = [System.Threading.Mutex]::OpenExisting("Local\ClaudeAura.$sid.Ui")
    return $true
  } catch [System.Threading.WaitHandleCannotBeOpenedException] {
    return $false
  } finally {
    if ($null -ne $probe) { $probe.Dispose() }
  }
}

function Test-AuraPathEqual {
  param([string]$Left, [string]$Right)
  if (-not $Left -or -not $Right) { return $false }
  try {
    return ([System.IO.Path]::GetFullPath($Left).TrimEnd('\') -ieq [System.IO.Path]::GetFullPath($Right).TrimEnd('\'))
  } catch { return $false }
}

function Get-AuraNodeRuntime {
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $command) { $command = Get-Command node -ErrorAction SilentlyContinue }
  if (-not $command) { throw 'Node.js 22 or newer is required. Install it, then open Claude Aura again.' }
  $version = "$(& $command.Source -p 'process.versions.node' 2>$null)".Trim()
  $runtimePath = "$(& $command.Source -p 'process.execPath' 2>$null)".Trim()
  $major = 0
  if ($LASTEXITCODE -ne 0 -or -not [int]::TryParse(($version -split '\.')[0], [ref]$major) -or $major -lt 22) {
    throw "Node.js 22 or newer is required; found $version."
  }
  if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { throw 'The Node.js executable path could not be validated.' }
  return [pscustomobject]@{ Path = $runtimePath; Version = $version }
}

function Test-AuraAnthropicSignature {
  param([Parameter(Mandatory = $true)][string]$Path)
  try {
    $signature = Get-AuthenticodeSignature -LiteralPath $Path -ErrorAction Stop
    return $signature.Status -eq [System.Management.Automation.SignatureStatus]::Valid -and
      "$($signature.SignerCertificate.Subject)" -match '(?i)Anthropic'
  } catch { return $false }
}

function ConvertTo-AuraMsixInstall {
  param([Parameter(Mandatory = $true)][object]$Package)
  if ("$($Package.PackageFamilyName)" -ine 'Claude_pzs8sxrjxfjjc' -or
      -not $Package.InstallLocation -or [bool]$Package.IsDevelopmentMode) { return $null }
  $root = "$($Package.InstallLocation)"
  $executable = Join-Path $root 'app\Claude.exe'
  if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { return $null }
  if (-not (Test-AuraAnthropicSignature -Path $executable)) { return $null }
  return [pscustomobject]@{
    Packaging = 'msix'
    Root = $root
    Executable = $executable
    Version = "$($Package.Version)"
    PackageFullName = "$($Package.PackageFullName)"
    PackageFamilyName = "$($Package.PackageFamilyName)"
  }
}

function Get-AuraClaudeInstall {
  $packages = @()
  try { $packages = @(Get-AppxPackage -Name 'Claude' -ErrorAction Stop | Sort-Object Version -Descending) } catch {}
  foreach ($package in $packages) {
    $install = ConvertTo-AuraMsixInstall -Package $package
    if ($null -ne $install) { return $install }
  }

  foreach ($candidate in @(
    (Join-Path $env:LOCALAPPDATA 'AnthropicClaude\claude.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Claude\Claude.exe'),
    (Join-Path $env:LOCALAPPDATA 'Claude\Claude.exe')
  )) {
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    if (-not (Test-AuraAnthropicSignature -Path $candidate)) { continue }
    $item = Get-Item -LiteralPath $candidate
    return [pscustomobject]@{
      Packaging = 'desktop'
      Root = $item.Directory.FullName
      Executable = $item.FullName
      Version = "$($item.VersionInfo.ProductVersion)"
      PackageFullName = $null
      PackageFamilyName = $null
    }
  }
  throw 'The official Claude Desktop app was not found. The themed Aura window still works without it.'
}
