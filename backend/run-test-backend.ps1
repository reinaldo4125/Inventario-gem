# Run backend in test environment (PowerShell)
$envFile = Join-Path $PSScriptRoot '.env.test'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -and $_ -match '^[^#]') {
      $parts = $_ -split '=',2
      if ($parts.Length -eq 2) { $name = $parts[0].Trim(); $value = $parts[1].Trim(); Set-Item -Path Env:\$name -Value $value }
    }
  }
} else {
  Write-Host "No .env.test found. Create one from .env.test.example or export vars manually." -ForegroundColor Yellow
}

npm --prefix $PSScriptRoot start
