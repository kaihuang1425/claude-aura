[CmdletBinding()]
param(
  [ValidateSet('Child', 'Main')][string]$RouteMode = 'Main',
  [switch]$ClassifyOnly,
  [AllowEmptyString()][string]$CandidateUri,
  [switch]$UserInitiated
)

$ErrorActionPreference = 'Stop'
$script:RouteMode = $RouteMode

function Get-AuraCodeDiagnosticSurface {
  param([AllowNull()][object]$Value)

  try {
    $uri = if ($Value -is [Uri]) { $Value } else { [Uri]"$Value" }
    if (-not $uri.IsAbsoluteUri -or $uri.Scheme -cne 'https' -or
        $uri.UserInfo -or $uri.Host -ine 'claude.ai' -or $uri.Port -ne 443) {
      return 'other'
    }
    $path = $uri.AbsolutePath
    if ($path -ieq '/code' -or $path.StartsWith('/code/', [StringComparison]::OrdinalIgnoreCase)) {
      return 'code'
    }
    if ($path -ieq '/' -or $path -ieq '/new' -or
        $path.StartsWith('/chat/', [StringComparison]::OrdinalIgnoreCase)) {
      return 'chat'
    }
  } catch {}
  return 'other'
}

function Get-AuraCodePopupDisposition {
  param(
    [AllowNull()][object]$Value,
    [bool]$IsUserInitiated
  )

  try {
    $raw = if ($Value -is [Uri]) { $Value.OriginalString } else { "$Value" }
    $uri = if ($Value -is [Uri]) { $Value } else { [Uri]$raw }
    if (-not $uri.IsAbsoluteUri -or $uri.Scheme -cne 'https' -or $uri.UserInfo) {
      return 'Block'
    }

    $uriHost = $uri.Host.ToLowerInvariant()
    $isClaude = $uriHost -eq 'claude.ai' -or $uriHost.EndsWith('.claude.ai') -or
      $uriHost -eq 'claude.com' -or $uriHost.EndsWith('.claude.com')
    $isSignIn = $uriHost -eq 'anthropic.com' -or $uriHost.EndsWith('.anthropic.com') -or
      $uriHost -eq 'accounts.google.com' -or $uriHost.EndsWith('.accounts.google.com') -or
      $uriHost -eq 'appleid.apple.com' -or $uriHost -eq 'login.microsoftonline.com'
    $isExactCode = $IsUserInitiated -and $uri.Port -eq 443 -and
      [regex]::IsMatch(
        $raw,
        '\Ahttps://claude[.]ai(?::443)?/code/?\z',
        [Text.RegularExpressions.RegexOptions]::IgnoreCase)

    if ($isExactCode) { return 'CodeChild' }
    if ($isClaude -or $isSignIn) { return 'NativePopup' }
    if ($IsUserInitiated) { return 'External' }
  } catch {}
  return 'Block'
}

