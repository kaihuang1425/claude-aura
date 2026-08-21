[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, [long]::MaxValue)]
  [long]$TargetWindow,
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, [int]::MaxValue)]
  [int]$TargetProcessId,
  [ValidatePattern('^[a-z][a-z0-9-]{1,39}$')]
  [string]$ThemeId = 'default',
  [ValidateSet('system', 'light', 'dark')]
  [string]$Appearance = 'system',
  [ValidateSet(
    'en', 'hi', 'es', 'fr', 'id', 'ja', 'ko', 'pt-BR', 'de', 'it',
    'vi', 'pl', 'tr', 'zh-CN', 'zh-HKTW')]
  [string]$Locale = 'en',
  [switch]$OriginalLook,
  [string]$PresentationStatePath,
  [string]$DataRoot = (Join-Path $env:LOCALAPPDATA 'ClaudeAura\data')
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$studioRoot = Join-Path $root 'studio'
$localeRoot = Join-Path $PSScriptRoot 'locales'
$vendorRoot = Join-Path $root 'vendor\webview2'
$webDataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\webview-work-hub-desktop'
$desktopHostPath = Join-Path $PSScriptRoot 'aura-session-board-desktop.ps1'

if (-not (Test-Path -LiteralPath $desktopHostPath -PathType Leaf)) {
  throw 'desktop-work-hub-host-missing'
}
. $desktopHostPath

function Test-AuraDesktopWorkHubUri {
  param([Parameter(Mandatory = $true)][Uri]$Uri)
  return $Uri.IsAbsoluteUri -and
    $Uri.Scheme -ceq 'https' -and
    $Uri.Host -ceq 'aura.studio' -and
    $Uri.AbsolutePath -ceq '/work-hub.html' -and
    $Uri.IsDefaultPort -and
    [string]::IsNullOrEmpty($Uri.UserInfo) -and
    [string]::IsNullOrEmpty($Uri.Query) -and
    [string]::IsNullOrEmpty($Uri.Fragment)
}

function Get-AuraDesktopWorkHubCopyFile {
  param([Parameter(Mandatory = $true)][string]$LocaleId)
  $path = Join-Path $localeRoot "$LocaleId.json"
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
  $item = Get-Item -LiteralPath $path -Force
  if ($item.PSIsContainer -or $item.Length -lt 2 -or $item.Length -gt 262144 -or
      ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    return $null
  }
  try { return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json }
  catch { return $null }
}

function Get-AuraDesktopWorkHubCopy {
  param([Parameter(Mandatory = $true)][string]$LocaleId)
  $fallback = Get-AuraDesktopWorkHubCopyFile -LocaleId 'en'
  if ($null -eq $fallback) { throw 'desktop-work-hub-copy-missing' }
  $localized = if ($LocaleId -ceq 'en') { $fallback } else {
    Get-AuraDesktopWorkHubCopyFile -LocaleId $LocaleId
  }
  $title = if ($null -ne $localized -and $localized.workHubTitle -is [string]) {
    [string]$localized.workHubTitle
  } else { [string]$fallback.workHubTitle }
  if ([string]::IsNullOrWhiteSpace($title) -or $title.Length -gt 120 -or
      [regex]::IsMatch($title, '[\x00-\x1F\x7F-\x9F]')) {
    throw 'desktop-work-hub-copy-invalid'
  }
  return [PSCustomObject]@{ workHubTitle = $title }
}

function ConvertTo-AuraDesktopWorkHubThemeId {
  param([AllowEmptyString()][string]$Value)
  if ($Value -cin @(
      'default', 'japanese-film-editorial', 'korean-prestige', 'cartoon-studio',
      'anime-twilight', 'study-library', 'japanese-idol', 'korean-idol')) {
    return $Value.ToLowerInvariant()
  }
  return 'default'
}

