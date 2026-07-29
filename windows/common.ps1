$ErrorActionPreference = 'Stop'
$AuraAppUserModelId = 'ClaudeAura'

function Initialize-AuraShortcutPropertyStore {
  if ('AuraShortcutPropertyStore' -as [type]) { return }
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

public static class AuraShortcutPropertyStore
{
    [ComImport]
    [Guid("00021401-0000-0000-C000-000000000046")]
    private class ShellLink
    {
    }

    [ComImport]
    [Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IPropertyStore
    {
        [PreserveSig] int GetCount(out uint propertyCount);
        [PreserveSig] int GetAt(uint propertyIndex, out PropertyKey key);
        [PreserveSig] int GetValue(ref PropertyKey key, out PropVariant value);
        [PreserveSig] int SetValue(ref PropertyKey key, ref PropVariant value);
        [PreserveSig] int Commit();
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    private struct PropertyKey
    {
        public Guid FormatId;
        public uint PropertyId;

        public PropertyKey(Guid formatId, uint propertyId)
        {
            FormatId = formatId;
            PropertyId = propertyId;
        }
    }

    // PROPVARIANT is 24 bytes on x64 and 16 on x86. The buffer must never be
    // smaller than what the shell writes into an out parameter, so it is sized
    // for the larger layout on both architectures.
    [StructLayout(LayoutKind.Explicit, Size = 24)]
    private struct PropVariant
    {
        [FieldOffset(0)] public ushort ValueType;
        [FieldOffset(8)] public IntPtr PointerValue;
    }

    private const ushort VariantEmpty = 0;
    private const ushort VariantBasicString = 8;
    private const ushort VariantUnicodeString = 31;
    private const int StorageRead = 0;
    private const int StorageReadWrite = 2;
    private static readonly PropertyKey AppUserModelIdKey =
        new PropertyKey(new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), 5);

    [DllImport("ole32.dll")]
    private static extern int PropVariantClear(ref PropVariant value);

    private static void ThrowIfFailed(int result)
    {
        if (result < 0) Marshal.ThrowExceptionForHR(result);
    }

    private static string ReadAppUserModelId(IPropertyStore store)
    {
        PropVariant value;
        PropertyKey key = AppUserModelIdKey;
        ThrowIfFailed(store.GetValue(ref key, out value));
        try
        {
            if (value.ValueType == VariantEmpty) return null;
            if (value.ValueType == VariantBasicString)
            {
                return Marshal.PtrToStringBSTR(value.PointerValue);
            }
            if (value.ValueType == VariantUnicodeString)
            {
                return Marshal.PtrToStringUni(value.PointerValue);
            }
            else
            {
                throw new InvalidOperationException(
                    "The shortcut contains an unsupported AppUserModelID property type.");
            }
        }
        finally
        {
            PropVariantClear(ref value);
        }
    }

    public static string GetAppUserModelId(string path)
    {
        object link = new ShellLink();
        try
        {
            ((IPersistFile)link).Load(path, StorageRead);
            return ReadAppUserModelId((IPropertyStore)link);
        }
        finally
        {
            Marshal.FinalReleaseComObject(link);
        }
    }

    public static void SetAppUserModelId(string path, string appUserModelId)
    {
        object link = new ShellLink();
        PropVariant value = new PropVariant();
        try
        {
            IPersistFile persist = (IPersistFile)link;
            IPropertyStore store = (IPropertyStore)link;
            persist.Load(path, StorageReadWrite);
            if (!String.IsNullOrEmpty(appUserModelId))
            {
                value.ValueType = VariantUnicodeString;
                value.PointerValue = Marshal.StringToCoTaskMemUni(appUserModelId);
            }
            PropertyKey key = AppUserModelIdKey;
            ThrowIfFailed(store.SetValue(ref key, ref value));
            ThrowIfFailed(store.Commit());
            persist.Save(path, true);
        }
        finally
        {
            PropVariantClear(ref value);
            Marshal.FinalReleaseComObject(link);
        }
    }
}
'@
}

function Get-AuraShortcutAppUserModelId {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "The shortcut does not exist: $Path"
  }
  Initialize-AuraShortcutPropertyStore
  return [AuraShortcutPropertyStore]::GetAppUserModelId([IO.Path]::GetFullPath($Path))
}

function Set-AuraShortcutAppUserModelId {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [AllowNull()][AllowEmptyString()][string]$AppUserModelId = $AuraAppUserModelId
  )
  $normalizedAppUserModelId = if ([string]::IsNullOrEmpty($AppUserModelId)) {
    $null
  } else { $AppUserModelId }
  if ($null -ne $normalizedAppUserModelId -and
      $normalizedAppUserModelId -cne $AuraAppUserModelId) {
    throw 'Claude Aura shortcuts may use only the Claude Aura AppUserModelID.'
  }
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "The shortcut does not exist: $Path"
  }
  Initialize-AuraShortcutPropertyStore
  $fullPath = [IO.Path]::GetFullPath($Path)
  [AuraShortcutPropertyStore]::SetAppUserModelId($fullPath, $normalizedAppUserModelId)
  $actual = [AuraShortcutPropertyStore]::GetAppUserModelId($fullPath)
  if ($null -eq $normalizedAppUserModelId) {
    if ($actual) { throw 'The shortcut AppUserModelID could not be cleared.' }
  } elseif (-not [string]::Equals(
      $actual, $normalizedAppUserModelId, [StringComparison]::Ordinal)) {
    throw 'The shortcut AppUserModelID could not be verified.'
  }
}

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

function Get-AuraClaudeMsixApplicationIdentity {
  param([Parameter(Mandatory = $true)][object]$Install)
  if ("$($Install.Packaging)" -cne 'msix' -or
      "$($Install.PackageFamilyName)" -cne 'Claude_pzs8sxrjxfjjc' -or
      -not $Install.PackageFullName) {
    throw 'desktop-msix-required'
  }
  $packageFullName = "$($Install.PackageFullName)"
  if ($packageFullName -cnotmatch '^[A-Za-z0-9._-]{1,256}$') {
    throw 'desktop-application-identity-unavailable'
  }
  try {
    $manifest = Get-AppxPackageManifest -Package $packageFullName -ErrorAction Stop
    $applications = @($manifest.Package.Applications.Application | Where-Object {
      "$($_.Executable)".Replace('/', '\') -ieq 'app\Claude.exe'
    })
  } catch {
    throw 'desktop-application-identity-unavailable'
  }
  if ($applications.Count -ne 1) {
    throw 'desktop-application-identity-unavailable'
  }
  $applicationId = "$($applications[0].Id)"
  $packageFamilyName = "$($Install.PackageFamilyName)"
  if ($applicationId -cnotmatch '^[A-Za-z0-9._-]{1,64}$') {
    throw 'desktop-application-identity-unavailable'
  }
  return [pscustomobject]@{
    ApplicationId = $applicationId
    AppUserModelId = "$packageFamilyName!$applicationId"
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
