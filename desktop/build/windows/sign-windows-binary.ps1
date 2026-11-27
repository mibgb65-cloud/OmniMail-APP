param(
  [Parameter(Mandatory = $true)]
  [string]$FilePath
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "待签名可执行文件不存在：$FilePath"
}
$resolvedTarget = (Resolve-Path -LiteralPath $FilePath).Path
$timestampUrl = "http://timestamp.digicert.com"

function Find-SignTool {
  $cmd = Get-Command signtool -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $found = Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter "signtool.exe" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($found) { return $found.FullName }
  return $null
}

$pfxB64 = "$env:WINDOWS_SIGN_PFX_BASE64".Trim()
$pfxPwd = "$env:WINDOWS_SIGN_PFX_PASSWORD"

if ($pfxB64 -ne "") {
  $tmpPfx = Join-Path $env:TEMP ("omnimail-sign-" + [guid]::NewGuid().ToString("N") + ".pfx")
  try {
    [System.IO.File]::WriteAllBytes($tmpPfx, [Convert]::FromBase64String($pfxB64))
    $signtool = Find-SignTool
    if ($signtool) {
      & $signtool sign /f $tmpPfx /p $pfxPwd /fd SHA256 /tr $timestampUrl /td SHA256 /d "OmniMail" $resolvedTarget | Out-Null
      if ($LASTEXITCODE -ne 0) {
        & $signtool sign /f $tmpPfx /p $pfxPwd /fd SHA256 /d "OmniMail" $resolvedTarget | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "signtool 数字签名失败：$resolvedTarget" }
      }
    } else {
      $flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable -bor `
               [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::PersistKeySet
      $cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($tmpPfx, $pfxPwd, $flags)
      $sig = Set-AuthenticodeSignature -FilePath $resolvedTarget -Certificate $cert -HashAlgorithm SHA256 -TimestampServer $timestampUrl
      if (-not $sig.SignerCertificate) {
        $sig = Set-AuthenticodeSignature -FilePath $resolvedTarget -Certificate $cert -HashAlgorithm SHA256
      }
    }
  } finally {
    if (Test-Path -LiteralPath $tmpPfx) { Remove-Item -LiteralPath $tmpPfx -Force }
  }
} else {
  $cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert -ErrorAction SilentlyContinue |
    Where-Object { $_.Subject -eq "CN=OmniMail" -and $_.NotAfter -gt (Get-Date) } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1
  if (-not $cert) {
    $cert = New-SelfSignedCertificate `
      -Type CodeSigningCert `
      -Subject "CN=OmniMail" `
      -FriendlyName "OmniMail Code Signing" `
      -KeyAlgorithm RSA `
      -KeyLength 3072 `
      -HashAlgorithm SHA256 `
      -KeyExportPolicy Exportable `
      -CertStoreLocation "Cert:\CurrentUser\My" `
      -NotAfter (Get-Date).AddYears(10)
  }
  $sig = Set-AuthenticodeSignature -FilePath $resolvedTarget -Certificate $cert -HashAlgorithm SHA256 -TimestampServer $timestampUrl
  if (-not $sig.SignerCertificate) {
    $sig = Set-AuthenticodeSignature -FilePath $resolvedTarget -Certificate $cert -HashAlgorithm SHA256
  }
}

$check = Get-AuthenticodeSignature -FilePath $resolvedTarget
if (-not $check.SignerCertificate -or $check.SignerCertificate.Subject -notmatch "CN=OmniMail") {
  throw "数字签名校验未通过（未检测到 CN=OmniMail 签名证书）：$resolvedTarget"
}
Write-Host "    [Authenticode] $(Split-Path -Leaf $resolvedTarget) -> $($check.SignerCertificate.Subject) ($($check.SignerCertificate.Thumbprint))" -ForegroundColor DarkGreen
