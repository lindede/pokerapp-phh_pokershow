#Requires -Version 5.1
param(
  [string]$Origin = ""
)

$ErrorActionPreference = "Stop"
if (-not $Origin) {
  $local = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.development.local"
  if (Test-Path $local) {
    $line = Get-Content $local | Where-Object { $_ -match '^\s*VITE_API_ORIGIN\s*=\s*(.+)\s*$' } | Select-Object -First 1
    if ($line) {
      $Origin = ($line -replace '^\s*VITE_API_ORIGIN\s*=\s*', '').Trim()
    }
  }
}
if (-not $Origin) {
  Write-Host "[FAIL] VITE_API_ORIGIN not set. Run scripts\resolve-api-origin.bat first."
  exit 2
}

$url = ($Origin.TrimEnd('/')) + "/healthz"
Write-Host "Checking $url ..."
try {
  $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
  if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
    Write-Host "[OK] API reachable at $Origin"
    exit 0
  }
  Write-Host "[FAIL] HTTP $($resp.StatusCode) from $url"
  exit 1
} catch {
  Write-Host "[FAIL] Cannot reach $url"
  Write-Host "       Start: pokerapp-phh_analysis_service\scripts\start-api.bat"
  Write-Host "       Phone test: open $url in mobile browser (same WiFi)"
  exit 1
}