function Get-AuraDesktopWorkHubPresentationState {
  $state = [PSCustomObject]@{
    ThemeId = ConvertTo-AuraDesktopWorkHubThemeId -Value $ThemeId
    Appearance = $Appearance
    OriginalLook = [bool]$OriginalLook
  }
  if ([string]::IsNullOrWhiteSpace($PresentationStatePath) -or
      -not (Test-Path -LiteralPath $PresentationStatePath -PathType Leaf)) {
    return $state
  }
  try {
    $item = Get-Item -LiteralPath $PresentationStatePath -Force
    if ($item.PSIsContainer -or $item.Length -lt 2 -or $item.Length -gt 768 -or
        ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      return $state
    }
    $value = Get-Content -LiteralPath $PresentationStatePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $fields = @('schemaVersion', 'themeId', 'appearance', 'originalLook')
    $names = @($value.PSObject.Properties | ForEach-Object { $_.Name })
    if ($value -isnot [Management.Automation.PSCustomObject] -or
        $names.Count -ne $fields.Count -or
        @($names | Where-Object { $fields -cnotcontains $_ }).Count -ne 0 -or
        ($value.schemaVersion -isnot [int] -and $value.schemaVersion -isnot [long]) -or
        [long]$value.schemaVersion -ne 2 -or $value.themeId -isnot [string] -or
        $value.appearance -isnot [string] -or
        [string]$value.appearance -cnotin @('system', 'light', 'dark') -or
        $value.originalLook -isnot [bool]) {
      return $state
    }
    return [PSCustomObject]@{
      ThemeId = ConvertTo-AuraDesktopWorkHubThemeId -Value ([string]$value.themeId)
      Appearance = [string]$value.appearance
      OriginalLook = [bool]$value.originalLook
    }
  } catch { return $state }
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not ('ClaudeAuraDesktopWorkHubHost' -as [type])) {
  Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing @'
using System;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public sealed class ClaudeAuraDesktopWorkHubOwner : IWin32Window {
  private readonly IntPtr handle;
  public ClaudeAuraDesktopWorkHubOwner(IntPtr value) { handle = value; }
  public IntPtr Handle { get { return handle; } }
}

public static class ClaudeAuraDesktopWorkHubHost {
  private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
  private const uint GA_ROOTOWNER = 3;

  [StructLayout(LayoutKind.Sequential)]
  private struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

  [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr handle);
  [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr handle);
  [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr handle);
  [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr handle, uint flags);
  [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr handle, out RECT value);
  [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr handle);
  [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(
    IntPtr handle, int attribute, out RECT value, int size);

  public static bool IsOwnedTarget(IntPtr target, uint expectedProcessId) {
    uint actualProcessId;
    return target != IntPtr.Zero && IsWindow(target)
      && GetWindowThreadProcessId(target, out actualProcessId) != 0
      && actualProcessId == expectedProcessId;
  }

  public static bool TryPlace(Form panel, IntPtr target, uint expectedProcessId) {
    if (!IsOwnedTarget(target, expectedProcessId)) return false;
    if (!IsWindowVisible(target) || IsIconic(target)) {
      if (panel.Visible) panel.Hide();
      return true;
    }
    IntPtr foreground = GetForegroundWindow();
    bool active = foreground == target || foreground == panel.Handle
      || (foreground != IntPtr.Zero && GetAncestor(foreground, GA_ROOTOWNER) == target);
    if (!active) {
      if (panel.Visible) panel.Hide();
      return true;
    }
    RECT frame;
    if (DwmGetWindowAttribute(target, DWMWA_EXTENDED_FRAME_BOUNDS,
        out frame, Marshal.SizeOf(typeof(RECT))) != 0 && !GetWindowRect(target, out frame)) {
      if (panel.Visible) panel.Hide();
      return true;
    }
    int width = frame.Right - frame.Left;
    int height = frame.Bottom - frame.Top;
    uint rawDpi = GetDpiForWindow(target);
    float scale = Math.Max(1.0f, (rawDpi == 0 ? 96 : rawDpi) / 96.0f);
    int titleInset = Math.Max(44, (int)Math.Round(48 * scale));
    int sidebarInset = Math.Max((int)Math.Round(214 * scale),
      Math.Min((int)Math.Round(292 * scale), (int)Math.Round(width * 0.205)));
    int edgeInset = Math.Max(6, (int)Math.Round(8 * scale));
    Rectangle next = new Rectangle(
      frame.Left + sidebarInset,
      frame.Top + titleInset,
      width - sidebarInset - edgeInset,
      height - titleInset - edgeInset);
    if (next.Width < 560 || next.Height < 380) {
      if (panel.Visible) panel.Hide();
      return true;
    }
    if (panel.Bounds != next) panel.Bounds = next;
    if (!panel.Visible) panel.Show(new ClaudeAuraDesktopWorkHubOwner(target));
    panel.BringToFront();
    return true;
  }
}
'@
}

$targetHandle = [IntPtr]::new($TargetWindow)
if (-not [ClaudeAuraDesktopWorkHubHost]::IsOwnedTarget(
    $targetHandle, [uint32]$TargetProcessId)) {
  throw 'desktop-work-hub-target-invalid'
}

$coreDll = Join-Path $vendorRoot 'Microsoft.Web.WebView2.Core.dll'
$formsDll = Join-Path $vendorRoot 'Microsoft.Web.WebView2.WinForms.dll'
$architecture = [Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
if ($architecture -notin @('x64', 'x86', 'arm64')) { $architecture = 'x64' }
$loaderRoot = Join-Path $vendorRoot "runtimes\$architecture"
$loaderDll = Join-Path $loaderRoot 'WebView2Loader.dll'
foreach ($required in @(
    $coreDll,
    $formsDll,
    $loaderDll,
    (Join-Path $studioRoot 'work-hub.html'),
    (Join-Path $studioRoot 'session-board.js'),
    (Join-Path $studioRoot 'session-board.css'),
    (Join-Path $studioRoot 'session-board-presentation.js'),
    (Join-Path $studioRoot 'generated-themes.js')
  )) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "Desktop Work Hub component is missing: $required"
  }
}
$env:PATH = "$loaderRoot;$vendorRoot;$env:PATH"
[void][Reflection.Assembly]::LoadFrom($coreDll)
[void][Reflection.Assembly]::LoadFrom($formsDll)

