[CmdletBinding()]
param(
  [string]$Theme,
  [string]$Image,
  [switch]$ClearImage,
  [switch]$OpenStudio,
  [switch]$ExperimentalCodeStyle,
  [switch]$ExperimentalCodeStart
)

$auraArguments = @{ Mode = 'Open' }
if ($Theme) { $auraArguments.Theme = $Theme }
if ($Image) { $auraArguments.Image = [System.IO.Path]::GetFullPath($Image) }
if ($ClearImage) { $auraArguments.ClearImage = $true }
if ($OpenStudio) { $auraArguments.OpenStudio = $true }
if ($ExperimentalCodeStyle) { $auraArguments.ExperimentalCodeStyle = $true }
if ($ExperimentalCodeStart) { $auraArguments.ExperimentalCodeStart = $true }
& (Join-Path $PSScriptRoot 'aura-ui.ps1') @auraArguments
exit $LASTEXITCODE
