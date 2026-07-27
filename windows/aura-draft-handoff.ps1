# Claude Aura experimental draft-handoff-v1
#
# This release-excluded capability accepts one authenticated, memory-only test
# body for explicit review in Prompt Shelf. It never saves or submits the body.
# The normal Aura startup path leaves the capability disabled.

$script:DraftHandoffProtocolVersion = 1
$script:DraftHandoffMaxControlBytes = 8192
$script:DraftHandoffMaxBodyBytes = 65536
$script:DraftHandoffKeyBytes = 32
$script:DraftHandoffGrantMilliseconds = 300000
$script:DraftHandoffReviewMilliseconds = 600000
$script:DraftHandoffRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\draft-handoff-v1'
$script:DraftHandoffDescriptorPath = Join-Path $script:DraftHandoffRoot 'descriptor.json'
$script:DraftHandoffKeyPath = Join-Path $script:DraftHandoffRoot 'key.bin'
$script:DraftHandoffEnabled = $false
$script:DraftHandoffDescriptor = $null
$script:DraftHandoffKey = $null
$script:DraftHandoffPrivateTarget = ''
$script:DraftHandoffPipe = $null
$script:DraftHandoffAcceptTask = $null
$script:DraftHandoffReadState = $null
$script:DraftHandoffWriteState = $null
$script:DraftHandoffDisconnectTask = $null
$script:DraftHandoffDisconnectBuffer = $null
$script:DraftHandoffPhase = 'disabled'
$script:DraftHandoffHello = $null
$script:DraftHandoffServerReady = $null
$script:DraftHandoffBodyProof = $null
$script:DraftHandoffAttemptConsumed = $false
$script:DraftHandoffRejectedConnections = 0
$script:DraftHandoffTransient = $null
$script:DraftHandoffPendingInsertReceipt = $false
$script:DraftHandoffLastCommandSequence = [long]0
$script:DraftHandoffIoDeadlineUtc = [DateTime]::MinValue
$script:DraftHandoffUtf8 = [Text.UTF8Encoding]::new($false, $true)

function Write-AuraDraftHandoffEvent {
  param([Parameter(Mandatory = $true)][string]$Code)
  try { Write-AuraUiLog -Message "Draft handoff event: $Code" } catch {}
}

function Test-AuraDraftHandoffUuid {
  param([AllowNull()][object]$Value)
  return $Value -is [string] -and
    $Value -cmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
}

function Test-AuraDraftHandoffNonce {
  param([AllowNull()][object]$Value)
  return $Value -is [string] -and $Value -cmatch '^[0-9a-f]{64}$'
}

function Test-AuraDraftHandoffInteger {
  param([AllowNull()][object]$Value)
  return ($Value -is [int] -or $Value -is [long]) -and [long]$Value -ge 0
}

function Test-AuraDraftHandoffBodyBytes {
  param([Parameter(Mandatory = $true)][byte[]]$Body)
  if ($Body.Length -lt 1 -or $Body.Length -gt $script:DraftHandoffMaxBodyBytes) {
    return $false
  }
  try {
    [void]$script:DraftHandoffUtf8.GetString($Body)
  } catch {
    return $false
  }
  for ($index = 0; $index -lt $Body.Length; $index += 1) {
    $value = [int]$Body[$index]
    if (($value -lt 0x20 -and $value -notin @(0x09, 0x0a, 0x0d)) -or
        $value -eq 0x7f -or
        ($value -eq 0xc2 -and $index + 1 -lt $Body.Length -and
          [int]$Body[$index + 1] -ge 0x80 -and
          [int]$Body[$index + 1] -le 0x9f)) {
      return $false
    }
  }
  return $true
}

function Test-AuraDraftHandoffExactFields {
  param(
    [Parameter(Mandatory = $true)][object]$Message,
    [Parameter(Mandatory = $true)][string[]]$Fields
  )
  if ($Message -isnot [Management.Automation.PSCustomObject]) { return $false }
  $names = @($Message.PSObject.Properties | ForEach-Object { $_.Name })
  if ($names.Count -ne $Fields.Count) { return $false }
  for ($index = 0; $index -lt $Fields.Count; $index += 1) {
    if ([string]$names[$index] -cne [string]$Fields[$index]) { return $false }
  }
  return $true
}

function ConvertTo-AuraDraftHandoffJsonBytes {
  param([Parameter(Mandatory = $true)][object]$Value)
  $json = $Value | ConvertTo-Json -Compress -Depth 4
  return $script:DraftHandoffUtf8.GetBytes($json)
}

function ConvertFrom-AuraDraftHandoffControlBytes {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  if ($Bytes.Length -lt 2 -or $Bytes.Length -gt $script:DraftHandoffMaxControlBytes) {
    throw 'control-frame-invalid'
  }
  try {
    $text = $script:DraftHandoffUtf8.GetString($Bytes)
    $message = $text | ConvertFrom-Json
    if ($message -isnot [Management.Automation.PSCustomObject]) {
      throw 'control-frame-invalid'
    }
    $canonical = $message | ConvertTo-Json -Compress -Depth 4
    if ($canonical -cne $text) { throw 'control-frame-invalid' }
    return $message
  } catch {
    throw 'control-frame-invalid'
  } finally {
    $text = $null
    $canonical = $null
  }
}

function ConvertFrom-AuraDraftHandoffHex {
  param(
    [Parameter(Mandatory = $true)][string]$Value,
    [Parameter(Mandatory = $true)][int]$Bytes
  )
  if ($Value -cnotmatch ('^[0-9a-f]{' + ($Bytes * 2) + '}$')) {
    throw 'hex-invalid'
  }
  $result = [byte[]]::new($Bytes)
  for ($index = 0; $index -lt $Bytes; $index += 1) {
    $result[$index] = [Convert]::ToByte($Value.Substring($index * 2, 2), 16)
  }
  return $result
}

