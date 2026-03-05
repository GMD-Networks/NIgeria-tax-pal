param(
  [string]$Base = "http://127.0.0.1:8105/api",
  [string]$Php = "C:\Users\samso\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$email = "ops_smtp_$(Get-Random)@example.com"
$reg = Invoke-WebRequest -UseBasicParsing -Uri "$Base/auth/register" -Method POST -ContentType 'application/json' -Body (@{email=$email;password='Test12345!'}|ConvertTo-Json -Compress) -TimeoutSec 20
$j = $reg.Content | ConvertFrom-Json
$uid = $j.data.user.id
$token = $j.data.token
$h = @{ Authorization = "Bearer $token" }

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

try {
  $u = Invoke-WebRequest -UseBasicParsing -Uri "$Base/data/smtp_settings?filter[is_active]=eq.1" -Method PUT -Headers $h -ContentType 'application/json' -Body '{"is_active":0}' -TimeoutSec 20
  Write-Output "smtp_settings.deactivate|$([int]$u.StatusCode)"
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $txt = $reader.ReadToEnd()
    Write-Output "smtp_settings.deactivate|$([int]$resp.StatusCode)|$($txt.Substring(0,[Math]::Min(160,$txt.Length)))"
  } else {
    Write-Output "smtp_settings.deactivate|-1|$($_.Exception.Message)"
  }
}
