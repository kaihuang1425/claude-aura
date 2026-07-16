[CmdletBinding()]
param()

& (Join-Path $PSScriptRoot 'aura-ui.ps1') -Mode Restore
exit $LASTEXITCODE