function Get-AuraDraftHandoffMac {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][object]$Unsigned,
    [AllowNull()][byte[]]$Body = $null
  )
  if ($null -eq $script:DraftHandoffKey -or
      $script:DraftHandoffKey.Length -ne $script:DraftHandoffKeyBytes) {
    throw 'key-unavailable'
  }
  $prefix = $script:DraftHandoffUtf8.GetBytes("draft-handoff-v1`0$Label`0")
  $json = ConvertTo-AuraDraftHandoffJsonBytes -Value $Unsigned
  $bodyLength = if ($null -eq $Body) { 0 } else { $Body.Length }
  $separatorLength = if ($null -eq $Body) { 0 } else { 1 }
  $input = [byte[]]::new($prefix.Length + $json.Length + $separatorLength + $bodyLength)
  try {
    [Array]::Copy($prefix, 0, $input, 0, $prefix.Length)
    [Array]::Copy($json, 0, $input, $prefix.Length, $json.Length)
    if ($null -ne $Body) {
      $input[$prefix.Length + $json.Length] = 0
      [Array]::Copy(
        $Body, 0, $input, $prefix.Length + $json.Length + 1, $Body.Length)
    }
    $hmac = [Security.Cryptography.HMACSHA256]::new($script:DraftHandoffKey)
    try {
      $hash = $hmac.ComputeHash($input)
      try {
        return ([BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
      } finally {
        [Array]::Clear($hash, 0, $hash.Length)
      }
    } finally {
      $hmac.Dispose()
    }
  } finally {
    [Array]::Clear($prefix, 0, $prefix.Length)
    [Array]::Clear($json, 0, $json.Length)
    [Array]::Clear($input, 0, $input.Length)
  }
}

function Test-AuraDraftHandoffMac {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][object]$Unsigned,
    [AllowNull()][object]$Mac,
    [AllowNull()][byte[]]$Body = $null
  )
  if ($Mac -isnot [string] -or $Mac -cnotmatch '^[0-9a-f]{64}$') { return $false }
  $expectedText = Get-AuraDraftHandoffMac -Label $Label -Unsigned $Unsigned -Body $Body
  $expected = $null
  $actual = $null
  try {
    $expected = ConvertFrom-AuraDraftHandoffHex -Value $expectedText -Bytes 32
    $actual = ConvertFrom-AuraDraftHandoffHex -Value $Mac -Bytes 32
    $difference = 0
    for ($index = 0; $index -lt 32; $index += 1) {
      $difference = $difference -bor ($expected[$index] -bxor $actual[$index])
    }
    return $difference -eq 0
  } finally {
    if ($null -ne $expected) { [Array]::Clear($expected, 0, $expected.Length) }
    if ($null -ne $actual) { [Array]::Clear($actual, 0, $actual.Length) }
    $expectedText = $null
  }
}

function New-AuraDraftHandoffRandomBytes {
  param([Parameter(Mandatory = $true)][int]$Count)
  $bytes = [byte[]]::new($Count)
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return $bytes
}

function New-AuraDraftHandoffNonce {
  $bytes = New-AuraDraftHandoffRandomBytes -Count 32
  try {
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
}

function Assert-AuraDraftHandoffFixedPath {
  param([Parameter(Mandatory = $true)][string]$Path)
  $expectedRoot = [IO.Path]::GetFullPath($script:DraftHandoffRoot).TrimEnd('\')
  $resolved = [IO.Path]::GetFullPath($Path)
  if (-not $resolved.StartsWith($expectedRoot + '\', [StringComparison]::OrdinalIgnoreCase) -and
      -not [string]::Equals($resolved, $expectedRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'discovery-path-invalid'
  }
  if (Test-Path -LiteralPath $Path) {
    $item = Get-Item -LiteralPath $Path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'discovery-path-redirected'
    }
  }
}

function Set-AuraDraftHandoffSecureAcl {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$Directory
  )
  Assert-AuraDraftHandoffFixedPath -Path $Path
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if ($null -eq $sid) { throw 'current-user-unavailable' }
  $inheritance = if ($Directory) {
    [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
      [Security.AccessControl.InheritanceFlags]::ObjectInherit
  } else {
    [Security.AccessControl.InheritanceFlags]::None
  }
  $security = if ($Directory) {
    [Security.AccessControl.DirectorySecurity]::new()
  } else {
    [Security.AccessControl.FileSecurity]::new()
  }
  $security.SetAccessRuleProtection($true, $false)
  $security.SetOwner($sid)
  [void]$security.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
      $sid,
      [Security.AccessControl.FileSystemRights]::FullControl,
      $inheritance,
      [Security.AccessControl.PropagationFlags]::None,
      [Security.AccessControl.AccessControlType]::Allow))
  if ($Directory) {
    [IO.Directory]::SetAccessControl($Path, $security)
    $applied = [IO.Directory]::GetAccessControl($Path)
  } else {
    [IO.File]::SetAccessControl($Path, $security)
    $applied = [IO.File]::GetAccessControl($Path)
  }
  $owner = $applied.GetOwner([Security.Principal.SecurityIdentifier])
  $rules = @($applied.GetAccessRules(
      $true, $false, [Security.Principal.SecurityIdentifier]))
  if (-not $applied.AreAccessRulesProtected -or
      $null -eq $owner -or $owner.Value -cne $sid.Value -or
      $rules.Count -ne 1 -or
      $rules[0].IdentityReference.Value -cne $sid.Value -or
      $rules[0].AccessControlType -ne
        [Security.AccessControl.AccessControlType]::Allow -or
      ($rules[0].FileSystemRights -band
        [Security.AccessControl.FileSystemRights]::FullControl) -ne
        [Security.AccessControl.FileSystemRights]::FullControl) {
    throw 'discovery-acl-invalid'
  }
}

function Remove-AuraDraftHandoffDiscovery {
  foreach ($path in @($script:DraftHandoffDescriptorPath, $script:DraftHandoffKeyPath)) {
    try {
      Assert-AuraDraftHandoffFixedPath -Path $path
      if (Test-Path -LiteralPath $path -PathType Leaf) {
        Remove-Item -LiteralPath $path -Force
      }
    } catch {}
  }
  try {
    Assert-AuraDraftHandoffFixedPath -Path $script:DraftHandoffRoot
    if ((Test-Path -LiteralPath $script:DraftHandoffRoot -PathType Container) -and
        @(Get-ChildItem -LiteralPath $script:DraftHandoffRoot -Force).Count -eq 0) {
      Remove-Item -LiteralPath $script:DraftHandoffRoot -Force
    }
  } catch {}
}

function Write-AuraDraftHandoffDiscovery {
  Assert-AuraDraftHandoffFixedPath -Path $script:DraftHandoffRoot
  if (-not (Test-Path -LiteralPath $script:DraftHandoffRoot -PathType Container)) {
    [void][IO.Directory]::CreateDirectory($script:DraftHandoffRoot)
  }
  Set-AuraDraftHandoffSecureAcl -Path $script:DraftHandoffRoot -Directory
  foreach ($path in @($script:DraftHandoffDescriptorPath, $script:DraftHandoffKeyPath)) {
    Assert-AuraDraftHandoffFixedPath -Path $path
    if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path -Force }
  }

  $keyTemporary = Join-Path $script:DraftHandoffRoot (
    '.key-' + [Guid]::NewGuid().ToString('N') + '.tmp')
  $descriptorTemporary = Join-Path $script:DraftHandoffRoot (
    '.descriptor-' + [Guid]::NewGuid().ToString('N') + '.tmp')
  Assert-AuraDraftHandoffFixedPath -Path $keyTemporary
  Assert-AuraDraftHandoffFixedPath -Path $descriptorTemporary
  $descriptorBytes = $null
  try {
    [IO.File]::WriteAllBytes($keyTemporary, $script:DraftHandoffKey)
    Set-AuraDraftHandoffSecureAcl -Path $keyTemporary
    [IO.File]::Move($keyTemporary, $script:DraftHandoffKeyPath)
    Set-AuraDraftHandoffSecureAcl -Path $script:DraftHandoffKeyPath

    $descriptorBytes = ConvertTo-AuraDraftHandoffJsonBytes -Value $script:DraftHandoffDescriptor
    if ($descriptorBytes.Length -gt 4096) { throw 'descriptor-too-large' }
    [IO.File]::WriteAllBytes($descriptorTemporary, $descriptorBytes)
    Set-AuraDraftHandoffSecureAcl -Path $descriptorTemporary
    [IO.File]::Move($descriptorTemporary, $script:DraftHandoffDescriptorPath)
    Set-AuraDraftHandoffSecureAcl -Path $script:DraftHandoffDescriptorPath
  } finally {
    if ($null -ne $descriptorBytes) {
      [Array]::Clear($descriptorBytes, 0, $descriptorBytes.Length)
    }
    foreach ($temporary in @($keyTemporary, $descriptorTemporary)) {
      try {
        if (Test-Path -LiteralPath $temporary -PathType Leaf) {
          Remove-Item -LiteralPath $temporary -Force
        }
      } catch {}
    }
  }
}

