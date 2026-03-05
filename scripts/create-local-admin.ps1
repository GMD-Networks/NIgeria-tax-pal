param(
  [string]$Base = "http://127.0.0.1:8106/api",
  [string]$Php = "C:\Users\samso\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe",
  [string]$Email = "admin_local@taxpal.test",
  [string]$Password = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $Password) {
  $bytes = New-Object byte[] 18
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $Password = [Convert]::ToBase64String($bytes)
}

# Register user
$reg = Invoke-WebRequest -UseBasicParsing -Uri "$Base/auth/register" -Method POST -ContentType 'application/json' -Body (@{email=$Email;password=$Password}|ConvertTo-Json -Compress) -TimeoutSec 20
$j = $reg.Content | ConvertFrom-Json
$uid = $j.data.user.id

# Promote to admin (local DB)
$tmp = Join-Path (Get-Location) 'tmp_promote_admin.php'
@'
<?php
require __DIR__ . '/php-api/config.php';
require __DIR__ . '/php-api/database.php';
$uid=$argv[1] ?? '';
$db=Database::getInstance();
$chk=$db->prepare("SELECT 1 FROM user_roles WHERE user_id=? AND role='admin' LIMIT 1");
$chk->execute([$uid]);
if(!$chk->fetch()){
  $id=sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0x0fff)|0x4000,mt_rand(0,0x3fff)|0x8000,mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
  $db->prepare("INSERT INTO user_roles (id,user_id,role) VALUES (?,?, 'admin')")->execute([$id,$uid]);
}
'@ | Set-Content -Path $tmp -Encoding UTF8
& $Php $tmp $uid | Out-Null
Remove-Item $tmp -Force

Write-Output "ADMIN_EMAIL=$Email"
Write-Output "ADMIN_PASSWORD=$Password"
Write-Output "ADMIN_USER_ID=$uid"
