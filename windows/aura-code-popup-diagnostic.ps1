[CmdletBinding()]
param(
  [switch]$ClassifyOnly,
  [AllowEmptyString()][string]$CandidateUri,
  [switch]$UserInitiated
)

$ErrorActionPreference = 'Stop'

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

if ($ClassifyOnly) {
  Get-AuraCodePopupDisposition -Value $CandidateUri -IsUserInitiated ([bool]$UserInitiated)
  return
}
if ($PSBoundParameters.ContainsKey('CandidateUri') -or $UserInitiated) {
  throw 'Classifier arguments require -ClassifyOnly.'
}
throw 'The live Aura Code popup diagnostic is retired; only -ClassifyOnly is available.'
