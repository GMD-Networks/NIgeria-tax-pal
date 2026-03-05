param(
  [string]$Base = "http://127.0.0.1:8106/api",
  [string]$Php = "C:\Users\samso\AppData\Local\Microsoft\WinGet\Packages\PHP.PHP.8.4_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Emit($name, $status, $note) {
  $note = [string]$note
  if ($note.Length -gt 180) { $note = $note.Substring(0, 180) }
  Write-Host "$name|$status|$note"
}

function ReadErr($resp) {
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  $reader.ReadToEnd()
}

function Call($name, $method, $path, $headers, $body, $timeout = 30) {
  try {
    $p = @{ UseBasicParsing = $true; Uri = "$Base$path"; Method = $method; TimeoutSec = $timeout }
    if ($headers) { $p.Headers = $headers }
    if ($null -ne $body) { $p.ContentType = 'application/json'; $p.Body = ($body | ConvertTo-Json -Depth 10 -Compress) }
    $r = Invoke-WebRequest @p
    Emit $name ([int]$r.StatusCode) 'ok'
    return $r
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $txt = ReadErr $resp
      $note = $txt
      try {
        $j = $txt | ConvertFrom-Json
        if ($j.error) { $note = $j.error }
        elseif ($j.message) { $note = $j.message }
      } catch {}
      Emit $name ([int]$resp.StatusCode) $note
    } else {
      Emit $name -1 $_.Exception.Message
    }
    return $null
  }
}

# Create normal user
$email = "thorough_$(Get-Random)@example.com"
$pw = "Test12345!"
$reg = Invoke-WebRequest -UseBasicParsing -Uri "$Base/auth/register" -Method POST -ContentType 'application/json' -Body (@{email=$email;password=$pw}|ConvertTo-Json -Compress) -TimeoutSec 20
$j = $reg.Content | ConvertFrom-Json
$uid = $j.data.user.id
$token = $j.data.token
$h = @{ Authorization = "Bearer $token" }
Emit 'auth.register' 201 'ok'

Call 'auth.login' 'POST' '/auth/login' $null @{email=$email;password=$pw} 20 | Out-Null
Call 'auth.me' 'GET' '/auth/me' $h $null 20 | Out-Null

# Data CRUD: invoice_templates
$template = @{ user_id=$uid; template_name='Smoke Template'; table_color='#228B22' }
$ins = Call 'data.invoice_templates.insert' 'POST' '/data/invoice_templates' $h $template 20
if ($ins -and $ins.Content) {
  $row = $ins.Content | ConvertFrom-Json
  $tid = $row.data.id
  Call 'data.invoice_templates.select' 'GET' "/data/invoice_templates?select=id,template_name&filter[id]=eq.$tid" $h $null 20 | Out-Null
  Call 'data.invoice_templates.delete' 'DELETE' "/data/invoice_templates?filter[id]=eq.$tid" $h $null 20 | Out-Null
}

# Chat session + message
Call 'data.chat_sessions.insert' 'POST' '/data/chat_sessions' $h @{session_id="session_$(Get-Random)"; user_id=$uid; status='open'; language='en'} 20 | Out-Null
Call 'data.chat_messages.insert' 'POST' '/data/chat_messages' $h @{session_id='session_test'; sender_type='user'; sender_id=$uid; content='hello'} 20 | Out-Null

# Push token upsert
Call 'data.user_push_tokens.upsert' 'POST' '/data/user_push_tokens' $h @{user_id=$uid; push_token='token_123'; platform='web'} 20 | Out-Null

# Usage check
Call 'usage.check.chat' 'GET' "/usage/$uid/chat/check" $h $null 20 | Out-Null

# Subscriptions
Call 'subscriptions.get' 'GET' "/subscriptions/$uid" $h $null 20 | Out-Null
Call 'subscriptions.create' 'POST' '/subscriptions' $h @{userId=$uid;transactionRef="TX-$(Get-Random)";planTier='quarterly'} 20 | Out-Null

# Payments
Call 'payments.initiate' 'POST' '/payments/initiate' $h @{userId=$uid;email=$email;planTier='quarterly'} 60 | Out-Null
Call 'payments.verify.dummy' 'POST' '/payments/verify' $h @{transactionId='123456'} 60 | Out-Null

# Webhook without hash
Call 'payments.webhook.nohash' 'POST' '/payments/webhook' $null @{event='charge.completed';data=@{status='successful';tx_ref='x';id='1'}} 20 | Out-Null

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

# Admin endpoints
Call 'admin.users' 'GET' '/functions/admin-users' $h $null 30 | Out-Null
Call 'admin.manage.grant_subscription' 'POST' '/functions/admin-manage-user' $h @{action='grant_subscription';user_id=$uid} 30 | Out-Null

# Branding config
Call 'branding.write' 'POST' '/functions/manage-api-config' $h @{type='branding';config_data=@{appName='TaxPal'}} 30 | Out-Null
Call 'branding.read' 'GET' '/functions/manage-api-config?type=branding' $h $null 30 | Out-Null

# SMTP send (should be ok if env SMTP configured)
Call 'smtp.send_email' 'POST' '/functions/send-smtp-email' $h @{to=$email;subject='Smoke';html='<p>x</p>'} 60 | Out-Null

# AI chat/content (may fail if provider balance insufficient)
Call 'ai.tax_chat.nonstream' 'POST' '/functions/tax-ai-chat' $h @{messages=@(@{role='user';content='VAT?'});messageCount=1;stream=$false} 60 | Out-Null
Call 'ai.auto_tax_content' 'POST' '/functions/auto-tax-content' $h @{} 120 | Out-Null