function Test-AuraCodeDiagnosticHostRunning {
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

if ($ClassifyOnly) {
  Get-AuraCodePopupDisposition -Value $CandidateUri -IsUserInitiated ([bool]$UserInitiated)
  return
}
if ($PSBoundParameters.ContainsKey('CandidateUri') -or $UserInitiated) {
  throw 'Classifier arguments require -ClassifyOnly.'
}
throw 'The live Aura Code popup diagnostic is retired; only -ClassifyOnly is available.'
if ([Threading.Thread]::CurrentThread.GetApartmentState() -ne
    [Threading.ApartmentState]::STA) {
  throw 'Run the Aura Code popup diagnostic in an STA Windows PowerShell process.'
}
if (Test-AuraCodeDiagnosticHostRunning) {
  throw 'Close Claude Aura normally before starting the Aura Code popup diagnostic.'
}

$Root = Split-Path $PSScriptRoot -Parent
$VendorRoot = Join-Path $Root 'vendor\webview2'
$WebDataRoot = Join-Path $env:LOCALAPPDATA 'ClaudeAura\webview'
$architecture = [Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture.ToString().ToLowerInvariant()
if ($architecture -notin @('x64', 'x86', 'arm64')) { $architecture = 'x64' }
$loaderRoot = Join-Path $VendorRoot "runtimes\$architecture"
$coreDll = Join-Path $VendorRoot 'Microsoft.Web.WebView2.Core.dll'
$formsDll = Join-Path $VendorRoot 'Microsoft.Web.WebView2.WinForms.dll'
$loaderDll = Join-Path $loaderRoot 'WebView2Loader.dll'
foreach ($required in @($coreDll, $formsDll, $loaderDll)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw 'A required WebView2 component is unavailable.'
  }
}

$env:PATH = "$loaderRoot;$VendorRoot;$env:PATH"
[void][Reflection.Assembly]::LoadFrom($coreDll)
[void][Reflection.Assembly]::LoadFrom($formsDll)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:EnvironmentTask = $null
$script:Environment = $null
$script:ChildEnsureTask = $null
$script:MainEnsureTask = $null
$script:ChildAvailable = $false
$script:MainSurface = 'other'
$script:ChildSurface = 'other'
$script:CodeRouteAccepted = $false

$script:MainForm = [System.Windows.Forms.Form]::new()
$script:MainForm.Text = 'Aura Code popup diagnostic'
$script:MainForm.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$script:MainForm.ClientSize = [Drawing.Size]::new(900, 660)
$script:MainForm.MinimumSize = [Drawing.Size]::new(720, 500)
$script:MainForm.Location = [Drawing.Point]::new(40, 60)

$script:MainStatus = [System.Windows.Forms.Label]::new()
$script:MainStatus.Dock = [System.Windows.Forms.DockStyle]::Fill
$script:MainStatus.TextAlign = [Drawing.ContentAlignment]::MiddleLeft
$script:MainStatus.Padding = [System.Windows.Forms.Padding]::new(10, 0, 0, 0)
$script:MainStatus.Text = 'event=main-navigation surface=other http=0 outcome=pending'

$script:MainChatButton = [System.Windows.Forms.Button]::new()
$script:MainChatButton.Dock = [System.Windows.Forms.DockStyle]::Right
$script:MainChatButton.Width = 132
$script:MainChatButton.Text = 'Return to Chat'
$script:MainChatButton.Visible = $script:RouteMode -ceq 'Main'
$script:MainChatButton.Enabled = $false

$script:MainHeader = [System.Windows.Forms.Panel]::new()
$script:MainHeader.Dock = [System.Windows.Forms.DockStyle]::Top
$script:MainHeader.Height = 36
$script:MainHeader.Controls.Add($script:MainStatus)
$script:MainHeader.Controls.Add($script:MainChatButton)

$script:MainWebView = [Microsoft.Web.WebView2.WinForms.WebView2]::new()
$script:MainWebView.Dock = [System.Windows.Forms.DockStyle]::Fill
$script:MainForm.Controls.Add($script:MainWebView)
$script:MainForm.Controls.Add($script:MainHeader)

$script:ChildForm = $null
$script:ChildStatus = $null
$script:ChildWebView = $null
if ($script:RouteMode -ceq 'Child') {
  $script:ChildForm = [System.Windows.Forms.Form]::new()
  $script:ChildForm.Text = 'Aura Code diagnostic child'
  $script:ChildForm.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
  $script:ChildForm.ClientSize = [Drawing.Size]::new(900, 660)
  $script:ChildForm.MinimumSize = [Drawing.Size]::new(720, 500)
  $script:ChildForm.Location = [Drawing.Point]::new(120, 120)

  $script:ChildStatus = [System.Windows.Forms.Label]::new()
  $script:ChildStatus.Dock = [System.Windows.Forms.DockStyle]::Top
  $script:ChildStatus.Height = 34
  $script:ChildStatus.TextAlign = [Drawing.ContentAlignment]::MiddleLeft
  $script:ChildStatus.Padding = [System.Windows.Forms.Padding]::new(10, 0, 0, 0)
  $script:ChildStatus.Text = 'event=popup-request surface=other http=0 outcome=pending'

  $script:ChildWebView = [Microsoft.Web.WebView2.WinForms.WebView2]::new()
  $script:ChildWebView.Dock = [System.Windows.Forms.DockStyle]::Fill
  $script:ChildForm.Controls.Add($script:ChildWebView)
  $script:ChildForm.Controls.Add($script:ChildStatus)
}

function Set-AuraCodeDiagnosticStatus {
  param(
    [ValidateSet('Main', 'Child')][string]$Target,
    [ValidateSet('main-navigation', 'popup-request')][string]$Event,
    [ValidateSet('chat', 'code', 'other')][string]$Surface,
    [ValidateRange(0, 599)][int]$HttpStatus,
    [ValidateSet('pending', 'assigned', 'native', 'blocked', 'failed', 'succeeded')]
    [string]$Outcome
  )

  $text = 'event={0} surface={1} http={2} outcome={3}' -f
    $Event, $Surface, $HttpStatus, $Outcome
  $label = if ($Target -ceq 'Main') { $script:MainStatus } else { $script:ChildStatus }
  if ($null -ne $label -and -not $label.IsDisposed) { $label.Text = $text }
}

$script:Timer = [System.Windows.Forms.Timer]::new()
$script:Timer.Interval = 50
$script:Timer.add_Tick({
  try {
    if ($null -ne $script:EnvironmentTask -and $script:EnvironmentTask.IsCompleted) {
      $task = $script:EnvironmentTask
      $script:EnvironmentTask = $null
      $script:Environment = $task.GetAwaiter().GetResult()
      if ($script:RouteMode -ceq 'Child') {
        $script:ChildEnsureTask =
          $script:ChildWebView.EnsureCoreWebView2Async($script:Environment)
      } else {
        $script:MainEnsureTask =
          $script:MainWebView.EnsureCoreWebView2Async($script:Environment)
      }
    }

    if ($null -ne $script:ChildEnsureTask -and $script:ChildEnsureTask.IsCompleted) {
      $task = $script:ChildEnsureTask
      $script:ChildEnsureTask = $null
      [void]$task.GetAwaiter().GetResult()
      $script:MainEnsureTask =
        $script:MainWebView.EnsureCoreWebView2Async($script:Environment)
    }

    if ($null -ne $script:MainEnsureTask -and $script:MainEnsureTask.IsCompleted) {
      $task = $script:MainEnsureTask
      $script:MainEnsureTask = $null
      [void]$task.GetAwaiter().GetResult()
      $mainCore = $script:MainWebView.CoreWebView2
      if ($script:RouteMode -ceq 'Child') {
        $childCore = $script:ChildWebView.CoreWebView2
        $sameProfile = [string]::Equals(
            $mainCore.Profile.ProfileName,
            $childCore.Profile.ProfileName,
            [StringComparison]::Ordinal) -and
          $mainCore.Profile.IsInPrivateModeEnabled -eq $childCore.Profile.IsInPrivateModeEnabled
        if (-not $sameProfile) {
          $script:Timer.Stop()
          Set-AuraCodeDiagnosticStatus -Target Main -Event main-navigation `
            -Surface other -HttpStatus 0 -Outcome failed
          Set-AuraCodeDiagnosticStatus -Target Child -Event popup-request `
            -Surface other -HttpStatus 0 -Outcome failed
          return
        }

        $childCore.add_NavigationStarting({
          param($sender, $eventArgs)
          $script:ChildSurface = Get-AuraCodeDiagnosticSurface -Value $eventArgs.Uri
          Set-AuraCodeDiagnosticStatus -Target Child -Event popup-request `
            -Surface $script:ChildSurface -HttpStatus 0 -Outcome pending
        })
        $childCore.add_NavigationCompleted({
          param($sender, $eventArgs)
          $status = [Math]::Max(0, [Math]::Min(599, [int]$eventArgs.HttpStatusCode))
          $outcome = if ($eventArgs.IsSuccess) { 'succeeded' } else { 'failed' }
          Set-AuraCodeDiagnosticStatus -Target Child -Event popup-request `
            -Surface $script:ChildSurface -HttpStatus $status -Outcome $outcome
        })
        $childCore.add_WindowCloseRequested({
          if ($null -ne $script:ChildForm -and -not $script:ChildForm.IsDisposed) {
            $script:ChildForm.Close()
          }
        })
      }

      $mainCore.add_NavigationStarting({
        param($sender, $eventArgs)
        $script:MainSurface = Get-AuraCodeDiagnosticSurface -Value $eventArgs.Uri
        if ($null -ne $script:MainChatButton -and -not $script:MainChatButton.IsDisposed) {
          $script:MainChatButton.Enabled =
            $script:RouteMode -ceq 'Main' -and $script:CodeRouteAccepted
        }
        Set-AuraCodeDiagnosticStatus -Target Main -Event main-navigation `
          -Surface $script:MainSurface -HttpStatus 0 -Outcome pending
      })
      $mainCore.add_NavigationCompleted({
        param($sender, $eventArgs)
        $status = [Math]::Max(0, [Math]::Min(599, [int]$eventArgs.HttpStatusCode))
        $outcome = if ($eventArgs.IsSuccess) { 'succeeded' } else { 'failed' }
        Set-AuraCodeDiagnosticStatus -Target Main -Event main-navigation `
          -Surface $script:MainSurface -HttpStatus $status -Outcome $outcome
      })
      $script:MainChatButton.add_Click({
        if ($script:RouteMode -cne 'Main' -or -not $script:CodeRouteAccepted -or
            $null -eq $script:MainWebView.CoreWebView2) {
          return
        }
        $script:MainChatButton.Enabled = $false
        try {
          $script:MainWebView.CoreWebView2.Navigate('https://claude.ai/new')
          $script:CodeRouteAccepted = $false
          $script:MainChatButton.Enabled = $false
        } catch {
          $script:CodeRouteAccepted = $true
          $script:MainChatButton.Enabled = $true
          Set-AuraCodeDiagnosticStatus -Target Main -Event main-navigation `
            -Surface code -HttpStatus 0 -Outcome failed
        }
      })
      $mainCore.add_NewWindowRequested({
        param($sender, $eventArgs)
        $surface = Get-AuraCodeDiagnosticSurface -Value $eventArgs.Uri
        $disposition = Get-AuraCodePopupDisposition `
          -Value $eventArgs.Uri `
          -IsUserInitiated ([bool]$eventArgs.IsUserInitiated)

        if ($disposition -eq 'CodeChild') {
          if ($script:RouteMode -ceq 'Main') {
            $script:CodeRouteAccepted = $true
            try {
              $script:MainWebView.CoreWebView2.Navigate('https://claude.ai/code')
              $eventArgs.Handled = $true
              Set-AuraCodeDiagnosticStatus -Target Main -Event popup-request `
                -Surface code -HttpStatus 0 -Outcome assigned
            } catch {
              $script:CodeRouteAccepted = $false
              $script:MainChatButton.Enabled = $false
              Set-AuraCodeDiagnosticStatus -Target Main -Event popup-request `
                -Surface code -HttpStatus 0 -Outcome failed
            }
            return
          }
          if ($script:ChildAvailable -and
              $null -ne $script:ChildWebView.CoreWebView2 -and
              -not $script:ChildForm.IsDisposed -and
              $script:ChildForm.Visible) {
            try {
              $eventArgs.NewWindow = $script:ChildWebView.CoreWebView2
              $script:ChildAvailable = $false
              Set-AuraCodeDiagnosticStatus -Target Child -Event popup-request `
                -Surface code -HttpStatus 0 -Outcome assigned
              $script:ChildForm.Activate()
              return
            } catch {
              Set-AuraCodeDiagnosticStatus -Target Main -Event popup-request `
                -Surface code -HttpStatus 0 -Outcome failed
              return
            }
          }
          Set-AuraCodeDiagnosticStatus -Target Main -Event popup-request `
            -Surface code -HttpStatus 0 -Outcome native
          return
        }
        if ($disposition -eq 'NativePopup') {
          Set-AuraCodeDiagnosticStatus -Target Main -Event popup-request `
            -Surface $surface -HttpStatus 0 -Outcome native
          return
        }

        $eventArgs.Handled = $true
        if ($disposition -eq 'External') {
          try {
            $target = [Uri]$eventArgs.Uri
            Start-Process -FilePath $target.AbsoluteUri | Out-Null
            Set-AuraCodeDiagnosticStatus -Target Main -Event popup-request `
              -Surface other -HttpStatus 0 -Outcome succeeded
          } catch {
            Set-AuraCodeDiagnosticStatus -Target Main -Event popup-request `
              -Surface other -HttpStatus 0 -Outcome blocked
          }
          return
        }
        Set-AuraCodeDiagnosticStatus -Target Main -Event popup-request `
          -Surface other -HttpStatus 0 -Outcome blocked
      })

      $script:ChildAvailable = $script:RouteMode -ceq 'Child'
      $mainCore.Navigate('https://claude.ai/')
      $script:Timer.Stop()
    }
  } catch {
    $script:Timer.Stop()
    Set-AuraCodeDiagnosticStatus -Target Main -Event main-navigation `
      -Surface other -HttpStatus 0 -Outcome failed
    Set-AuraCodeDiagnosticStatus -Target Child -Event popup-request `
      -Surface other -HttpStatus 0 -Outcome failed
  }
})

if ($null -ne $script:ChildForm) {
  $script:ChildForm.add_FormClosed({ $script:ChildAvailable = $false })
}
$script:MainForm.add_Shown({
  try {
    [void]$script:MainForm.Handle
    [void]$script:MainWebView.Handle
    $surfacesReady = $script:MainForm.Visible -and
      $script:MainForm.IsHandleCreated -and $script:MainWebView.IsHandleCreated -and
      $script:MainForm.Handle -ne [IntPtr]::Zero -and
      $script:MainWebView.Handle -ne [IntPtr]::Zero
    if ($script:RouteMode -ceq 'Child') {
      $script:ChildForm.Show($script:MainForm)
      [void]$script:ChildForm.Handle
      [void]$script:ChildWebView.Handle
      $surfacesReady = $surfacesReady -and $script:ChildForm.Visible -and
        $script:ChildForm.IsHandleCreated -and $script:ChildWebView.IsHandleCreated -and
        $script:ChildForm.Handle -ne [IntPtr]::Zero -and
        $script:ChildWebView.Handle -ne [IntPtr]::Zero
    }
    if (-not $surfacesReady) {
      throw 'The visible diagnostic surfaces are unavailable.'
    }
    $script:EnvironmentTask =
      [Microsoft.Web.WebView2.Core.CoreWebView2Environment]::CreateAsync(
        $null,
        $WebDataRoot,
        $null)
    $script:Timer.Start()
  } catch {
    Set-AuraCodeDiagnosticStatus -Target Main -Event main-navigation `
      -Surface other -HttpStatus 0 -Outcome failed
    Set-AuraCodeDiagnosticStatus -Target Child -Event popup-request `
      -Surface other -HttpStatus 0 -Outcome failed
  }
})
$script:MainForm.add_FormClosed({
  $script:Timer.Stop()
  if ($null -ne $script:ChildForm -and -not $script:ChildForm.IsDisposed) {
    $script:ChildForm.Close()
  }
})

try {
  [System.Windows.Forms.Application]::Run($script:MainForm)
} finally {
  $script:Timer.Dispose()
  $script:MainWebView.Dispose()
  $script:MainForm.Dispose()
  if ($null -ne $script:ChildWebView) { $script:ChildWebView.Dispose() }
  if ($null -ne $script:ChildForm) { $script:ChildForm.Dispose() }
}
