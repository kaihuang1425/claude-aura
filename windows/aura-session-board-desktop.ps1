$script:AuraSessionBoardDesktopContractId = 'claude-aura-session-board-desktop-v1'
$script:AuraSessionBoardDesktopRequestMaximumBytes = 4096
$script:AuraSessionBoardDesktopResponseMaximumBytes = 262144
$script:AuraSessionBoardDesktopReceiptCacheLimit = 256
$script:AuraSessionBoardDesktopUtf8 = [Text.UTF8Encoding]::new($false, $true)
$script:AuraSessionBoardDesktopInitialized = $false
$script:AuraSessionBoardDesktopDataRoot = ''
$script:AuraSessionBoardDesktopDiscoveryPath = ''
$script:AuraSessionBoardDesktopPipeName = ''
$script:AuraSessionBoardDesktopToken = ''
$script:AuraSessionBoardDesktopInstanceId = ''
$script:AuraSessionBoardDesktopPipe = $null
$script:AuraSessionBoardDesktopAcceptTask = $null
$script:AuraSessionBoardDesktopReadTask = $null
$script:AuraSessionBoardDesktopReadBuffer = $null
$script:AuraSessionBoardDesktopInbound = [byte[]]::new(0)
$script:AuraSessionBoardDesktopWriteTask = $null
$script:AuraSessionBoardDesktopWriteBuffer = $null
$script:AuraSessionBoardDesktopWriteQueue = [Collections.Generic.Queue[byte[]]]::new()
$script:AuraSessionBoardDesktopAuthenticated = $false
$script:AuraSessionBoardDesktopConnectDeadlineUtc = [DateTime]::MinValue
$script:AuraSessionBoardDesktopRequestDeadlineUtc = [DateTime]::MinValue
$script:AuraSessionBoardDesktopReceiptCache = [Collections.Generic.Dictionary[string, object]]::new(
  [StringComparer]::Ordinal)
$script:AuraSessionBoardDesktopReceiptOrder = [Collections.Generic.Queue[string]]::new()

