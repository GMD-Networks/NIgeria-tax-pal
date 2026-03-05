param(
  [string]$Base = "http://127.0.0.1:8106/api"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$phpExe = (Get-Command php).Source

function Emit($name, $status, $note) {
  $note = [string]$note
  if ($note.Length -gt 200) { $note = $note.Substring(0, 200) }
  Write-Output "$name|$status|$note"
}

function ReadErr($resp) {
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  $reader.ReadToEnd()
}

function Call($name, $method, $path, $headers, $body, $timeout = 90) {
  try {
    $p = @{ UseBasicParsing = $true; Uri = "$Base$path"; Method = $method; TimeoutSec = $timeout }
    if ($headers) { $p.Headers = $headers }
    if ($null -ne $body) { $p.ContentType = 'application/json'; $p.Body = ($body | ConvertTo-Json -Depth 10 -Compress) }
    $r = Invoke-WebRequest @p
    Emit $name ([int]$r.StatusCode) 'ok'
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
  }
}

# Use a freshly registered user for auth
$email = "ai_probe_$(Get-Random)@example.com"
$pw = "Test12345!"
$ocrKey = ''
$ocrProvider = ''
$envFile = 'php-api/.env.local'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith('#')) { return }
    $parts = $line.Split('=', 2)
    if ($parts.Count -ne 2) { return }
    $key = $parts[0].Trim()
    $val = $parts[1].Trim()
    if ($key -eq 'OCR_AI_PROVIDER') { $ocrProvider = $val }
    if ($key -eq 'OCR_AI_API_KEY' -and $val) { $ocrKey = $val }
    if ($key -eq 'OPENROUTER_API_KEY' -and $val -and -not $ocrKey) { $ocrKey = $val }
    if ($key -eq 'GEMINI_API_KEY' -and $val -and -not $ocrKey) { $ocrKey = $val }
  }
}
try {
  $reg = Invoke-WebRequest -UseBasicParsing -Uri "$Base/auth/register" -Method POST -ContentType 'application/json' -Body (@{email=$email;password=$pw}|ConvertTo-Json -Compress) -TimeoutSec 20
  $j = $reg.Content | ConvertFrom-Json
  $token = $j.data.token
  $h = @{ Authorization = "Bearer $token" }
  Emit 'auth.register' 201 'ok'

  Call 'ai.tax_chat.nonstream' 'POST' '/functions/tax-ai-chat' $h @{messages=@(@{role='user';content='Hello'});messageCount=1;stream=$false} 90
  if ($ocrProvider -eq 'gemini' -and -not $ocrKey) {
    Emit 'ai.receipt_ocr' 0 'missing_ocr_key'
  } else {
    $img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
    try {
      $p = @{ UseBasicParsing = $true; Uri = "$Base/functions/receipt-ocr"; Method = 'POST'; TimeoutSec = 90; Headers = $h; ContentType = 'application/json'; Body = (@{image=$img} | ConvertTo-Json -Depth 10 -Compress) }
      $r = Invoke-WebRequest @p
      $note = 'ok'
      try {
        $jr = $r.Content | ConvertFrom-Json
        if ($jr.data.document_type) { $note = $jr.data.document_type }
        elseif ($jr.data.raw_text) { $note = $jr.data.raw_text }
      } catch {}
      Emit 'ai.receipt_ocr' ([int]$r.StatusCode) $note
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
        Emit 'ai.receipt_ocr' ([int]$resp.StatusCode) $note
      } else {
        Emit 'ai.receipt_ocr' -1 $_.Exception.Message
      }
    }
  }
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
  & $phpExe $tmp $j.data.user.id | Out-Null
  Remove-Item $tmp -Force
  Call 'ai.auto_tax_content' 'POST' '/functions/auto-tax-content' $h @{} 200
} catch {
  Emit 'ai.probe.fatal' -1 $_.Exception.Message
  throw
}