$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$closeEventName = "Local\ClaudeAura.WorkHubPanel.$sid.$TargetProcessId"
$instanceMutexName = "Local\ClaudeAura.WorkHubPanel.Instance.$sid.$TargetProcessId"
$createdNew = $false
$instanceMutex = [Threading.Mutex]::new($true, $instanceMutexName, [ref]$createdNew)
$closeEvent = [Threading.EventWaitHandle]::new(
  $false, [Threading.EventResetMode]::AutoReset, $closeEventName)
if (-not $createdNew) {
  $closeEvent.Set() | Out-Null
  $closeEvent.Dispose()
  $instanceMutex.Dispose()
  exit 0
}

$uiCopy = Get-AuraDesktopWorkHubCopy -LocaleId $Locale
$workHubTitle = [string]$uiCopy.workHubTitle
$form = [Windows.Forms.Form]::new()
$form.Text = $workHubTitle
$form.AccessibleName = $workHubTitle
$form.FormBorderStyle = [Windows.Forms.FormBorderStyle]::None
$form.ShowInTaskbar = $false
$form.StartPosition = [Windows.Forms.FormStartPosition]::Manual
$form.TopMost = $true
$form.KeyPreview = $true
$form.BackColor = [Drawing.ColorTranslator]::FromHtml('#f7f5ef')
$form.AutoScaleMode = [Windows.Forms.AutoScaleMode]::Dpi
$form.Bounds = [Drawing.Rectangle]::new(0, 0, 1, 1)

$script:WorkHubWebView = [Microsoft.Web.WebView2.WinForms.WebView2]::new()
$script:WorkHubWebView.Dock = [Windows.Forms.DockStyle]::Fill
$script:WorkHubWebView.BackColor = $form.BackColor
$form.Controls.Add($script:WorkHubWebView)
$script:WorkHubEnvironmentTask = $null
$script:WorkHubEnsureTask = $null
$script:WorkHubConfigured = $false
$script:WorkHubNavigated = $false
$script:WorkHubPresentation = $null
$script:WorkHubPresentationFingerprint = $null
$script:WorkHubPresentationRevision = [long]-1
$script:WorkHubPresentationPostedRevision = [long]-1

function Send-AuraDesktopWorkHubPresentation {
  param(
    [Parameter(Mandatory = $true)][object]$State,
    [switch]$Force
  )
  $theme = ConvertTo-AuraDesktopWorkHubThemeId -Value ([string]$State.ThemeId)
  $appearanceValue = if ([string]$State.Appearance -cin @('system', 'light', 'dark')) {
    ([string]$State.Appearance).ToLowerInvariant()
  } else { 'system' }
  $enabled = -not [bool]$State.OriginalLook
  if (-not $enabled) { $theme = 'default'; $appearanceValue = 'system' }
  $fingerprint = "$Locale|$theme|$appearanceValue|$enabled"
  if ([string]$script:WorkHubPresentationFingerprint -cne $fingerprint -or
      $null -eq $script:WorkHubPresentation) {
    if ([long]$script:WorkHubPresentationRevision -ge 9007199254740991) { return $false }
    $script:WorkHubPresentationRevision += 1
    $script:WorkHubPresentationFingerprint = $fingerprint
    $script:WorkHubPresentation = [PSCustomObject][ordered]@{
      type = 'session-board-presentation'
      version = 1
      revision = [long]$script:WorkHubPresentationRevision
      locale = $Locale
      themeId = $theme
      appearance = $appearanceValue
      enabled = [bool]$enabled
    }
  }
  if (-not $script:WorkHubConfigured -or $null -eq $script:WorkHubWebView -or
      $script:WorkHubWebView.IsDisposed -or $null -eq $script:WorkHubWebView.CoreWebView2 -or
      (-not $Force -and
        [long]$script:WorkHubPresentationPostedRevision -ge [long]$script:WorkHubPresentation.revision)) {
    return $false
  }
  $json = $script:WorkHubPresentation | ConvertTo-Json -Depth 3 -Compress
  $script:WorkHubWebView.CoreWebView2.PostWebMessageAsJson($json)
  $script:WorkHubPresentationPostedRevision = [long]$script:WorkHubPresentation.revision
  return $true
}

