param(
  [string]$Base = "http://127.0.0.1:8101/api",
  [string]$Php = "C:\Users\samso\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Emit($name,$status,$note){ "$name|$status|$note" }
function Req($name,$method,$path,$headers,$body,$timeout=30){
  try {
    $p=@{UseBasicParsing=$true;Uri="$Base$path";Method=$method;TimeoutSec=$timeout}
    if($headers){$p.Headers=$headers}
    if($null -ne $body){$p.ContentType='application/json';$p.Body=($body|ConvertTo-Json -Depth 10 -Compress)}
    $r=Invoke-WebRequest @p
    Emit $name ([int]$r.StatusCode) 'ok'
  } catch {
    $resp=$_.Exception.Response
    if($resp){
      $reader=New-Object System.IO.StreamReader($resp.GetResponseStream())
      $txt=$reader.ReadToEnd()
      $note=$txt
      try { $j=$txt|ConvertFrom-Json; if($j.error){$note=$j.error} } catch {}
      Emit $name ([int]$resp.StatusCode) ($note.Substring(0,[Math]::Min(120,$note.Length)))
    } else {
      Emit $name -1 $_.Exception.Message
    }
  }
}

$email="smoke_$(Get-Random)@example.com"
$reg=Invoke-WebRequest -UseBasicParsing -Uri "$Base/auth/register" -Method POST -ContentType 'application/json' -Body (@{email=$email;password='Test12345!'}|ConvertTo-Json -Compress) -TimeoutSec 20
$j=$reg.Content|ConvertFrom-Json
$uid=$j.data.user.id
$token=$j.data.token
$h=@{Authorization="Bearer $token"}

# Promote user to admin (local test only)
$f='tmp_promote_admin.php'
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
'@ | Set-Content -Path $f -Encoding UTF8
& $Php $f $uid | Out-Null
Remove-Item $f -Force

'MATRIX_START'
Emit 'auth.register' 201 'ok'
Req 'auth.login' 'POST' '/auth/login' $null @{email=$email;password='Test12345!'} 20
Req 'admin.users' 'POST' '/functions/admin-users' $h $null 60
Req 'payments.initiate' 'POST' '/payments/initiate' $h @{userId=$uid;email=$email;planTier='quarterly'} 60
Req 'payments.verify' 'POST' '/payments/verify' $h @{transactionId='123456'} 60
Req 'ai.tax_chat' 'POST' '/functions/tax-ai-chat' $h @{messages=@(@{role='user';content='VAT?'});messageCount=1} 60
Req 'ai.auto_tax_content' 'POST' '/functions/auto-tax-content' $h @{} 120
Req 'smtp.send_email' 'POST' '/functions/send-smtp-email' $h @{to='smoke@example.com';subject='smoke';html='<p>x</p>'} 60
'MATRIX_END'