if (-not ('AuraSessionBoardDesktopJson' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

public static class AuraSessionBoardDesktopJson {
  public static bool HasUniquePropertyNames(string text) {
    try {
      if (text == null) return false;
      Parser parser = new Parser(text);
      parser.ParseValue();
      parser.SkipWhitespace();
      return parser.AtEnd;
    } catch { return false; }
  }

  private sealed class Parser {
    private readonly string text;
    private int index;
    internal Parser(string value) { text = value; }
    internal bool AtEnd { get { return index == text.Length; } }

    internal void SkipWhitespace() {
      while (index < text.Length) {
        char value = text[index];
        if (value != ' ' && value != '\t' && value != '\r' && value != '\n') break;
        index++;
      }
    }

    internal void ParseValue() {
      SkipWhitespace();
      if (index >= text.Length) throw new FormatException();
      char value = text[index];
      if (value == '{') { ParseObject(); return; }
      if (value == '[') { ParseArray(); return; }
      if (value == '"') { ParseString(); return; }
      if (value == 't') { ExpectLiteral("true"); return; }
      if (value == 'f') { ExpectLiteral("false"); return; }
      if (value == 'n') { ExpectLiteral("null"); return; }
      ParseNumber();
    }

    private void ParseObject() {
      index++;
      HashSet<string> names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      SkipWhitespace();
      if (Consume('}')) return;
      while (true) {
        SkipWhitespace();
        if (index >= text.Length || text[index] != '"') throw new FormatException();
        string name = ParseString();
        if (!names.Add(name)) throw new FormatException();
        SkipWhitespace();
        Require(':');
        ParseValue();
        SkipWhitespace();
        if (Consume('}')) return;
        Require(',');
      }
    }

    private void ParseArray() {
      index++;
      SkipWhitespace();
      if (Consume(']')) return;
      while (true) {
        ParseValue();
        SkipWhitespace();
        if (Consume(']')) return;
        Require(',');
      }
    }

    private string ParseString() {
      Require('"');
      StringBuilder value = new StringBuilder();
      while (index < text.Length) {
        char next = text[index++];
        if (next == '"') return value.ToString();
        if (next < 0x20) throw new FormatException();
        if (next != '\\') { value.Append(next); continue; }
        if (index >= text.Length) throw new FormatException();
        char escape = text[index++];
        switch (escape) {
          case '"': value.Append('"'); break;
          case '\\': value.Append('\\'); break;
          case '/': value.Append('/'); break;
          case 'b': value.Append('\b'); break;
          case 'f': value.Append('\f'); break;
          case 'n': value.Append('\n'); break;
          case 'r': value.Append('\r'); break;
          case 't': value.Append('\t'); break;
          case 'u':
            if (index + 4 > text.Length) throw new FormatException();
            int code;
            if (!Int32.TryParse(text.Substring(index, 4), NumberStyles.AllowHexSpecifier,
                CultureInfo.InvariantCulture, out code)) throw new FormatException();
            value.Append((char)code);
            index += 4;
            break;
          default: throw new FormatException();
        }
      }
      throw new FormatException();
    }

    private void ParseNumber() {
      int start = index;
      if (Consume('-') && index >= text.Length) throw new FormatException();
      if (Consume('0')) {
        if (index < text.Length && Char.IsDigit(text[index])) throw new FormatException();
      } else {
        if (index >= text.Length || text[index] < '1' || text[index] > '9') throw new FormatException();
        while (index < text.Length && Char.IsDigit(text[index])) index++;
      }
      if (Consume('.')) {
        int digits = index;
        while (index < text.Length && Char.IsDigit(text[index])) index++;
        if (digits == index) throw new FormatException();
      }
      if (index < text.Length && (text[index] == 'e' || text[index] == 'E')) {
        index++;
        if (index < text.Length && (text[index] == '+' || text[index] == '-')) index++;
        int digits = index;
        while (index < text.Length && Char.IsDigit(text[index])) index++;
        if (digits == index) throw new FormatException();
      }
      if (start == index) throw new FormatException();
    }

    private void ExpectLiteral(string value) {
      if (index + value.Length > text.Length ||
          String.CompareOrdinal(text, index, value, 0, value.Length) != 0) {
        throw new FormatException();
      }
      index += value.Length;
    }

    private bool Consume(char value) {
      if (index < text.Length && text[index] == value) { index++; return true; }
      return false;
    }

    private void Require(char value) {
      if (!Consume(value)) throw new FormatException();
    }
  }
}
'@
}

function Test-AuraSessionBoardDesktopUniqueJsonProperties {
  param([Parameter(Mandatory = $true)][string]$Json)
  return [AuraSessionBoardDesktopJson]::HasUniquePropertyNames($Json)
}

function Test-AuraSessionBoardDesktopExactFields {
  param(
    [Parameter(Mandatory = $true)][object]$Value,
    [Parameter(Mandatory = $true)][string[]]$Fields
  )
  if ($Value -isnot [Management.Automation.PSCustomObject]) { return $false }
  $names = @($Value.PSObject.Properties | ForEach-Object { $_.Name })
  return $names.Count -eq $Fields.Count -and
    @($names | Where-Object { $Fields -cnotcontains $_ }).Count -eq 0
}

function Test-AuraSessionBoardDesktopUuid {
  param([AllowNull()][object]$Value)
  return $Value -is [string] -and [regex]::IsMatch(
    [string]$Value,
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    [Text.RegularExpressions.RegexOptions]::CultureInvariant -bor
      [Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Test-AuraSessionBoardDesktopInteger {
  param([AllowNull()][object]$Value)
  if ($Value -isnot [byte] -and $Value -isnot [int16] -and
      $Value -isnot [int32] -and $Value -isnot [int64]) { return $false }
  $number = [long]$Value
  return $number -ge 0 -and $number -le 9007199254740991
}

function Test-AuraSessionBoardDesktopTitle {
  param([AllowNull()][object]$Value)
  if ($Value -isnot [string] -or [string]::IsNullOrWhiteSpace([string]$Value) -or
      $Value.Length -gt 320 -or [regex]::IsMatch([string]$Value, '[\x00-\x1F\x7F-\x9F]')) {
    return $false
  }
  $scalars = 0
  for ($index = 0; $index -lt $Value.Length; $index += 1) {
    $code = [int][char]$Value[$index]
    if ($code -ge 0xD800 -and $code -le 0xDBFF) {
      if ($index + 1 -ge $Value.Length) { return $false }
      $next = [int][char]$Value[$index + 1]
      if ($next -lt 0xDC00 -or $next -gt 0xDFFF) { return $false }
      $index += 1
    } elseif ($code -ge 0xDC00 -and $code -le 0xDFFF) {
      return $false
    }
    $scalars += 1
    if ($scalars -gt 160) { return $false }
  }
  return $true
}

function Get-AuraSessionBoardDesktopRequest {
  param([Parameter(Mandatory = $true)][string]$Json)
  $bytes = $script:AuraSessionBoardDesktopUtf8.GetBytes($Json)
  try {
    if ($bytes.Length -lt 2 -or
        $bytes.Length -gt $script:AuraSessionBoardDesktopRequestMaximumBytes) {
      throw 'Desktop Work Hub request size is invalid.'
    }
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
  if (-not (Test-AuraSessionBoardDesktopUniqueJsonProperties -Json $Json)) {
    throw 'Desktop Work Hub request JSON is invalid.'
  }
  try { $message = $Json | ConvertFrom-Json -ErrorAction Stop } catch {
    throw 'Desktop Work Hub request JSON is invalid.'
  }
  if ($message -isnot [Management.Automation.PSCustomObject] -or
      $message.type -isnot [string]) {
    throw 'Desktop Work Hub request is invalid.'
  }
  $type = [string]$message.type
  $fields = if ($type -ceq 'session-board-read') {
    @('type', 'version', 'requestId')
  } elseif ($type -ceq 'session-board-open') {
    @('type', 'version', 'requestId', 'sessionId')
  } else {
    throw 'Desktop Work Hub request type is invalid.'
  }
  if (-not (Test-AuraSessionBoardDesktopExactFields -Value $message -Fields $fields) -or
      ($message.version -isnot [int] -and $message.version -isnot [long]) -or
      [long]$message.version -ne 1 -or
      -not (Test-AuraSessionBoardDesktopUuid -Value $message.requestId) -or
      ($type -ceq 'session-board-open' -and
        -not (Test-AuraSessionBoardDesktopUuid -Value $message.sessionId))) {
    throw 'Desktop Work Hub request shape is invalid.'
  }
  if ($type -ceq 'session-board-read') {
    return [PSCustomObject][ordered]@{
      type = $type
      version = 1
      requestId = [string]$message.requestId
    }
  }
  return [PSCustomObject][ordered]@{
    type = $type
    version = 1
    requestId = [string]$message.requestId
    sessionId = [string]$message.sessionId
  }
}

function Test-AuraSessionBoardDesktopState {
  param([Parameter(Mandatory = $true)][object]$Value)
  if (-not (Test-AuraSessionBoardDesktopExactFields -Value $Value -Fields @(
        'schemaVersion', 'kind', 'revision', 'changedAt', 'sessions')) -or
      $Value.schemaVersion -ne 1 -or [string]$Value.kind -cne 'session-board-state' -or
      -not (Test-AuraSessionBoardDesktopInteger -Value $Value.revision) -or
      -not (Test-AuraSessionBoardDesktopInteger -Value $Value.changedAt) -or
      $Value.sessions -is [string] -or @($Value.sessions).Count -gt 100) {
    return $false
  }
  $ids = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
  foreach ($session in @($Value.sessions)) {
    if (-not (Test-AuraSessionBoardDesktopExactFields -Value $session -Fields @(
          'id', 'title', 'kind', 'state', 'firstSeenAt', 'lastOpenedAt', 'response')) -or
        -not (Test-AuraSessionBoardDesktopUuid -Value $session.id) -or
        -not $ids.Add([string]$session.id) -or
        -not (Test-AuraSessionBoardDesktopTitle -Value $session.title) -or
        [string]$session.kind -cnotin @('chat', 'code') -or
        [string]$session.state -cnotin @('active', 'open', 'past') -or
        -not (Test-AuraSessionBoardDesktopInteger -Value $session.firstSeenAt) -or
        -not (Test-AuraSessionBoardDesktopInteger -Value $session.lastOpenedAt) -or
        [long]$session.lastOpenedAt -lt [long]$session.firstSeenAt -or
        -not (Test-AuraSessionBoardDesktopExactFields -Value $session.response -Fields @(
          'state', 'evidence', 'changedAt'))) {
      return $false
    }
    $state = [string]$session.response.state
    if ($state -cnotin @('unknown', 'working', 'completed', 'failed') -or
        ($state -ceq 'unknown' -and
          ([string]$session.response.evidence -cne 'none' -or
            $null -ne $session.response.changedAt)) -or
        ($state -cne 'unknown' -and
          ([string]$session.response.evidence -cne 'network' -or
            -not (Test-AuraSessionBoardDesktopInteger -Value $session.response.changedAt)))) {
      return $false
    }
  }
  return $true
}

function Test-AuraSessionBoardDesktopResponse {
  param(
    [Parameter(Mandatory = $true)][object]$Value,
    [Parameter(Mandatory = $true)][object]$Request
  )
  if ($Value -isnot [Management.Automation.PSCustomObject] -or
      $Value.type -isnot [string] -or $Value.version -ne 1 -or
      [string]$Value.requestId -cne [string]$Request.requestId) {
    return $false
  }
  if ([string]$Value.type -ceq 'session-board-error') {
    $action = if ([string]$Request.type -ceq 'session-board-read') { 'read' } else { 'open' }
    return (Test-AuraSessionBoardDesktopExactFields -Value $Value -Fields @(
        'type', 'version', 'requestId', 'action', 'code')) -and
      [string]$Value.action -ceq $action -and [string]$Value.code -ceq 'unavailable'
  }
  if ([string]$Request.type -ceq 'session-board-read') {
    return [string]$Value.type -ceq 'session-board-state' -and
      (Test-AuraSessionBoardDesktopExactFields -Value $Value -Fields @(
        'type', 'version', 'requestId', 'state')) -and
      (Test-AuraSessionBoardDesktopState -Value $Value.state)
  }
  if ([string]$Value.type -cne 'session-board-open-result' -or
      -not (Test-AuraSessionBoardDesktopExactFields -Value $Value -Fields @(
        'type', 'version', 'requestId', 'sessionId', 'ok', 'outcome')) -or
      [string]$Value.sessionId -cne [string]$Request.sessionId -or
      $Value.ok -isnot [bool] -or
      [string]$Value.outcome -cnotin @('opened', 'unavailable', 'not-found', 'uncertain')) {
    return $false
  }
  return [bool]$Value.ok -eq ([string]$Value.outcome -ceq 'opened')
}

function New-AuraSessionBoardDesktopUnavailableJson {
  param([Parameter(Mandatory = $true)][object]$Request)
  $action = if ([string]$Request.type -ceq 'session-board-read') { 'read' } else { 'open' }
  return ([PSCustomObject][ordered]@{
      type = 'session-board-error'
      version = 1
      requestId = [string]$Request.requestId
      action = $action
      code = 'unavailable'
    } | ConvertTo-Json -Compress)
}

function New-AuraSessionBoardDesktopRandomHex {
  param([ValidateRange(1, 64)][int]$Count)
  $bytes = [byte[]]::new($Count)
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
  } finally {
    $rng.Dispose()
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
}

function Get-AuraSessionBoardDesktopPaths {
  param([Parameter(Mandatory = $true)][string]$DataRoot)
  if ([string]::IsNullOrWhiteSpace($DataRoot)) {
    throw 'Desktop Work Hub data root is unavailable.'
  }
  $root = [IO.Path]::GetFullPath($DataRoot).TrimEnd(
    [IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)
  $directory = [IO.Path]::GetFullPath((Join-Path $root 'session-board'))
  $path = [IO.Path]::GetFullPath((Join-Path $directory 'desktop-host-v1.json'))
  if (-not $directory.StartsWith(
      $root + [IO.Path]::DirectorySeparatorChar,
      [StringComparison]::OrdinalIgnoreCase) -or
      -not [string]::Equals(
        (Split-Path -Parent $path), $directory,
        [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Desktop Work Hub discovery path escaped its root.'
  }
  return [PSCustomObject]@{ Root = $root; Directory = $directory; Path = $path }
}

function Assert-AuraSessionBoardDesktopNotRedirected {
  param([Parameter(Mandatory = $true)][string[]]$Paths)
  foreach ($candidate in $Paths) {
    if (-not (Test-Path -LiteralPath $candidate)) { continue }
    $item = Get-Item -LiteralPath $candidate -Force -ErrorAction Stop
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'Desktop Work Hub discovery path is redirected.'
    }
  }
}

function Set-AuraSessionBoardDesktopAcl {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [switch]$Directory
  )
  Assert-AuraSessionBoardDesktopNotRedirected -Paths @($Path)
  $userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if ($null -eq $userSid) { throw 'Desktop Work Hub user is unavailable.' }
  $systemSid = [Security.Principal.SecurityIdentifier]::new(
    [Security.Principal.WellKnownSidType]::LocalSystemSid, $null)
  $inheritance = if ($Directory) {
    [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
      [Security.AccessControl.InheritanceFlags]::ObjectInherit
  } else { [Security.AccessControl.InheritanceFlags]::None }
  $security = if ($Directory) {
    [Security.AccessControl.DirectorySecurity]::new()
  } else { [Security.AccessControl.FileSecurity]::new() }
  $security.SetAccessRuleProtection($true, $false)
  $security.SetOwner($userSid)
  foreach ($sid in @($userSid, $systemSid)) {
    [void]$security.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
        $sid,
        [Security.AccessControl.FileSystemRights]::FullControl,
        $inheritance,
        [Security.AccessControl.PropagationFlags]::None,
        [Security.AccessControl.AccessControlType]::Allow))
  }
  if ($Directory) { [IO.Directory]::SetAccessControl($Path, $security) }
  else { [IO.File]::SetAccessControl($Path, $security) }
}

function Assert-AuraSessionBoardDesktopOwner {
  param([Parameter(Mandatory = $true)][string]$Path)
  Assert-AuraSessionBoardDesktopNotRedirected -Paths @($Path)
  $current = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if ($null -eq $current) { throw 'Desktop Work Hub user is unavailable.' }
  $owner = (Get-Acl -LiteralPath $Path).GetOwner(
    [Security.Principal.SecurityIdentifier])
  if ($null -eq $owner -or -not [string]::Equals(
      $owner.Value, $current.Value, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Desktop Work Hub discovery owner is invalid.'
  }
}

function Write-AuraSessionBoardDesktopDiscovery {
  $paths = Get-AuraSessionBoardDesktopPaths -DataRoot $script:AuraSessionBoardDesktopDataRoot
  Assert-AuraSessionBoardDesktopNotRedirected -Paths @($paths.Root, $paths.Directory, $paths.Path)
  [void][IO.Directory]::CreateDirectory($paths.Directory)
  Set-AuraSessionBoardDesktopAcl -Path $paths.Directory -Directory
  $script:AuraSessionBoardDesktopDiscoveryPath = $paths.Path
  $value = [PSCustomObject][ordered]@{
    schemaVersion = 1
    contractId = $script:AuraSessionBoardDesktopContractId
    pipe = $script:AuraSessionBoardDesktopPipeName
    token = $script:AuraSessionBoardDesktopToken
    instanceId = $script:AuraSessionBoardDesktopInstanceId
    createdAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  }
  $bytes = $script:AuraSessionBoardDesktopUtf8.GetBytes(
    (($value | ConvertTo-Json -Compress) + [Environment]::NewLine))
  $temporary = Join-Path $paths.Directory ('.desktop-host-v1.{0}.tmp' -f
    [Guid]::NewGuid().ToString('N'))
  $backup = Join-Path $paths.Directory ('.desktop-host-v1.{0}.bak' -f
    [Guid]::NewGuid().ToString('N'))
  try {
    if ($bytes.Length -gt 4096) { throw 'Desktop Work Hub discovery is too large.' }
    [IO.File]::WriteAllBytes($temporary, $bytes)
    Set-AuraSessionBoardDesktopAcl -Path $temporary
    if (Test-Path -LiteralPath $paths.Path -PathType Leaf) {
      [IO.File]::Replace($temporary, $paths.Path, $backup, $true)
    } else {
      [IO.File]::Move($temporary, $paths.Path)
    }
    Set-AuraSessionBoardDesktopAcl -Path $paths.Path
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
    foreach ($candidate in @($temporary, $backup)) {
      if (Test-Path -LiteralPath $candidate) {
        try { Remove-Item -LiteralPath $candidate -Force } catch {}
      }
    }
  }
}

function Read-AuraSessionBoardDesktopDiscovery {
  param([Parameter(Mandatory = $true)][string]$DataRoot)
  $paths = Get-AuraSessionBoardDesktopPaths -DataRoot $DataRoot
  Assert-AuraSessionBoardDesktopNotRedirected -Paths @($paths.Root, $paths.Directory, $paths.Path)
  if (-not (Test-Path -LiteralPath $paths.Path -PathType Leaf)) {
    throw 'Desktop Work Hub host is unavailable.'
  }
  Assert-AuraSessionBoardDesktopOwner -Path $paths.Path
  $item = Get-Item -LiteralPath $paths.Path -Force
  if ($item.Length -lt 2 -or $item.Length -gt 4096) {
    throw 'Desktop Work Hub discovery size is invalid.'
  }
  $bytes = [IO.File]::ReadAllBytes($paths.Path)
  try {
    $json = $script:AuraSessionBoardDesktopUtf8.GetString($bytes)
    if (-not (Test-AuraSessionBoardDesktopUniqueJsonProperties -Json $json)) {
      throw 'Desktop Work Hub discovery is invalid.'
    }
    $value = $json | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw 'Desktop Work Hub discovery is invalid.'
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
  if (-not (Test-AuraSessionBoardDesktopExactFields -Value $value -Fields @(
        'schemaVersion', 'contractId', 'pipe', 'token', 'instanceId', 'createdAt')) -or
      $value.schemaVersion -ne 1 -or
      [string]$value.contractId -cne $script:AuraSessionBoardDesktopContractId -or
      $value.pipe -isnot [string] -or ([string]$value.pipe).Length -gt 160 -or
      [string]$value.pipe -cnotmatch '^ClaudeAura\.SessionBoardDesktopV1\.[A-Za-z0-9.-]{1,96}$' -or
      $value.token -isnot [string] -or [string]$value.token -cnotmatch '^[a-f0-9]{64}$' -or
      -not (Test-AuraSessionBoardDesktopUuid -Value $value.instanceId) -or
      -not (Test-AuraSessionBoardDesktopInteger -Value $value.createdAt)) {
    throw 'Desktop Work Hub discovery shape is invalid.'
  }
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  if ([long]$value.createdAt -gt $now + 30000) {
    throw 'Desktop Work Hub discovery timestamp is invalid.'
  }
  return $value
}

function Remove-AuraSessionBoardDesktopDiscovery {
  if ([string]::IsNullOrWhiteSpace($script:AuraSessionBoardDesktopDiscoveryPath)) { return }
  try {
    if (-not (Test-Path -LiteralPath $script:AuraSessionBoardDesktopDiscoveryPath -PathType Leaf)) {
      return
    }
    $bytes = [IO.File]::ReadAllBytes($script:AuraSessionBoardDesktopDiscoveryPath)
    try {
      $json = $script:AuraSessionBoardDesktopUtf8.GetString($bytes)
      if (-not (Test-AuraSessionBoardDesktopUniqueJsonProperties -Json $json)) {
        throw 'Desktop Work Hub discovery is invalid.'
      }
      $value = $json | ConvertFrom-Json -ErrorAction Stop
      if ([string]$value.instanceId -ceq $script:AuraSessionBoardDesktopInstanceId) {
        Remove-Item -LiteralPath $script:AuraSessionBoardDesktopDiscoveryPath -Force
      }
    } finally {
      [Array]::Clear($bytes, 0, $bytes.Length)
    }
  } catch {}
}

function Initialize-AuraSessionBoardDesktopNative {
  if ('AuraSessionBoardDesktopNative' -as [type]) { return }
  Add-Type -AssemblyName System.Security -ErrorAction Stop
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using Microsoft.Win32.SafeHandles;

public static class AuraSessionBoardDesktopNative {
  [StructLayout(LayoutKind.Sequential)]
  private struct SecurityAttributes {
    public uint Length;
    public IntPtr SecurityDescriptor;
    [MarshalAs(UnmanagedType.Bool)] public bool InheritHandle;
  }

  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern IntPtr CreateNamedPipe(
    string name, uint openMode, uint pipeMode, uint maxInstances,
    uint outBufferSize, uint inBufferSize, uint defaultTimeout,
    ref SecurityAttributes securityAttributes);

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern bool GetNamedPipeClientProcessId(
    SafePipeHandle pipe, out uint processId);

  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern bool ImpersonateNamedPipeClient(SafePipeHandle pipe);

  [DllImport("advapi32.dll", SetLastError = true)]
  private static extern bool RevertToSelf();

  public static SafePipeHandle CreateLocalOnlyPipe(
      string pipeName, byte[] securityDescriptor) {
    if (String.IsNullOrEmpty(pipeName)) throw new ArgumentException("pipeName");
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
        1, 262144, 4096, 0, ref attributes);
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

function New-AuraSessionBoardDesktopPipe {
  Initialize-AuraSessionBoardDesktopNative
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  if ($null -eq $sid) { throw 'Desktop Work Hub user is unavailable.' }
  $security = [IO.Pipes.PipeSecurity]::new()
  $security.SetAccessRuleProtection($true, $false)
  $security.SetOwner($sid)
  [void]$security.AddAccessRule([IO.Pipes.PipeAccessRule]::new(
      $sid,
      [IO.Pipes.PipeAccessRights]::FullControl,
      [Security.AccessControl.AccessControlType]::Allow))
  $descriptorBytes = $security.GetSecurityDescriptorBinaryForm()
  try {
    $handle = [AuraSessionBoardDesktopNative]::CreateLocalOnlyPipe(
      $script:AuraSessionBoardDesktopPipeName, $descriptorBytes)
    try {
      return [IO.Pipes.NamedPipeServerStream]::new(
        [IO.Pipes.PipeDirection]::InOut, $true, $false, $handle)
    } catch {
      $handle.Dispose()
      throw
    }
  } finally {
    [Array]::Clear($descriptorBytes, 0, $descriptorBytes.Length)
  }
}

function Test-AuraSessionBoardDesktopClientIdentity {
  if ($null -eq $script:AuraSessionBoardDesktopPipe -or
      -not $script:AuraSessionBoardDesktopPipe.IsConnected) { return $false }
  try {
    [uint32]$clientProcessId = 0
    if (-not [AuraSessionBoardDesktopNative]::GetNamedPipeClientProcessId(
        $script:AuraSessionBoardDesktopPipe.SafePipeHandle,
        [ref]$clientProcessId) -or $clientProcessId -eq 0) {
      return $false
    }
    $clientProcess = [Diagnostics.Process]::GetProcessById([int]$clientProcessId)
    $currentProcess = [Diagnostics.Process]::GetCurrentProcess()
    try {
      if ($clientProcess.SessionId -ne $currentProcess.SessionId) { return $false }
    } finally {
      $clientProcess.Dispose()
      $currentProcess.Dispose()
    }
    $clientSid = [AuraSessionBoardDesktopNative]::GetNamedPipeClientSid(
      $script:AuraSessionBoardDesktopPipe.SafePipeHandle)
    $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    return [string]::Equals(
      $clientSid, $currentSid, [StringComparison]::OrdinalIgnoreCase)
  } catch {
    return $false
  }
}

function Copy-AuraSessionBoardDesktopBytes {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  $copy = [byte[]]::new($Bytes.Length)
  [Array]::Copy($Bytes, $copy, $Bytes.Length)
  return ,$copy
}

function Clear-AuraSessionBoardDesktopConnection {
  foreach ($buffer in @(
      $script:AuraSessionBoardDesktopReadBuffer,
      $script:AuraSessionBoardDesktopInbound,
      $script:AuraSessionBoardDesktopWriteBuffer)) {
    if ($null -ne $buffer) { [Array]::Clear($buffer, 0, $buffer.Length) }
  }
  while ($script:AuraSessionBoardDesktopWriteQueue.Count -gt 0) {
    $queued = $script:AuraSessionBoardDesktopWriteQueue.Dequeue()
    [Array]::Clear($queued, 0, $queued.Length)
  }
  $script:AuraSessionBoardDesktopAcceptTask = $null
  $script:AuraSessionBoardDesktopReadTask = $null
  $script:AuraSessionBoardDesktopReadBuffer = $null
  $script:AuraSessionBoardDesktopInbound = [byte[]]::new(0)
  $script:AuraSessionBoardDesktopWriteTask = $null
  $script:AuraSessionBoardDesktopWriteBuffer = $null
  $script:AuraSessionBoardDesktopAuthenticated = $false
  $script:AuraSessionBoardDesktopConnectDeadlineUtc = [DateTime]::MinValue
  $script:AuraSessionBoardDesktopRequestDeadlineUtc = [DateTime]::MinValue
  if ($null -ne $script:AuraSessionBoardDesktopPipe) {
    try { $script:AuraSessionBoardDesktopPipe.Dispose() } catch {}
  }
  $script:AuraSessionBoardDesktopPipe = $null
}

function Clear-AuraSessionBoardDesktopReceipts {
  foreach ($entry in @($script:AuraSessionBoardDesktopReceiptCache.Values)) {
    if ($null -ne $entry -and $null -ne $entry.Bytes) {
      [Array]::Clear($entry.Bytes, 0, $entry.Bytes.Length)
    }
  }
  $script:AuraSessionBoardDesktopReceiptCache.Clear()
  $script:AuraSessionBoardDesktopReceiptOrder.Clear()
}

function Start-AuraSessionBoardDesktopAccept {
  Clear-AuraSessionBoardDesktopConnection
  if (-not $script:AuraSessionBoardDesktopInitialized) { return }
  $script:AuraSessionBoardDesktopPipe = New-AuraSessionBoardDesktopPipe
  $script:AuraSessionBoardDesktopAcceptTask =
    $script:AuraSessionBoardDesktopPipe.WaitForConnectionAsync()
}

function Start-AuraSessionBoardDesktopRead {
  if ($null -ne $script:AuraSessionBoardDesktopReadTask -or
      $null -eq $script:AuraSessionBoardDesktopPipe -or
      -not $script:AuraSessionBoardDesktopPipe.IsConnected) { return }
  $script:AuraSessionBoardDesktopReadBuffer =
    [byte[]]::new($script:AuraSessionBoardDesktopRequestMaximumBytes + 1)
  $script:AuraSessionBoardDesktopReadTask =
    $script:AuraSessionBoardDesktopPipe.ReadAsync(
      $script:AuraSessionBoardDesktopReadBuffer,
      0,
      $script:AuraSessionBoardDesktopReadBuffer.Length)
}

function Start-AuraSessionBoardDesktopWrite {
  if ($null -ne $script:AuraSessionBoardDesktopWriteTask -or
      $script:AuraSessionBoardDesktopWriteQueue.Count -eq 0 -or
      $null -eq $script:AuraSessionBoardDesktopPipe -or
      -not $script:AuraSessionBoardDesktopPipe.IsConnected) { return }
  $script:AuraSessionBoardDesktopWriteBuffer =
    $script:AuraSessionBoardDesktopWriteQueue.Dequeue()
  $script:AuraSessionBoardDesktopWriteTask =
    $script:AuraSessionBoardDesktopPipe.WriteAsync(
      $script:AuraSessionBoardDesktopWriteBuffer,
      0,
      $script:AuraSessionBoardDesktopWriteBuffer.Length)
}

function Add-AuraSessionBoardDesktopBytes {
  param([Parameter(Mandatory = $true)][byte[]]$Bytes)
  if ($Bytes.Length -lt 2 -or
      $Bytes.Length -gt $script:AuraSessionBoardDesktopResponseMaximumBytes -or
      $script:AuraSessionBoardDesktopWriteQueue.Count -ge 16) {
    throw 'Desktop Work Hub response queue is invalid.'
  }
  $script:AuraSessionBoardDesktopWriteQueue.Enqueue(
    (Copy-AuraSessionBoardDesktopBytes -Bytes $Bytes))
  Start-AuraSessionBoardDesktopWrite
}

function ConvertTo-AuraSessionBoardDesktopResponseBytes {
  param([Parameter(Mandatory = $true)][object]$Value)
  $bytes = $script:AuraSessionBoardDesktopUtf8.GetBytes(
    (($Value | ConvertTo-Json -Depth 9 -Compress) + "`n"))
  if ($bytes.Length -lt 2 -or
      $bytes.Length -gt $script:AuraSessionBoardDesktopResponseMaximumBytes) {
    [Array]::Clear($bytes, 0, $bytes.Length)
    throw 'Desktop Work Hub response size is invalid.'
  }
  return ,$bytes
}

function Add-AuraSessionBoardDesktopReceipt {
  param(
    [Parameter(Mandatory = $true)][object]$Request,
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][byte[]]$Bytes
  )
  while ($script:AuraSessionBoardDesktopReceiptCache.Count -ge
      $script:AuraSessionBoardDesktopReceiptCacheLimit) {
    $oldest = $script:AuraSessionBoardDesktopReceiptOrder.Dequeue()
    $old = $script:AuraSessionBoardDesktopReceiptCache[$oldest]
    if ($null -ne $old -and $null -ne $old.Bytes) {
      [Array]::Clear($old.Bytes, 0, $old.Bytes.Length)
    }
    [void]$script:AuraSessionBoardDesktopReceiptCache.Remove($oldest)
  }
  $script:AuraSessionBoardDesktopReceiptCache.Add(
    [string]$Request.requestId,
    [PSCustomObject]@{
      Request = $Text
      Bytes = Copy-AuraSessionBoardDesktopBytes -Bytes $Bytes
    })
  $script:AuraSessionBoardDesktopReceiptOrder.Enqueue([string]$Request.requestId)
}

function Receive-AuraSessionBoardDesktopText {
  param([Parameter(Mandatory = $true)][string]$Text)
  if (-not $script:AuraSessionBoardDesktopAuthenticated) {
    if (-not (Test-AuraSessionBoardDesktopClientIdentity)) {
      throw 'Desktop Work Hub client identity is invalid.'
    }
    if (-not (Test-AuraSessionBoardDesktopUniqueJsonProperties -Json $Text)) {
      throw 'Desktop Work Hub hello is invalid.'
    }
    try { $hello = $Text | ConvertFrom-Json -ErrorAction Stop } catch {
      throw 'Desktop Work Hub hello is invalid.'
    }
    if (-not (Test-AuraSessionBoardDesktopExactFields -Value $hello -Fields @(
          'schemaVersion', 'contractId', 'kind', 'token', 'instanceId',
          'clientId', 'clientVersion')) -or
        $hello.schemaVersion -ne 1 -or
        [string]$hello.contractId -cne $script:AuraSessionBoardDesktopContractId -or
        [string]$hello.kind -cne 'hello' -or
        [string]$hello.token -cne $script:AuraSessionBoardDesktopToken -or
        [string]$hello.instanceId -cne $script:AuraSessionBoardDesktopInstanceId -or
        [string]$hello.clientId -cne 'desktop-work-hub' -or
        $hello.clientVersion -isnot [string] -or
        ([string]$hello.clientVersion).Length -gt 64 -or
        [string]$hello.clientVersion -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$') {
      throw 'Desktop Work Hub hello is invalid.'
    }
    $script:AuraSessionBoardDesktopAuthenticated = $true
    $script:AuraSessionBoardDesktopConnectDeadlineUtc = [DateTime]::MinValue
    $readyBytes = ConvertTo-AuraSessionBoardDesktopResponseBytes -Value (
      [PSCustomObject][ordered]@{
        schemaVersion = 1
        contractId = $script:AuraSessionBoardDesktopContractId
        kind = 'ready'
        instanceId = $script:AuraSessionBoardDesktopInstanceId
      })
    try { Add-AuraSessionBoardDesktopBytes -Bytes $readyBytes }
    finally { [Array]::Clear($readyBytes, 0, $readyBytes.Length) }
    return
  }

  $request = Get-AuraSessionBoardDesktopRequest -Json $Text
  $requestId = [string]$request.requestId
  if ($script:AuraSessionBoardDesktopReceiptCache.ContainsKey($requestId)) {
    $cached = $script:AuraSessionBoardDesktopReceiptCache[$requestId]
    if ([string]$cached.Request -cne $Text) {
      throw 'Desktop Work Hub request identifier was reused.'
    }
    Add-AuraSessionBoardDesktopBytes -Bytes $cached.Bytes
    return
  }

  $response = Invoke-AuraSessionBoardHostRequest -Json $Text `
    -Source 'https://aura.studio/work-hub.html' -Surface 'desktop'
  if (-not (Test-AuraSessionBoardDesktopResponse -Value $response -Request $request)) {
    throw 'Desktop Work Hub response is invalid.'
  }
  if ($response.PSObject.Properties.Name -ccontains 'outcome' -and
      [string]$response.outcome -ceq 'opened' -and
      (Get-Command Show-AuraUiMain -ErrorAction SilentlyContinue)) {
    try { Show-AuraUiMain } catch {}
  }
  $responseBytes = ConvertTo-AuraSessionBoardDesktopResponseBytes -Value $response
  try {
    Add-AuraSessionBoardDesktopReceipt `
      -Request $request -Text $Text -Bytes $responseBytes
    Add-AuraSessionBoardDesktopBytes -Bytes $responseBytes
  } finally {
    [Array]::Clear($responseBytes, 0, $responseBytes.Length)
  }
}

function Complete-AuraSessionBoardDesktopRead {
  $task = $script:AuraSessionBoardDesktopReadTask
  $buffer = $script:AuraSessionBoardDesktopReadBuffer
  $script:AuraSessionBoardDesktopReadTask = $null
  $script:AuraSessionBoardDesktopReadBuffer = $null
  $combined = $null
  try {
    $count = [int]$task.GetAwaiter().GetResult()
    if ($count -le 0) { throw 'Desktop Work Hub client disconnected.' }
    $combined = [byte[]]::new($script:AuraSessionBoardDesktopInbound.Length + $count)
    [Array]::Copy(
      $script:AuraSessionBoardDesktopInbound, 0, $combined, 0,
      $script:AuraSessionBoardDesktopInbound.Length)
    [Array]::Copy(
      $buffer, 0, $combined, $script:AuraSessionBoardDesktopInbound.Length, $count)
    [Array]::Clear(
      $script:AuraSessionBoardDesktopInbound,
      0,
      $script:AuraSessionBoardDesktopInbound.Length)
    $offset = 0
    while ($offset -lt $combined.Length) {
      $newline = [Array]::IndexOf($combined, [byte]10, $offset)
      if ($newline -lt 0) { break }
      $length = $newline - $offset
      if ($length -lt 2 -or
          $length -gt $script:AuraSessionBoardDesktopRequestMaximumBytes) {
        throw 'Desktop Work Hub request frame is invalid.'
      }
      $line = [byte[]]::new($length)
      try {
        [Array]::Copy($combined, $offset, $line, 0, $length)
        Receive-AuraSessionBoardDesktopText -Text (
          $script:AuraSessionBoardDesktopUtf8.GetString($line))
      } finally {
        [Array]::Clear($line, 0, $line.Length)
      }
      $offset = $newline + 1
      $script:AuraSessionBoardDesktopRequestDeadlineUtc = [DateTime]::MinValue
    }
    $remaining = $combined.Length - $offset
    if ($remaining -gt $script:AuraSessionBoardDesktopRequestMaximumBytes) {
      throw 'Desktop Work Hub request frame is invalid.'
    }
    $script:AuraSessionBoardDesktopInbound = [byte[]]::new($remaining)
    if ($remaining -gt 0) {
      [Array]::Copy($combined, $offset, $script:AuraSessionBoardDesktopInbound, 0, $remaining)
      $script:AuraSessionBoardDesktopRequestDeadlineUtc = [DateTime]::UtcNow.AddSeconds(2)
    }
  } finally {
    [Array]::Clear($buffer, 0, $buffer.Length)
    if ($null -ne $combined) { [Array]::Clear($combined, 0, $combined.Length) }
  }
  Start-AuraSessionBoardDesktopRead
}

function Update-AuraSessionBoardDesktopHost {
  if (-not $script:AuraSessionBoardDesktopInitialized) { return }
  try {
    if ($null -ne $script:AuraSessionBoardDesktopAcceptTask -and
        $script:AuraSessionBoardDesktopAcceptTask.IsCompleted) {
      $task = $script:AuraSessionBoardDesktopAcceptTask
      $script:AuraSessionBoardDesktopAcceptTask = $null
      [void]$task.GetAwaiter().GetResult()
      $script:AuraSessionBoardDesktopConnectDeadlineUtc = [DateTime]::UtcNow.AddSeconds(2)
      Start-AuraSessionBoardDesktopRead
    }
    if ($null -ne $script:AuraSessionBoardDesktopWriteTask -and
        $script:AuraSessionBoardDesktopWriteTask.IsCompleted) {
      $task = $script:AuraSessionBoardDesktopWriteTask
      $buffer = $script:AuraSessionBoardDesktopWriteBuffer
      $script:AuraSessionBoardDesktopWriteTask = $null
      $script:AuraSessionBoardDesktopWriteBuffer = $null
      try { [void]$task.GetAwaiter().GetResult() }
      finally { [Array]::Clear($buffer, 0, $buffer.Length) }
      Start-AuraSessionBoardDesktopWrite
    }
    if ($null -ne $script:AuraSessionBoardDesktopReadTask -and
        $script:AuraSessionBoardDesktopReadTask.IsCompleted) {
      Complete-AuraSessionBoardDesktopRead
    }
    $now = [DateTime]::UtcNow
    if ((-not $script:AuraSessionBoardDesktopAuthenticated -and
        $script:AuraSessionBoardDesktopConnectDeadlineUtc -ne [DateTime]::MinValue -and
        $now -ge $script:AuraSessionBoardDesktopConnectDeadlineUtc) -or
        ($script:AuraSessionBoardDesktopRequestDeadlineUtc -ne [DateTime]::MinValue -and
          $now -ge $script:AuraSessionBoardDesktopRequestDeadlineUtc)) {
      throw 'Desktop Work Hub connection deadline expired.'
    }
  } catch {
    try { Write-AuraUiLog -Message 'Desktop Work Hub connection was reset.' } catch {}
    Start-AuraSessionBoardDesktopAccept
  }
}

function Initialize-AuraSessionBoardDesktopHost {
  if ($script:AuraSessionBoardDesktopInitialized) { return $true }
  try {
    if (-not (Get-Command Invoke-AuraSessionBoardHostRequest -ErrorAction SilentlyContinue)) {
      throw 'Desktop Work Hub business seam is unavailable.'
    }
    $script:AuraSessionBoardDesktopDataRoot = [string]$script:DataRoot
    [void](Get-AuraSessionBoardDesktopPaths -DataRoot $script:AuraSessionBoardDesktopDataRoot)
    $script:AuraSessionBoardDesktopInstanceId =
      [Guid]::NewGuid().ToString('D').ToLowerInvariant()
    $script:AuraSessionBoardDesktopPipeName =
      'ClaudeAura.SessionBoardDesktopV1.' + (New-AuraSessionBoardDesktopRandomHex -Count 8)
    $script:AuraSessionBoardDesktopToken = New-AuraSessionBoardDesktopRandomHex -Count 32
    Clear-AuraSessionBoardDesktopReceipts
    $script:AuraSessionBoardDesktopInitialized = $true
    Start-AuraSessionBoardDesktopAccept
    Write-AuraSessionBoardDesktopDiscovery
    return $true
  } catch {
    $script:AuraSessionBoardDesktopInitialized = $false
    Clear-AuraSessionBoardDesktopConnection
    Remove-AuraSessionBoardDesktopDiscovery
    try { Write-AuraUiLog -Message 'Desktop Work Hub host is unavailable.' } catch {}
    return $false
  }
}

function Dispose-AuraSessionBoardDesktopHost {
  $script:AuraSessionBoardDesktopInitialized = $false
  Clear-AuraSessionBoardDesktopConnection
  Clear-AuraSessionBoardDesktopReceipts
  Remove-AuraSessionBoardDesktopDiscovery
  $script:AuraSessionBoardDesktopDataRoot = ''
  $script:AuraSessionBoardDesktopDiscoveryPath = ''
  $script:AuraSessionBoardDesktopPipeName = ''
  $script:AuraSessionBoardDesktopToken = ''
  $script:AuraSessionBoardDesktopInstanceId = ''
}

function Write-AuraSessionBoardDesktopClientLine {
  param(
    [Parameter(Mandatory = $true)][IO.Pipes.NamedPipeClientStream]$Stream,
    [Parameter(Mandatory = $true)][string]$Json,
    [ValidateRange(1, 262144)][int]$MaximumBytes,
    [ValidateRange(1, 5000)][int]$TimeoutMilliseconds
  )
  $bytes = $script:AuraSessionBoardDesktopUtf8.GetBytes($Json + "`n")
  try {
    if ($bytes.Length -gt $MaximumBytes) {
      throw 'Desktop Work Hub client frame is too large.'
    }
    $task = $Stream.WriteAsync($bytes, 0, $bytes.Length)
    if (-not $task.Wait($TimeoutMilliseconds)) {
      $Stream.Dispose()
      throw 'Desktop Work Hub client write timed out.'
    }
    [void]$task.GetAwaiter().GetResult()
  } finally {
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
}

function Read-AuraSessionBoardDesktopClientLine {
  param(
    [Parameter(Mandatory = $true)][IO.Pipes.NamedPipeClientStream]$Stream,
    [ValidateRange(1, 262144)][int]$MaximumBytes,
    [ValidateRange(1, 5000)][int]$TimeoutMilliseconds
  )
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  $memory = [IO.MemoryStream]::new()
  $buffer = [byte[]]::new([Math]::Min(4096, $MaximumBytes + 1))
  try {
    while ($memory.Length -le $MaximumBytes) {
      $remaining = [int][Math]::Ceiling(($deadline - [DateTime]::UtcNow).TotalMilliseconds)
      if ($remaining -le 0) {
        $Stream.Dispose()
        throw 'Desktop Work Hub client read timed out.'
      }
      $task = $Stream.ReadAsync($buffer, 0, $buffer.Length)
      if (-not $task.Wait($remaining)) {
        $Stream.Dispose()
        throw 'Desktop Work Hub client read timed out.'
      }
      $count = [int]$task.GetAwaiter().GetResult()
      if ($count -le 0) { throw 'Desktop Work Hub host disconnected.' }
      $newline = [Array]::IndexOf($buffer, [byte]10, 0, $count)
      $copyCount = if ($newline -ge 0) { $newline } else { $count }
      if ($memory.Length + $copyCount -gt $MaximumBytes) {
        throw 'Desktop Work Hub client response is too large.'
      }
      $memory.Write($buffer, 0, $copyCount)
      if ($newline -ge 0) {
        $bytes = $memory.ToArray()
        try { return $script:AuraSessionBoardDesktopUtf8.GetString($bytes) }
        finally { [Array]::Clear($bytes, 0, $bytes.Length) }
      }
    }
    throw 'Desktop Work Hub client response is too large.'
  } finally {
    [Array]::Clear($buffer, 0, $buffer.Length)
    $memory.Dispose()
  }
}

function Invoke-AuraSessionBoardDesktopClientRequest {
  param(
    [Parameter(Mandatory = $true)][string]$RequestJson,
    [Parameter(Mandatory = $true)][string]$DataRoot,
    [ValidateRange(1, 2000)][int]$ConnectTimeoutMilliseconds = 250,
    [ValidateRange(1, 5000)][int]$RequestTimeoutMilliseconds = 1500
  )
  $request = Get-AuraSessionBoardDesktopRequest -Json $RequestJson
  $client = $null
  try {
    $discovery = Read-AuraSessionBoardDesktopDiscovery -DataRoot $DataRoot
    $client = [IO.Pipes.NamedPipeClientStream]::new(
      '.',
      [string]$discovery.pipe,
      [IO.Pipes.PipeDirection]::InOut,
      [IO.Pipes.PipeOptions]::Asynchronous)
    $client.Connect($ConnectTimeoutMilliseconds)
    $hello = [PSCustomObject][ordered]@{
      schemaVersion = 1
      contractId = $script:AuraSessionBoardDesktopContractId
      kind = 'hello'
      token = [string]$discovery.token
      instanceId = [string]$discovery.instanceId
      clientId = 'desktop-work-hub'
      clientVersion = '1.0.0'
    }
    Write-AuraSessionBoardDesktopClientLine `
      -Stream $client `
      -Json ($hello | ConvertTo-Json -Compress) `
      -MaximumBytes 4096 `
      -TimeoutMilliseconds $RequestTimeoutMilliseconds
    $readyJson = Read-AuraSessionBoardDesktopClientLine `
      -Stream $client `
      -MaximumBytes 4096 `
      -TimeoutMilliseconds $RequestTimeoutMilliseconds
    if (-not (Test-AuraSessionBoardDesktopUniqueJsonProperties -Json $readyJson)) {
      throw 'Desktop Work Hub ready frame is invalid.'
    }
    try { $ready = $readyJson | ConvertFrom-Json -ErrorAction Stop } catch {
      throw 'Desktop Work Hub ready frame is invalid.'
    }
    if (-not (Test-AuraSessionBoardDesktopExactFields -Value $ready -Fields @(
          'schemaVersion', 'contractId', 'kind', 'instanceId')) -or
        $ready.schemaVersion -ne 1 -or
        [string]$ready.contractId -cne $script:AuraSessionBoardDesktopContractId -or
        [string]$ready.kind -cne 'ready' -or
        [string]$ready.instanceId -cne [string]$discovery.instanceId) {
      throw 'Desktop Work Hub ready frame is invalid.'
    }
    Write-AuraSessionBoardDesktopClientLine `
      -Stream $client `
      -Json $RequestJson `
      -MaximumBytes 4096 `
      -TimeoutMilliseconds $RequestTimeoutMilliseconds
    $responseJson = Read-AuraSessionBoardDesktopClientLine `
      -Stream $client `
      -MaximumBytes 262144 `
      -TimeoutMilliseconds $RequestTimeoutMilliseconds
    if (-not (Test-AuraSessionBoardDesktopUniqueJsonProperties -Json $responseJson)) {
      throw 'Desktop Work Hub response JSON is invalid.'
    }
    try { $response = $responseJson | ConvertFrom-Json -ErrorAction Stop } catch {
      throw 'Desktop Work Hub response JSON is invalid.'
    }
    if (-not (Test-AuraSessionBoardDesktopResponse -Value $response -Request $request)) {
      throw 'Desktop Work Hub response shape is invalid.'
    }
    return $responseJson
  } catch {
    return New-AuraSessionBoardDesktopUnavailableJson -Request $request
  } finally {
    if ($null -ne $client) { try { $client.Dispose() } catch {} }
  }
}