function Initialize-AuraDraftHandoffNative {
  if ('AuraDraftHandoffNative' -as [type]) { return }
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class AuraDraftHandoffNative {
  [StructLayout(LayoutKind.Sequential)]
  private struct SecurityAttributes {
    public uint Length;
    public IntPtr SecurityDescriptor;
    [MarshalAs(UnmanagedType.Bool)]
    public bool InheritHandle;
  }

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern IntPtr CreateNamedPipe(
    string name,
    uint openMode,
    uint pipeMode,
    uint maxInstances,
    uint outBufferSize,
    uint inBufferSize,
    uint defaultTimeout,
    ref SecurityAttributes securityAttributes);

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool GetNamedPipeClientComputerName(
    SafePipeHandle pipe, StringBuilder name, uint size);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool GetNamedPipeClientProcessId(
    SafePipeHandle pipe, out uint processId);

  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern bool ImpersonateNamedPipeClient(SafePipeHandle pipe);

  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern bool RevertToSelf();

  public static SafePipeHandle CreateLocalOnlyPipe(
      string pipeName, byte[] securityDescriptor) {
    if (string.IsNullOrEmpty(pipeName)) throw new ArgumentException("pipeName");
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
        1,
        0,
        0,
        0,
        ref attributes);
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

function New-AuraDraftHandoffPipe {
  Initialize-AuraDraftHandoffNative
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if ($null -eq $sid) { throw 'current-user-unavailable' }
  $security = [IO.Pipes.PipeSecurity]::new()
  $security.SetAccessRuleProtection($true, $false)
  $security.SetOwner($sid)
  [void]$security.AddAccessRule([IO.Pipes.PipeAccessRule]::new(
      $sid,
      [IO.Pipes.PipeAccessRights]::FullControl,
      [Security.AccessControl.AccessControlType]::Allow))
  $descriptorBytes = $security.GetSecurityDescriptorBinaryForm()
  $transmission = [IO.Pipes.PipeTransmissionMode]::Byte
  $options = [IO.Pipes.PipeOptions]::Asynchronous
  try {
    $handle = [AuraDraftHandoffNative]::CreateLocalOnlyPipe(
      [string]$script:DraftHandoffDescriptor.pipeName, $descriptorBytes)
    try {
      $pipe = [IO.Pipes.NamedPipeServerStream]::new(
        [IO.Pipes.PipeDirection]::InOut,
        $true,
        $false,
        $handle)
    } catch {
      $handle.Dispose()
      throw
    }
  } finally {
    [Array]::Clear($descriptorBytes, 0, $descriptorBytes.Length)
  }
  try {
    $applied = $pipe.GetAccessControl()
    $owner = $applied.GetOwner([Security.Principal.SecurityIdentifier])
    $rules = @($applied.GetAccessRules(
        $true, $false, [Security.Principal.SecurityIdentifier]))
    if (-not $applied.AreAccessRulesProtected -or
        $null -eq $owner -or $owner.Value -cne $sid.Value -or
        $rules.Count -ne 1 -or
        $rules[0].IdentityReference.Value -cne $sid.Value -or
        $rules[0].AccessControlType -ne
          [Security.AccessControl.AccessControlType]::Allow -or
        ($rules[0].PipeAccessRights -band [IO.Pipes.PipeAccessRights]::FullControl) -ne
          [IO.Pipes.PipeAccessRights]::FullControl) {
      throw 'pipe-acl-invalid'
    }
    return $pipe
  } catch {
    $pipe.Dispose()
    throw
  }
}

function Test-AuraDraftHandoffLocalClient {
  if ($null -eq $script:DraftHandoffPipe -or
      -not $script:DraftHandoffPipe.IsConnected) { return $false }
  try {
    $computer = [Text.StringBuilder]::new(260)
    $computerAvailable = [AuraDraftHandoffNative]::GetNamedPipeClientComputerName(
      $script:DraftHandoffPipe.SafePipeHandle, $computer, 260)
    if (-not $computerAvailable) {
      # PIPE_REJECT_REMOTE_CLIENTS is authoritative. Some local clients do not
      # expose a computer name, so absence is diagnostic rather than rejection.
      Write-AuraDraftHandoffEvent -Code 'client-computer-unavailable'
    } else {
      $clientComputer = $computer.ToString()
      if ($clientComputer -cne '.' -and -not [string]::Equals(
          $clientComputer, [Environment]::MachineName,
          [StringComparison]::OrdinalIgnoreCase)) {
        Write-AuraDraftHandoffEvent -Code 'client-computer-mismatch'
        return $false
      }
    }
    [uint32]$clientProcessId = 0
    try {
      $processAvailable = [AuraDraftHandoffNative]::GetNamedPipeClientProcessId(
        $script:DraftHandoffPipe.SafePipeHandle, [ref]$clientProcessId)
    } catch {
      Write-AuraDraftHandoffEvent -Code 'client-process-check-failed'
      return $false
    }
    if (-not $processAvailable) {
      Write-AuraDraftHandoffEvent -Code 'client-process-unavailable'
      return $false
    }
    try {
      $clientProcess = [Diagnostics.Process]::GetProcessById([int]$clientProcessId)
      $currentProcess = [Diagnostics.Process]::GetCurrentProcess()
    } catch {
      Write-AuraDraftHandoffEvent -Code 'client-process-open-failed'
      return $false
    }
    try {
      if ($clientProcess.SessionId -ne $currentProcess.SessionId) {
        Write-AuraDraftHandoffEvent -Code 'client-session-mismatch'
        return $false
      }
    } finally {
      $clientProcess.Dispose()
      $currentProcess.Dispose()
    }
    try {
      $clientSid = [AuraDraftHandoffNative]::GetNamedPipeClientSid(
        $script:DraftHandoffPipe.SafePipeHandle)
      $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
      $identityMatches = [string]::Equals(
        $clientSid, $currentSid, [StringComparison]::OrdinalIgnoreCase)
      $identityCode = if ($identityMatches) {
        'client-verified'
      } else {
        'client-identity-mismatch'
      }
      Write-AuraDraftHandoffEvent -Code $identityCode
      return $identityMatches
    } catch {
      $nativeError = $_.Exception
      while ($null -ne $nativeError.InnerException) {
        $nativeError = $nativeError.InnerException
      }
      $nativeCode = if ($nativeError -is [ComponentModel.Win32Exception]) {
        [int]$nativeError.NativeErrorCode
      } else {
        0
      }
      Write-AuraDraftHandoffEvent -Code ("client-identity-check-failed-$nativeCode")
      return $false
    }
  } catch {
    Write-AuraDraftHandoffEvent -Code 'client-validation-unavailable'
    return $false
  }
}

function Clear-AuraDraftHandoffReadState {
  if ($null -ne $script:DraftHandoffReadState) {
    foreach ($buffer in @(
        $script:DraftHandoffReadState.Header,
        $script:DraftHandoffReadState.Payload
      )) {
      if ($null -ne $buffer) { [Array]::Clear($buffer, 0, $buffer.Length) }
    }
  }
  $script:DraftHandoffReadState = $null
}

function Clear-AuraDraftHandoffWriteState {
  if ($null -ne $script:DraftHandoffWriteState -and
      $null -ne $script:DraftHandoffWriteState.Frame) {
    [Array]::Clear(
      $script:DraftHandoffWriteState.Frame,
      0,
      $script:DraftHandoffWriteState.Frame.Length)
  }
  $script:DraftHandoffWriteState = $null
}

function Start-AuraDraftHandoffFrameRead {
  param([Parameter(Mandatory = $true)][int]$MaxBytes)
  Clear-AuraDraftHandoffReadState
  $state = [PSCustomObject]@{
    MaxBytes = $MaxBytes
    Header = [byte[]]::new(4)
    HeaderOffset = 0
    Payload = $null
    PayloadOffset = 0
    Task = $null
  }
  $state.Task = $script:DraftHandoffPipe.ReadAsync($state.Header, 0, 4)
  $script:DraftHandoffReadState = $state
  $script:DraftHandoffIoDeadlineUtc = [DateTime]::UtcNow.AddSeconds(5)
}

function Complete-AuraDraftHandoffFrameRead {
  $state = $script:DraftHandoffReadState
  if ($null -eq $state -or $null -eq $state.Task -or -not $state.Task.IsCompleted) {
    return $null
  }
  $count = [int]$state.Task.GetAwaiter().GetResult()
  if ($count -le 0) { throw 'pipe-disconnected' }
  if ($null -eq $state.Payload) {
    $state.HeaderOffset += $count
    if ($state.HeaderOffset -lt 4) {
      $state.Task = $script:DraftHandoffPipe.ReadAsync(
        $state.Header, $state.HeaderOffset, 4 - $state.HeaderOffset)
      return $null
    }
    [Array]::Reverse($state.Header)
    $length = [int][BitConverter]::ToUInt32($state.Header, 0)
    [Array]::Clear($state.Header, 0, $state.Header.Length)
    if ($length -lt 1 -or $length -gt [int]$state.MaxBytes) {
      throw 'frame-size-invalid'
    }
    $state.Payload = [byte[]]::new($length)
    $state.Task = $script:DraftHandoffPipe.ReadAsync($state.Payload, 0, $length)
    return $null
  }
  $state.PayloadOffset += $count
  if ($state.PayloadOffset -lt $state.Payload.Length) {
    $state.Task = $script:DraftHandoffPipe.ReadAsync(
      $state.Payload,
      $state.PayloadOffset,
      $state.Payload.Length - $state.PayloadOffset)
    return $null
  }
  $payload = $state.Payload
  $state.Payload = $null
  Clear-AuraDraftHandoffReadState
  return $payload
}

function Start-AuraDraftHandoffFrameWrite {
  param(
    [Parameter(Mandatory = $true)][byte[]]$Payload,
    [Parameter(Mandatory = $true)][string]$NextPhase
  )
  if ($Payload.Length -gt $script:DraftHandoffMaxBodyBytes) {
    throw 'frame-size-invalid'
  }
  Clear-AuraDraftHandoffWriteState
  $frame = [byte[]]::new(4 + $Payload.Length)
  $length = [BitConverter]::GetBytes([uint32]$Payload.Length)
  if ([BitConverter]::IsLittleEndian) { [Array]::Reverse($length) }
  [Array]::Copy($length, 0, $frame, 0, 4)
  [Array]::Copy($Payload, 0, $frame, 4, $Payload.Length)
  [Array]::Clear($length, 0, $length.Length)
  $script:DraftHandoffWriteState = [PSCustomObject]@{
    Frame = $frame
    NextPhase = $NextPhase
    Task = $script:DraftHandoffPipe.WriteAsync($frame, 0, $frame.Length)
  }
  $script:DraftHandoffIoDeadlineUtc = [DateTime]::UtcNow.AddSeconds(5)
}

function Complete-AuraDraftHandoffFrameWrite {
  $state = $script:DraftHandoffWriteState
  if ($null -eq $state -or $null -eq $state.Task -or -not $state.Task.IsCompleted) {
    return $null
  }
  $state.Task.GetAwaiter().GetResult()
  $next = [string]$state.NextPhase
  Clear-AuraDraftHandoffWriteState
  return $next
}

function Get-AuraDraftHandoffUnsigned {
  param(
    [Parameter(Mandatory = $true)][object]$Message,
    [Parameter(Mandatory = $true)][string[]]$Fields
  )
  $unsigned = [ordered]@{}
  foreach ($field in $Fields) {
    if ($field -cne 'mac') { $unsigned[$field] = $Message.$field }
  }
  return $unsigned
}

function Test-AuraDraftHandoffClientHello {
  param([Parameter(Mandatory = $true)][object]$Message)
  $fields = @(
    'protocolVersion', 'kind', 'mode', 'commandId', 'commandSequence', 'authorizationId',
    'localTargetId', 'adapterEpoch', 'navigationEpoch', 'clientNonce',
    'bodyBytes', 'expiresAt', 'mac')
  if (-not (Test-AuraDraftHandoffExactFields -Message $Message -Fields $fields) -or
      $Message.protocolVersion -ne 1 -or $Message.kind -cne 'client-hello' -or
      $Message.mode -cnotin @('prerequisite-only', 'transient-handoff') -or
      -not (Test-AuraDraftHandoffUuid $Message.commandId) -or
      -not (Test-AuraDraftHandoffInteger $Message.commandSequence) -or
      -not (Test-AuraDraftHandoffUuid $Message.authorizationId) -or
      -not (Test-AuraDraftHandoffUuid $Message.localTargetId) -or
      -not (Test-AuraDraftHandoffInteger $Message.adapterEpoch) -or
      -not (Test-AuraDraftHandoffInteger $Message.navigationEpoch) -or
      -not (Test-AuraDraftHandoffNonce $Message.clientNonce) -or
      -not (Test-AuraDraftHandoffInteger $Message.bodyBytes) -or
      -not (Test-AuraDraftHandoffInteger $Message.expiresAt)) {
    return $false
  }
  if ($Message.commandId -cne $script:DraftHandoffDescriptor.commandId -or
      [long]$Message.commandSequence -ne
        [long]$script:DraftHandoffDescriptor.commandSequence -or
      $Message.authorizationId -cne $script:DraftHandoffDescriptor.authorizationId -or
      $Message.localTargetId -cne $script:DraftHandoffDescriptor.localTargetId -or
      [long]$Message.adapterEpoch -ne [long]$script:DraftHandoffDescriptor.adapterEpoch -or
      [long]$Message.navigationEpoch -ne [long]$script:DraftHandoffDescriptor.navigationEpoch -or
      [long]$Message.expiresAt -ne [long]$script:DraftHandoffDescriptor.expiresAt -or
      [long]$Message.bodyBytes -gt [long]$script:DraftHandoffDescriptor.maxBodyBytes -or
      [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge [long]$Message.expiresAt) {
    return $false
  }
  if (($Message.mode -ceq 'prerequisite-only' -and [long]$Message.bodyBytes -ne 0) -or
      ($Message.mode -ceq 'transient-handoff' -and
        ([long]$Message.bodyBytes -lt 1 -or
          [long]$Message.bodyBytes -gt $script:DraftHandoffMaxBodyBytes))) {
    return $false
  }
  $unsigned = Get-AuraDraftHandoffUnsigned -Message $Message -Fields $fields
  return Test-AuraDraftHandoffMac `
    -Label 'client-hello' -Unsigned $unsigned -Mac $Message.mac
}

function New-AuraDraftHandoffServerReady {
  $hello = $script:DraftHandoffHello
  $descriptor = $script:DraftHandoffDescriptor
  $serverNonce = New-AuraDraftHandoffNonce
  $unsigned = [ordered]@{
    protocolVersion = 1
    kind = 'server-ready'
    mode = [string]$hello.mode
    commandId = [string]$hello.commandId
    commandSequence = [long]$hello.commandSequence
    authorizationId = [string]$hello.authorizationId
    localTargetId = [string]$hello.localTargetId
    adapterEpoch = [long]$hello.adapterEpoch
    navigationEpoch = [long]$hello.navigationEpoch
    bodyBytes = [long]$hello.bodyBytes
    expiresAt = [long]$hello.expiresAt
    serverInstanceId = [string]$descriptor.serverInstanceId
    serverEpoch = [long]$descriptor.serverEpoch
    clientNonce = [string]$hello.clientNonce
    serverNonce = $serverNonce
    maxBodyBytes = [long]$descriptor.maxBodyBytes
  }
  $message = [ordered]@{}
  foreach ($entry in $unsigned.GetEnumerator()) { $message[$entry.Key] = $entry.Value }
  $message.mac = Get-AuraDraftHandoffMac -Label 'server-ready' -Unsigned $unsigned
  $script:DraftHandoffServerReady = [PSCustomObject]$message
}

function Test-AuraDraftHandoffBodyProof {
  param(
    [Parameter(Mandatory = $true)][object]$Message,
    [Parameter(Mandatory = $true)][byte[]]$Body
  )
  $fields = @(
    'protocolVersion', 'kind', 'commandId', 'commandSequence', 'authorizationId', 'localTargetId',
    'adapterEpoch', 'navigationEpoch', 'serverEpoch', 'clientNonce',
    'serverNonce', 'bodyBytes', 'mac')
  $hello = $script:DraftHandoffHello
  $ready = $script:DraftHandoffServerReady
  if (-not (Test-AuraDraftHandoffBodyBytes -Body $Body) -or
      -not (Test-AuraDraftHandoffExactFields -Message $Message -Fields $fields) -or
      $Message.protocolVersion -ne 1 -or $Message.kind -cne 'body-proof' -or
      $hello.mode -cne 'transient-handoff' -or
      $ready.mode -cne 'transient-handoff' -or
      $Message.commandId -cne $hello.commandId -or
      [long]$Message.commandSequence -ne [long]$hello.commandSequence -or
      $Message.authorizationId -cne $hello.authorizationId -or
      $Message.localTargetId -cne $hello.localTargetId -or
      [long]$Message.adapterEpoch -ne [long]$hello.adapterEpoch -or
      [long]$Message.navigationEpoch -ne [long]$hello.navigationEpoch -or
      [long]$Message.serverEpoch -ne [long]$ready.serverEpoch -or
      $Message.clientNonce -cne $hello.clientNonce -or
      $Message.serverNonce -cne $ready.serverNonce -or
      [long]$Message.bodyBytes -ne $Body.Length -or
      $Body.Length -ne [long]$hello.bodyBytes -or
      $Body.Length -ne [long]$ready.bodyBytes -or
      $Body.Length -gt [long]$script:DraftHandoffDescriptor.maxBodyBytes -or
      $Body.Length -gt [long]$ready.maxBodyBytes -or
      $hello.commandId -cne $script:DraftHandoffDescriptor.commandId -or
      [long]$hello.commandSequence -ne
        [long]$script:DraftHandoffDescriptor.commandSequence -or
      $hello.authorizationId -cne $script:DraftHandoffDescriptor.authorizationId -or
      $hello.localTargetId -cne $script:DraftHandoffDescriptor.localTargetId -or
      [long]$hello.adapterEpoch -ne
        [long]$script:DraftHandoffDescriptor.adapterEpoch -or
      [long]$hello.navigationEpoch -ne
        [long]$script:DraftHandoffDescriptor.navigationEpoch -or
      [long]$hello.expiresAt -ne [long]$script:DraftHandoffDescriptor.expiresAt -or
      [long]$ready.expiresAt -ne [long]$script:DraftHandoffDescriptor.expiresAt -or
      [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge
        [long]$script:DraftHandoffDescriptor.expiresAt) {
    return $false
  }
  $unsigned = Get-AuraDraftHandoffUnsigned -Message $Message -Fields $fields
  return Test-AuraDraftHandoffMac `
    -Label 'body-proof' -Unsigned $unsigned -Mac $Message.mac -Body $Body
}

function New-AuraDraftHandoffReceipt {
  param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('review-ready', 'user-inserted')][string]$Phase
  )
  $review = $Phase -ceq 'review-ready'
  $hello = $script:DraftHandoffHello
  $ready = $script:DraftHandoffServerReady
  $unsigned = [ordered]@{
    protocolVersion = 1
    kind = 'draft-handoff-receipt'
    phase = $Phase
    outcome = if ($review) { 'review_ready_unsent' } else { 'inserted_unsent' }
    commandId = [string]$hello.commandId
    commandSequence = [long]$hello.commandSequence
    authorizationId = [string]$hello.authorizationId
    localTargetId = [string]$hello.localTargetId
    adapterEpoch = [long]$hello.adapterEpoch
    navigationEpoch = [long]$hello.navigationEpoch
    serverEpoch = [long]$ready.serverEpoch
    clientNonce = [string]$hello.clientNonce
    serverNonce = [string]$ready.serverNonce
    sequence = if ($review) { 1 } else { 2 }
    certainty = 'certain'
    observedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
  $message = [ordered]@{}
  foreach ($entry in $unsigned.GetEnumerator()) { $message[$entry.Key] = $entry.Value }
  $message.mac = Get-AuraDraftHandoffMac `
    -Label ("draft-handoff-receipt:$Phase") -Unsigned $unsigned
  return [PSCustomObject]$message
}

function Clear-AuraDraftHandoffTransientText {
  if ($null -ne $script:PromptShelfDraftBox -and
      -not $script:PromptShelfDraftBox.IsDisposed) {
    try {
      $script:PromptShelfDraftBox.Clear()
      $script:PromptShelfDraftBox.ClearUndo()
      $script:PromptShelfDraftBox.Modified = $false
    } catch {}
  }
}

function Test-AuraDraftHandoffTransientActive {
  return $null -ne $script:DraftHandoffTransient
}

function Dispose-AuraDraftHandoffTransient {
  param([AllowEmptyString()][string]$Reason = 'cleared')
  if ($null -eq $script:DraftHandoffTransient) { return }
  Clear-AuraDraftHandoffTransientText
  $script:DraftHandoffTransient = $null
  $script:DraftHandoffPendingInsertReceipt = $false
  try { Update-AuraPromptShelfActions } catch {}
}

function Close-AuraDraftHandoffConnection {
  Clear-AuraDraftHandoffReadState
  Clear-AuraDraftHandoffWriteState
  if ($null -ne $script:DraftHandoffDisconnectBuffer) {
    [Array]::Clear(
      $script:DraftHandoffDisconnectBuffer, 0,
      $script:DraftHandoffDisconnectBuffer.Length)
  }
  $script:DraftHandoffDisconnectBuffer = $null
  $script:DraftHandoffDisconnectTask = $null
  if ($null -ne $script:DraftHandoffPipe) {
    try { $script:DraftHandoffPipe.Dispose() } catch {}
  }
  $script:DraftHandoffPipe = $null
  $script:DraftHandoffAcceptTask = $null
  $script:DraftHandoffHello = $null
  $script:DraftHandoffServerReady = $null
  $script:DraftHandoffBodyProof = $null
  $script:DraftHandoffIoDeadlineUtc = [DateTime]::MinValue
}

function Start-AuraDraftHandoffAccept {
  Close-AuraDraftHandoffConnection
  $script:DraftHandoffPipe = New-AuraDraftHandoffPipe
  $script:DraftHandoffAcceptTask = $script:DraftHandoffPipe.WaitForConnectionAsync()
  $script:DraftHandoffPhase = 'accepting'
}

function Stop-AuraDraftHandoffAfterFailure {
  param([switch]$MayRetry)
  Dispose-AuraDraftHandoffTransient -Reason 'transport-failed'
  if ($MayRetry -and $script:DraftHandoffEnabled -and
      -not $script:DraftHandoffAttemptConsumed -and
      [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -lt
        [long]$script:DraftHandoffDescriptor.expiresAt -and
      $script:DraftHandoffRejectedConnections -lt 8) {
    Start-AuraDraftHandoffAccept
    return
  }
  Dispose-AuraDraftHandoff
}

function Publish-AuraDraftHandoffTransient {
  param([Parameter(Mandatory = $true)][byte[]]$Body)
  $currentTarget = if ($null -ne $script:WebView) {
    Get-AuraPromptShelfRouteKey -Value $script:WebView.Source
  } else { '' }
  if (-not (Get-AuraUiEnabled) -or -not $script:WebReady -or
      -not $script:PageReady -or -not $currentTarget -or
      $currentTarget -cne $script:DraftHandoffPrivateTarget -or
      [long]$script:PromptShelfPageEpoch -ne
        [long]$script:DraftHandoffDescriptor.navigationEpoch) {
    throw 'target-stale'
  }
  if ($null -ne $script:PromptShelfDraftBox -and
      -not [string]::IsNullOrWhiteSpace($script:PromptShelfDraftBox.Text)) {
    throw 'unsaved-draft-present'
  }
  $text = $null
  try {
    $text = $script:DraftHandoffUtf8.GetString($Body)
    if (-not (Test-AuraPromptShelfText -Text $text)) { throw 'body-invalid' }
    Show-AuraPromptShelf
    if (-not [string]::IsNullOrWhiteSpace($script:PromptShelfDraftBox.Text)) {
      throw 'unsaved-draft-present'
    }
    $attemptId = ([string]$script:DraftHandoffHello.commandId).Replace('-', '')
    $script:DraftHandoffTransient = [PSCustomObject][ordered]@{
      AttemptId = $attemptId
      PageEpoch = [long]$script:PromptShelfPageEpoch
      Target = $currentTarget
      DeadlineUtc = [DateTime]::UtcNow.AddMilliseconds(
        $script:DraftHandoffReviewMilliseconds)
    }
    $script:PromptShelfEditingId = $null
    $script:PromptShelfDraftBox.Text = $text
    $script:PromptShelfDraftBox.Select($script:PromptShelfDraftBox.TextLength, 0)
    $script:PromptShelfDraftBox.Modified = $false
    Update-AuraPromptShelfActions
    [void]$script:PromptShelfDraftBox.Focus()
  } finally {
    $text = $null
  }
}

function Invoke-AuraDraftHandoffInsertTransient {
  if ($null -eq $script:DraftHandoffTransient -or
      $null -eq $script:PromptShelfDraftBox) { return }
  $transient = $script:DraftHandoffTransient
  $currentTarget = if ($null -ne $script:WebView) {
    Get-AuraPromptShelfRouteKey -Value $script:WebView.Source
  } else { '' }
  if ([DateTime]::UtcNow -ge [DateTime]$transient.DeadlineUtc -or
      [long]$script:PromptShelfPageEpoch -ne [long]$transient.PageEpoch -or
      $currentTarget -cne [string]$transient.Target) {
    Invalidate-AuraDraftHandoffTarget -Reason 'target-stale'
    return
  }
  Invoke-AuraPromptShelfInsert `
    -Text ([string]$script:PromptShelfDraftBox.Text) `
    -DraftHandoffAttemptId ([string]$transient.AttemptId) `
    -DraftHandoffPageEpoch ([long]$transient.PageEpoch) `
    -DraftHandoffTarget ([string]$transient.Target)
}

function Complete-AuraDraftHandoffInsert {
  param(
    [Parameter(Mandatory = $true)][string]$AttemptId,
    [Parameter(Mandatory = $true)]
    [ValidateSet('inserted', 'not-inserted', 'uncertain')][string]$Outcome
  )
  if ($null -eq $script:DraftHandoffTransient -or
      [string]$script:DraftHandoffTransient.AttemptId -cne $AttemptId) { return }
  if ($Outcome -ceq 'inserted') {
    Clear-AuraDraftHandoffTransientText
    $script:DraftHandoffTransient = $null
    $script:DraftHandoffPendingInsertReceipt = $true
    try { Update-AuraPromptShelfActions } catch {}
    return
  }
  Dispose-AuraDraftHandoffTransient -Reason $Outcome
  Close-AuraDraftHandoffConnection
  Dispose-AuraDraftHandoff
}

function Cancel-AuraDraftHandoffTransient {
  param([AllowEmptyString()][string]$Reason = 'user-cancelled')
  if ($null -eq $script:DraftHandoffTransient) { return }
  Dispose-AuraDraftHandoffTransient -Reason $Reason
  Close-AuraDraftHandoffConnection
  Dispose-AuraDraftHandoff
}

function Invalidate-AuraDraftHandoffTarget {
  param([AllowEmptyString()][string]$Reason = 'target-stale')
  if ($null -eq $script:DraftHandoffTransient) { return }
  Cancel-AuraDraftHandoffTransient -Reason $Reason
}

function Initialize-AuraDraftHandoff {
  param([Parameter(Mandatory = $true)][bool]$Enabled)
  if (-not $Enabled) {
    Remove-AuraDraftHandoffDiscovery
    return
  }
  Dispose-AuraDraftHandoff
  $target = if ($null -ne $script:WebView) {
    Get-AuraPromptShelfRouteKey -Value $script:WebView.Source
  } else { '' }
  if (-not (Get-AuraUiEnabled) -or -not $script:WebReady -or
      -not $script:PageReady -or -not $target) {
    $script:DraftHandoffEnabled = $true
    $script:DraftHandoffPhase = 'waiting-target'
    return
  }
  $script:DraftHandoffEnabled = $true
  $script:DraftHandoffKey = New-AuraDraftHandoffRandomBytes -Count $script:DraftHandoffKeyBytes
  $pipeSuffix = [Guid]::NewGuid().ToString('N')
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  if ($now -le $script:DraftHandoffLastCommandSequence) {
    $now = $script:DraftHandoffLastCommandSequence + 1
  }
  $script:DraftHandoffLastCommandSequence = [long]$now
  $script:DraftHandoffPrivateTarget = $target
  $script:DraftHandoffDescriptor = [PSCustomObject][ordered]@{
    protocolVersion = 1
    pipeName = "ClaudeAura.DraftHandoff.v1.$pipeSuffix"
    serverInstanceId = [Guid]::NewGuid().ToString()
    serverEpoch = [long]$now
    authorizationId = [Guid]::NewGuid().ToString()
    commandId = [Guid]::NewGuid().ToString()
    commandSequence = [long]$now
    localTargetId = [Guid]::NewGuid().ToString()
    adapterEpoch = [long]$now
    navigationEpoch = [long]$script:PromptShelfPageEpoch
    expiresAt = [long]($now + $script:DraftHandoffGrantMilliseconds)
    maxBodyBytes = [long]$script:DraftHandoffMaxBodyBytes
    transientTestSupported = $true
  }
  Write-AuraDraftHandoffDiscovery
  Start-AuraDraftHandoffAccept
  Write-AuraDraftHandoffEvent -Code 'enabled'
}

function Update-AuraDraftHandoff {
  if (-not $script:DraftHandoffEnabled) { return }
  try {
    if ($script:DraftHandoffPhase -ceq 'waiting-target') {
      $target = if ($null -ne $script:WebView) {
        Get-AuraPromptShelfRouteKey -Value $script:WebView.Source
      } else { '' }
      if ((Get-AuraUiEnabled) -and $script:WebReady -and
          $script:PageReady -and $target) {
        Initialize-AuraDraftHandoff -Enabled $true
      }
      return
    }
    if ($null -ne $script:DraftHandoffDescriptor -and
        -not $script:DraftHandoffAttemptConsumed -and
        [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() -ge
          [long]$script:DraftHandoffDescriptor.expiresAt) {
      Dispose-AuraDraftHandoff
      return
    }
    if ($script:DraftHandoffPhase -cin @(
        'reading-hello', 'writing-ready', 'reading-body-proof', 'reading-body',
        'writing-review', 'writing-inserted') -and
        $script:DraftHandoffIoDeadlineUtc -ne [DateTime]::MinValue -and
        [DateTime]::UtcNow -ge $script:DraftHandoffIoDeadlineUtc) {
      throw 'io-timeout'
    }
    switch ($script:DraftHandoffPhase) {
      'accepting' {
        if (-not $script:DraftHandoffAcceptTask.IsCompleted) { return }
        $script:DraftHandoffAcceptTask.GetAwaiter().GetResult()
        Start-AuraDraftHandoffFrameRead -MaxBytes $script:DraftHandoffMaxControlBytes
        $script:DraftHandoffPhase = 'reading-hello'
        return
      }
      'reading-hello' {
        $payload = Complete-AuraDraftHandoffFrameRead
        if ($null -eq $payload) { return }
        try {
          # Windows cannot impersonate a named-pipe client until at least one
          # byte has been read. The hello is body-free; authenticate the exact
          # Windows SID and session before parsing it or returning server proof.
          if (-not (Test-AuraDraftHandoffLocalClient)) {
            throw 'client-identity-rejected'
          }
          $hello = ConvertFrom-AuraDraftHandoffControlBytes -Bytes $payload
          if (-not (Test-AuraDraftHandoffClientHello -Message $hello)) {
            throw 'hello-rejected'
          }
          $script:DraftHandoffHello = $hello
          New-AuraDraftHandoffServerReady
          if ($hello.mode -ceq 'transient-handoff') {
            $script:DraftHandoffAttemptConsumed = $true
            try {
              if (Test-Path -LiteralPath $script:DraftHandoffDescriptorPath -PathType Leaf) {
                Remove-Item -LiteralPath $script:DraftHandoffDescriptorPath -Force
              }
            } catch {}
          }
          $bytes = ConvertTo-AuraDraftHandoffJsonBytes -Value $script:DraftHandoffServerReady
          try {
            $nextPhase = if ($hello.mode -ceq 'prerequisite-only') {
              'prerequisite-complete'
            } else {
              'read-body-proof'
            }
            Start-AuraDraftHandoffFrameWrite -Payload $bytes -NextPhase $nextPhase
          } finally {
            [Array]::Clear($bytes, 0, $bytes.Length)
          }
          $script:DraftHandoffPhase = 'writing-ready'
        } finally {
          [Array]::Clear($payload, 0, $payload.Length)
        }
        return
      }
      'writing-ready' {
        $next = Complete-AuraDraftHandoffFrameWrite
        if ($null -eq $next) { return }
        if ($next -ceq 'prerequisite-complete') {
          Start-AuraDraftHandoffAccept
          return
        }
        Start-AuraDraftHandoffFrameRead -MaxBytes $script:DraftHandoffMaxControlBytes
        $script:DraftHandoffPhase = 'reading-body-proof'
        return
      }
      'reading-body-proof' {
        $payload = Complete-AuraDraftHandoffFrameRead
        if ($null -eq $payload) { return }
        try {
          $proof = ConvertFrom-AuraDraftHandoffControlBytes -Bytes $payload
          $script:DraftHandoffBodyProof = $proof
          Start-AuraDraftHandoffFrameRead -MaxBytes ([int]$script:DraftHandoffHello.bodyBytes)
          $script:DraftHandoffPhase = 'reading-body'
        } finally {
          [Array]::Clear($payload, 0, $payload.Length)
        }
        return
      }
      'reading-body' {
        $body = Complete-AuraDraftHandoffFrameRead
        if ($null -eq $body) { return }
        try {
          if (-not (Test-AuraDraftHandoffBodyProof `
              -Message $script:DraftHandoffBodyProof -Body $body)) {
            throw 'body-proof-rejected'
          }
          Publish-AuraDraftHandoffTransient -Body $body
          $receipt = New-AuraDraftHandoffReceipt -Phase 'review-ready'
          $bytes = ConvertTo-AuraDraftHandoffJsonBytes -Value $receipt
          try {
            Start-AuraDraftHandoffFrameWrite -Payload $bytes -NextPhase 'wait-insert'
          } finally {
            [Array]::Clear($bytes, 0, $bytes.Length)
          }
          $script:DraftHandoffPhase = 'writing-review'
        } finally {
          [Array]::Clear($body, 0, $body.Length)
        }
        return
      }
      'writing-review' {
        $next = Complete-AuraDraftHandoffFrameWrite
        if ($null -eq $next) { return }
        $script:DraftHandoffDisconnectBuffer = [byte[]]::new(1)
        $script:DraftHandoffDisconnectTask = $script:DraftHandoffPipe.ReadAsync(
          $script:DraftHandoffDisconnectBuffer, 0, 1)
        $script:DraftHandoffPhase = 'waiting-insert'
        return
      }
      'waiting-insert' {
        if ($script:DraftHandoffPendingInsertReceipt) {
          $script:DraftHandoffPendingInsertReceipt = $false
          $receipt = New-AuraDraftHandoffReceipt -Phase 'user-inserted'
          $bytes = ConvertTo-AuraDraftHandoffJsonBytes -Value $receipt
          try {
            Start-AuraDraftHandoffFrameWrite -Payload $bytes -NextPhase 'complete'
          } finally {
            [Array]::Clear($bytes, 0, $bytes.Length)
          }
          $script:DraftHandoffPhase = 'writing-inserted'
          return
        }
        if ($null -ne $script:DraftHandoffDisconnectTask -and
            $script:DraftHandoffDisconnectTask.IsCompleted) {
          [void]$script:DraftHandoffDisconnectTask.GetAwaiter().GetResult()
          throw 'client-disconnected'
        }
        if ($null -ne $script:DraftHandoffTransient -and
            [DateTime]::UtcNow -ge [DateTime]$script:DraftHandoffTransient.DeadlineUtc) {
          throw 'review-expired'
        }
        return
      }
      'writing-inserted' {
        $next = Complete-AuraDraftHandoffFrameWrite
        if ($null -eq $next) { return }
        Dispose-AuraDraftHandoff
        return
      }
    }
  } catch {
    $script:DraftHandoffRejectedConnections += 1
    Write-AuraDraftHandoffEvent -Code 'rejected'
    Stop-AuraDraftHandoffAfterFailure -MayRetry
  }
}

function Dispose-AuraDraftHandoff {
  Dispose-AuraDraftHandoffTransient -Reason 'disabled'
  Close-AuraDraftHandoffConnection
  Remove-AuraDraftHandoffDiscovery
  if ($null -ne $script:DraftHandoffKey) {
    [Array]::Clear($script:DraftHandoffKey, 0, $script:DraftHandoffKey.Length)
  }
  $script:DraftHandoffKey = $null
  $script:DraftHandoffDescriptor = $null
  $script:DraftHandoffPrivateTarget = ''
  $script:DraftHandoffAttemptConsumed = $false
  $script:DraftHandoffRejectedConnections = 0
  $script:DraftHandoffPendingInsertReceipt = $false
  $script:DraftHandoffEnabled = $false
  $script:DraftHandoffPhase = 'disabled'
}

# Stale crash residue is never trusted or advertised on normal startup.
Remove-AuraDraftHandoffDiscovery
