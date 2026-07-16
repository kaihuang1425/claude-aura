[CmdletBinding()]
param(
  [string]$Theme,
  [string]$Image,
  [switch]$ClearImage
)

$arguments = @('-Mode', 'Open')
if ($Theme) { $arguments += @('-Theme', $Theme) }
if ($Image) { $arguments += @('-Image', [System.IO.Path]::GetFullPath($Image)) }
if ($ClearImage) { $arguments += '-ClearImage' }
& (Join-Path $PSScriptRoot 'aura-ui.ps1') @arguments
exit $LASTEXITCODE
