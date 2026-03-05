param(
  [int]$Port = 8101,
  [string]$Php = "C:\Users\samso\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe",
  [string]$EnvFile = "php-api/.env.local"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Php)) {
  throw "php.exe not found at: $Php"
}

if (Test-Path $EnvFile) {
  Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line.Split('=', 2)
    if ($parts.Count -ne 2) { return }
    $key = $parts[0].Trim()
    $val = $parts[1]
    if ($key) { Set-Item -Path "env:$key" -Value $val }
  }
}

if (-not $env:JWT_SECRET) {
  $bytes = New-Object byte[] 48
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $env:JWT_SECRET = [Convert]::ToBase64String($bytes)
}

Write-Output "Starting PHP API on http://127.0.0.1:$Port/api (env from $EnvFile)"
& $Php -S "127.0.0.1:$Port" -t php-api
