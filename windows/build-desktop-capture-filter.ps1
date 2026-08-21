[CmdletBinding()]
param([switch]$Force)

$ErrorActionPreference = 'Stop'

function Write-AuraDesktopCaptureBuildResult {
  param([Parameter(Mandatory = $true)][hashtable]$Result)
  $Result | ConvertTo-Json -Depth 4 -Compress
}

function ConvertTo-AuraDesktopCaptureBuildArgument {
  param([Parameter(Mandatory = $true)][string]$Value)
  return '"' + $Value.Replace('"', '\"') + '"'
}

try {
  if (-not [Environment]::Is64BitOperatingSystem -or
      -not [Environment]::Is64BitProcess) {
    throw 'desktop-capture-build-x64-required'
  }
  $projectRoot = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
  $sourcePath = [IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot 'native\desktop-capture-filter.cpp'))
  $sourceItem = Get-Item -LiteralPath $sourcePath -Force -ErrorAction Stop
  if ($sourceItem.PSIsContainer -or $sourceItem.Length -le 0 -or
      $sourceItem.Length -gt 524288 -or
      ($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'desktop-capture-build-source-invalid'
  }
  $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
  $buildRoot = [IO.Path]::GetFullPath(
    (Join-Path $projectRoot 'dist\desktop-capture-filter'))
  if (-not $buildRoot.StartsWith(
      $projectRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'desktop-capture-build-output-invalid'
  }
  if (-not (Test-Path -LiteralPath $buildRoot -PathType Container)) {
    [void](New-Item -ItemType Directory -Path $buildRoot)
  }
  $buildRootItem = Get-Item -LiteralPath $buildRoot -Force -ErrorAction Stop
  if (-not $buildRootItem.PSIsContainer -or
      ($buildRootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'desktop-capture-build-output-invalid'
  }
  $shortHash = $sourceHash.Substring(0, 16).ToLowerInvariant()
  $executablePath = Join-Path $buildRoot "desktop-capture-filter-$shortHash.exe"
  $objectPath = Join-Path $buildRoot "desktop-capture-filter-$shortHash.obj"
  $buildPerformed = $false
  if ($Force -or -not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
    $vswherePath = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
    if (-not (Test-Path -LiteralPath $vswherePath -PathType Leaf)) {
      throw 'desktop-capture-build-toolchain-unavailable'
    }
    $vcvarsPath = (& $vswherePath -latest -products * `
      -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
      -find 'VC\Auxiliary\Build\vcvars64.bat' | Select-Object -First 1)
    if (-not $vcvarsPath -or
        -not (Test-Path -LiteralPath $vcvarsPath -PathType Leaf)) {
      throw 'desktop-capture-build-toolchain-unavailable'
    }
    $compileArguments = @(
      '/nologo', '/std:c++20', '/EHsc', '/permissive-', '/W4', '/O2',
      '/DUNICODE', '/D_UNICODE',
      ('/Fo:' + (ConvertTo-AuraDesktopCaptureBuildArgument -Value $objectPath)),
      ('/Fe:' + (ConvertTo-AuraDesktopCaptureBuildArgument -Value $executablePath)),
      (ConvertTo-AuraDesktopCaptureBuildArgument -Value $sourcePath),
      'd3d11.lib', 'dxgi.lib', 'd3dcompiler.lib', 'dwmapi.lib',
      'windowscodecs.lib', 'windowsapp.lib', 'runtimeobject.lib', 'user32.lib'
    ) -join ' '
    $compileCommand = 'call ' +
      (ConvertTo-AuraDesktopCaptureBuildArgument -Value $vcvarsPath) +
      ' >nul && cl.exe ' + $compileArguments
    $compilerOutput = @(& $env:ComSpec /d /s /c $compileCommand 2>&1)
    $compilerExitCode = $LASTEXITCODE
    if ($compilerExitCode -ne 0 -or
        -not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
      throw 'desktop-capture-build-compile-failed'
    }
    $buildPerformed = $true
  }
  $executableItem = Get-Item -LiteralPath $executablePath -Force -ErrorAction Stop
  if ($executableItem.PSIsContainer -or $executableItem.Length -lt 65536 -or
      $executableItem.Length -gt 2097152 -or
      ($executableItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'desktop-capture-build-output-invalid'
  }
  $executableHash = (Get-FileHash -LiteralPath $executablePath -Algorithm SHA256).Hash
  Write-AuraDesktopCaptureBuildResult @{
    schemaVersion = 1
    status = 'ok'
    reasonCode = 'desktop-capture-build-complete'
    sourceOnly = $true
    buildPerformed = [bool]$buildPerformed
    sourceHash = $sourceHash
    executableHash = $executableHash
    executablePath = $executablePath
    executableBytes = [int64]$executableItem.Length
  }
  exit 0
} catch {
  $reasonCode = if ($_.Exception.Message -cmatch '^desktop-capture-build-[a-z0-9-]+$') {
    $_.Exception.Message
  } else {
    'desktop-capture-build-failed'
  }
  Write-AuraDesktopCaptureBuildResult @{
    schemaVersion = 1
    status = 'blocked'
    reasonCode = $reasonCode
    sourceOnly = $true
  }
  exit 2
}
