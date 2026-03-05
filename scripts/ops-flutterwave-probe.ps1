param(
  [string]$Base = "http://127.0.0.1:8106/api"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Emit($name,$status,$note) {
  if ($null -eq $note) { $note = '' }
  $note = [string]$note
  if ($note.Length -gt 180) { $note = $note.Substring(0, 180) }
  Write-Output "$name|$status|$note"
}

function Read-ErrorBody($resp) {
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  return $reader.ReadToEnd()
}

$email = "ops_flw_$(Get-Random)@example.com"
$reg = Invoke-WebRequest -UseBasicParsing -Uri "$Base/auth/register" -Method POST -ContentType 'application/json' -Body (@{email=$email;password='Test12345!'}|ConvertTo-Json -Compress) -TimeoutSec 20
$j = $reg.Content | ConvertFrom-Json
$uid = $j.data.user.id
$token = $j.data.token
$h = @{ Authorization = "Bearer $token" }

# payments/initiate
try {
  $pi = Invoke-WebRequest -UseBasicParsing -Uri "$Base/payments/initiate" -Method POST -Headers $h -ContentType 'application/json' -Body (@{userId=$uid;email=$email;planTier='quarterly'}|ConvertTo-Json -Compress) -TimeoutSec 60
  $note = 'ok'
  try { $jj = $pi.Content | ConvertFrom-Json; if ($jj.data -and $jj.data.paymentLink) { $note = 'paymentLink=present' } } catch {}
  Emit 'payments.initiate' ([int]$pi.StatusCode) $note
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $txt = Read-ErrorBody $resp
    $note = $txt
    try {
      $je = $txt | ConvertFrom-Json
      if ($je.error) { $note = $je.error }
      elseif ($je.message) { $note = $je.message }
      if ($je.httpCode) { $note = "$note httpCode=$($je.httpCode)" }
    } catch {}
    Emit 'payments.initiate' ([int]$resp.StatusCode) $note
  } else {
    Emit 'payments.initiate' -1 $_.Exception.Message
  }
}

# payments/verify (dummy id)
try {
  $pv = Invoke-WebRequest -UseBasicParsing -Uri "$Base/payments/verify" -Method POST -Headers $h -ContentType 'application/json' -Body '{"transactionId":"123456"}' -TimeoutSec 60
  Emit 'payments.verify' ([int]$pv.StatusCode) 'ok'
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $txt = Read-ErrorBody $resp
    $note = $txt
    try {
      $je = $txt | ConvertFrom-Json
      if ($je.error) { $note = $je.error }
      elseif ($je.message) { $note = $je.message }
    } catch {}
    Emit 'payments.verify' ([int]$resp.StatusCode) $note
  } else {
    Emit 'payments.verify' -1 $_.Exception.Message
  }
}

# webhook no hash
try {
  $wh = Invoke-WebRequest -UseBasicParsing -Uri "$Base/payments/webhook" -Method POST -ContentType 'application/json' -Body (@{event='charge.completed';data=@{status='successful';tx_ref='x';id='1'}}|ConvertTo-Json -Compress) -TimeoutSec 20
  Emit 'payments.webhook.nohash' ([int]$wh.StatusCode) 'ok'
} catch {
  $resp = $_.Exception.Response
  if ($resp) {
    $txt = Read-ErrorBody $resp
    $note = $txt
    try { $je = $txt | ConvertFrom-Json; if ($je.error) { $note = $je.error } } catch {}
    Emit 'payments.webhook.nohash' ([int]$resp.StatusCode) $note
  } else {
    Emit 'payments.webhook.nohash' -1 $_.Exception.Message
  }
}