$hostTimer = [Windows.Forms.Timer]::new()
$hostTimer.Interval = 50
$form.add_Shown({
  $script:WorkHubEnvironmentTask =
    [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::CreateAsync(
      $null, $webDataRoot, $null)
  $hostTimer.Start()
})
$form.add_KeyDown({
  param($sender, $eventArgs)
  if ($eventArgs.KeyCode -eq [Windows.Forms.Keys]::Escape) { $form.Close() }
})
$form.add_FormClosed({ $hostTimer.Stop() })

$hostTimer.add_Tick({
  try {
    if ($closeEvent.WaitOne(0)) { $form.Close(); return }
    if (-not [ClaudeAuraDesktopWorkHubHost]::TryPlace(
        $form, $targetHandle, [uint32]$TargetProcessId)) {
      $form.Close()
      return
    }
    if ($null -ne $script:WorkHubEnvironmentTask -and
        $script:WorkHubEnvironmentTask.IsCompleted) {
      $environment = $script:WorkHubEnvironmentTask.GetAwaiter().GetResult()
      $script:WorkHubEnvironmentTask = $null
      $script:WorkHubEnsureTask = $script:WorkHubWebView.EnsureCoreWebView2Async($environment)
    }
    if ($null -ne $script:WorkHubEnsureTask -and $script:WorkHubEnsureTask.IsCompleted) {
      [void]$script:WorkHubEnsureTask.GetAwaiter().GetResult()
      $script:WorkHubEnsureTask = $null
      $core = $script:WorkHubWebView.CoreWebView2
      $core.Settings.AreDevToolsEnabled = $false
      $core.Settings.IsStatusBarEnabled = $false
      $core.Settings.AreDefaultContextMenusEnabled = $false
      $core.Settings.AreBrowserAcceleratorKeysEnabled = $true
      $core.Settings.IsZoomControlEnabled = $true
      $core.Settings.IsWebMessageEnabled = $true
      $core.SetVirtualHostNameToFolderMapping(
        'aura.studio', $studioRoot,
        [Microsoft.Web.WebView2.Core.CoreWebView2HostResourceAccessKind]::DenyCors)
      $core.add_NavigationStarting({
        param($sender, $eventArgs)
        try {
          if (-not (Test-AuraDesktopWorkHubUri -Uri ([Uri]$eventArgs.Uri))) {
            $eventArgs.Cancel = $true
          }
        } catch { $eventArgs.Cancel = $true }
      })
      $core.add_NewWindowRequested({ param($sender, $eventArgs); $eventArgs.Handled = $true })
      $core.add_NavigationCompleted({
        param($sender, $eventArgs)
        if ($eventArgs.PSObject.Properties.Name -contains 'IsSuccess' -and -not $eventArgs.IsSuccess) {
          return
        }
        [void](Send-AuraDesktopWorkHubPresentation `
          -State (Get-AuraDesktopWorkHubPresentationState) -Force)
      })
      $core.add_WebMessageReceived({
        param($sender, $eventArgs)
        $requestJson = $null
        try {
          if (-not (Test-AuraDesktopWorkHubUri -Uri ([Uri]$eventArgs.Source))) {
            return
          }
          $requestJson = $eventArgs.WebMessageAsJson
          if ($requestJson -isnot [string] -or
              [Text.Encoding]::UTF8.GetByteCount($requestJson) -gt 4096) {
            return
          }
          $responseJson = Invoke-AuraSessionBoardDesktopClientRequest `
            -RequestJson $requestJson `
            -DataRoot $DataRoot
          if ($responseJson -is [string] -and
              [Text.Encoding]::UTF8.GetByteCount($responseJson) -le 262144) {
            $script:WorkHubWebView.CoreWebView2.PostWebMessageAsJson($responseJson)
          }
        } catch {}
      })
      $script:WorkHubConfigured = $true
    }
    if ($script:WorkHubConfigured -and -not $script:WorkHubNavigated) {
      $script:WorkHubNavigated = $true
      $script:WorkHubWebView.CoreWebView2.Navigate('https://aura.studio/work-hub.html')
    }
    [void](Send-AuraDesktopWorkHubPresentation `
      -State (Get-AuraDesktopWorkHubPresentationState))
  } catch {
    $form.Close()
  }
})

try {
  [void][ClaudeAuraDesktopWorkHubHost]::TryPlace(
    $form, $targetHandle, [uint32]$TargetProcessId)
  [Windows.Forms.Application]::Run($form)
} finally {
  $hostTimer.Stop()
  $hostTimer.Dispose()
  if ($null -ne $script:WorkHubWebView) { $script:WorkHubWebView.Dispose() }
  $form.Dispose()
  $closeEvent.Dispose()
  if ($createdNew) { try { $instanceMutex.ReleaseMutex() } catch {} }
  $instanceMutex.Dispose()
}
