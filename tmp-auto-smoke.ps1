$phpExe = (Get-Command php).Source
$conn = Get-NetTCPConnection -LocalPort 8101 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
  $conn | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
}
$job = Start-Job -ScriptBlock {
  param($exe)
  Set-Location 'd:\project\nigeria-tax-pal'
  & $exe -S 127.0.0.1:8101 -t php-api
} -ArgumentList $phpExe
Start-Sleep -Seconds 2

$base='http://127.0.0.1:8101/api'
$email = "smoke_auto_$(Get-Random)@example.com"
$pw = 'Test12345!'

$regBody = @{ email=$email; password=$pw } | ConvertTo-Json -Compress
$reg = Invoke-WebRequest -UseBasicParsing -Uri "$base/auth/register" -Method POST -ContentType 'application/json' -Body $regBody -TimeoutSec 20
$regJson = $reg.Content | ConvertFrom-Json
$uid = $regJson.data.user.id
$token = $regJson.data.token
$h = @{ Authorization = "Bearer $token" }

$tmp = 'tmp_promote_admin.php'
@"
<?php
require __DIR__ . '/php-api/config.php';
require __DIR__ . '/php-api/database.php';
$uid = $argv[1] ?? '';
$db = Database::getInstance();
$chk = $db->prepare("SELECT 1 FROM user_roles WHERE user_id=? AND role='admin' LIMIT 1");
$chk->execute([$uid]);
if(!$chk->fetch()){
  $id=sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0x0fff)|0x4000,mt_rand(0,0x3fff)|0x8000,mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
  $db->prepare("INSERT INTO user_roles (id,user_id,role) VALUES (?,?, 'admin')")->execute([$id,$uid]);
}
"@ | Set-Content -Path $tmp -Encoding UTF8
& $phpExe $tmp $uid | Out-Null
Remove-Item $tmp -Force

$aiKey = ''
$envFile = 'php-api/.env.local'
if (Test-Path $envFile) {
  $line = Get-Content $envFile | Where-Object { $_ -match '^AI_API_KEY=' } | Select-Object -First 1
  if ($line) { $aiKey = ($line -split '=',2)[1].Trim() }
}

$configBody = @{ type='ai'; config_data=@{ provider='deepseek'; api_key=$aiKey; api_url='https://api.deepseek.com/v1/chat/completions'; model='deepseek-chat'; max_tokens=4096 }; is_active=$true } | ConvertTo-Json -Depth 6 -Compress
Invoke-WebRequest -UseBasicParsing -Uri "$base/functions/manage-api-config" -Method POST -Headers $h -ContentType 'application/json' -Body $configBody -TimeoutSec 20 | Out-Null

try {
  $gen = Invoke-WebRequest -UseBasicParsing -Uri "$base/functions/auto-tax-content" -Method POST -Headers $h -ContentType 'application/json' -Body '{}' -TimeoutSec 180
  Write-Output ('AUTO_TAX_STATUS: ' + [int]$gen.StatusCode)
  Write-Output ('AUTO_TAX_BODY: ' + $gen.Content)
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    Write-Output ('AUTO_TAX_ERR_STATUS: ' + [int]$resp.StatusCode)
    Write-Output ('AUTO_TAX_ERR_BODY: ' + $reader.ReadToEnd())
  } else {
    Write-Output ('AUTO_TAX_ERR: ' + $_.Exception.Message)
  }
}

Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue
