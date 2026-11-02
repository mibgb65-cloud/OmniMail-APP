param([Parameter(Mandatory=$true)][string]$File)
$ErrorActionPreference='Stop'
if(-not $env:WINDOWS_SIGN_CERT_PFX_BASE64 -or -not $env:WINDOWS_SIGN_CERT_PASSWORD){throw '缺少 Windows 签名 Secret'}
if($env:WINDOWS_SIGN_CERT_PFX_BASE64.Length -gt 131072 -or $env:WINDOWS_SIGN_CERT_PASSWORD.Length -gt 4096){throw '签名材料长度异常'}
$target=(Resolve-Path -LiteralPath $File).Path
$innoTemporary=[IO.Path]::GetFileName($target) -in @('uninst.e32.tmp','uninst.e64.tmp')
if([IO.Path]::GetExtension($target) -ne '.exe' -and -not $innoTemporary){throw '只允许签名 exe 或 Inno 卸载器 PE 临时文件'}
# Inno 的卸载器签名前是 .tmp；按实际 PE 内容验证，不能仅依赖文件后缀。
$reader=[IO.BinaryReader]::new([IO.File]::Open($target,'Open','Read','Read'))
try{
 if($reader.BaseStream.Length -lt 64 -or $reader.ReadUInt16() -ne 0x5A4D){throw '签名目标不是 PE 可执行文件'}
 $reader.BaseStream.Position=0x3c
 $offset=$reader.ReadInt32()
 if($offset -lt 64 -or $offset -gt $reader.BaseStream.Length-24){throw '签名目标 PE 头越界'}
 $reader.BaseStream.Position=$offset
 if($reader.ReadUInt32() -ne 0x4550){throw '签名目标 PE 头无效'}
 $reader.BaseStream.Position=$offset+22
 if(($reader.ReadUInt16() -band 2) -eq 0){throw '签名目标缺少可执行标记'}
}finally{$reader.Dispose()}
$sdk=$null
if($env:OMNIMAIL_SIGNTOOL){
 $sdk=Get-Item -LiteralPath $env:OMNIMAIL_SIGNTOOL
 $toolSignature=Get-AuthenticodeSignature -LiteralPath $sdk.FullName
 if($toolSignature.Status -ne 'Valid' -or $toolSignature.SignerCertificate.Subject -notmatch '(^|,\s*)O=Microsoft Corporation(,|$)'){throw '指定的 signtool 缺少有效微软签名'}
}elseif(Test-Path -LiteralPath 'C:\Program Files (x86)\Windows Kits\10\bin'){
 $sdk=Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin' -Filter signtool.exe -Recurse |
  Where-Object {$_.FullName -match '\\x64\\signtool.exe$'} |Sort-Object FullName -Descending|Select-Object -First 1
}
if(-not $sdk){throw '未找到 Windows SDK signtool'}
$tempRoot=Join-Path ([IO.Path]::GetTempPath()) ('omnimail-sign-'+[guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $tempRoot)
# 临时 PFX 只授予当前身份；密码不放进 signtool 的命令行参数。
$identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
$acl=[Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true,$false)
$acl.SetOwner($identity)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
Set-Acl -LiteralPath $tempRoot -AclObject $acl
$pfx=Join-Path $tempRoot 'certificate.pfx'
$certificate=$null;$addedPersonal=$false
try{
 [IO.File]::WriteAllBytes($pfx,[Convert]::FromBase64String($env:WINDOWS_SIGN_CERT_PFX_BASE64))
 $bundle=[Security.Cryptography.X509Certificates.X509Certificate2Collection]::new()
 $bundle.Import($pfx,$env:WINDOWS_SIGN_CERT_PASSWORD,[Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet)
 if($bundle.Count -ne 1){
  foreach($item in $bundle){$item.Dispose()}
  throw 'PFX 只允许包含单个签名证书，不能捆绑导入其他证书'
 }
 $certificate=$bundle[0]
 if($certificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -ne 'OmniMail'){throw '签名证书名称必须为 OmniMail'}
 if(-not $certificate.HasPrivateKey -or $certificate.NotAfter -le [DateTime]::Now -or $certificate.NotBefore -gt [DateTime]::Now){throw '签名证书缺少私钥或不在有效期内'}
 $eku=$certificate.Extensions | Where-Object {$_.Oid.Value -eq '2.5.29.37'}
 if(-not $eku -or '1.3.6.1.5.5.7.3.3' -notin $eku.EnhancedKeyUsages.Value){throw '证书必须明确授权代码签名用途'}
 $personal=[Security.Cryptography.X509Certificates.X509Store]::new('My','CurrentUser');$personal.Open('ReadOnly')
 try{if($personal.Certificates.Find('FindByThumbprint',$certificate.Thumbprint,$false).Count -gt 0){throw '签名证书已在个人存储中；请使用隔离的签名环境'}}finally{$personal.Close()}
 $password=ConvertTo-SecureString $env:WINDOWS_SIGN_CERT_PASSWORD -AsPlainText -Force
 $addedPersonal=$true
 $imported=Import-PfxCertificate -FilePath $pfx -CertStoreLocation 'Cert:\CurrentUser\My' -Password $password
 if(-not $imported -or $imported.Thumbprint -ne $certificate.Thumbprint){throw '签名证书导入失败'}
 & $sdk.FullName sign /fd SHA256 /tr 'http://timestamp.digicert.com' /td SHA256 /s My /sha1 $certificate.Thumbprint $target
 if($LASTEXITCODE){throw 'Authenticode 签名失败'}
 if(-not ('OmniMail.ReleaseAuthenticode' -as [type])){Add-Type -Path (Join-Path $PSScriptRoot 'AuthenticodeVerifier.cs')}
 $trustResult=[OmniMail.ReleaseAuthenticode]::Verify($target)
 # 自签名本就不在公共根信任中；只接受精确 HRESULT，不吞掉其他签名或完整性错误。
 $untrustedRoot=[Convert]::ToUInt32('800B0109',16)
 $selfSigned=$certificate.SubjectName.RawData.Length -eq $certificate.IssuerName.RawData.Length -and
  [Convert]::ToBase64String($certificate.SubjectName.RawData) -ceq [Convert]::ToBase64String($certificate.IssuerName.RawData)
 if($trustResult -ne 0 -and -not($selfSigned -and $trustResult -eq $untrustedRoot)){
  throw ('Authenticode 文件验证失败：0x{0:X8}' -f $trustResult)
 }
 $signature=Get-AuthenticodeSignature -LiteralPath $target
 if($signature.Status -eq 'HashMismatch' -or $signature.Status -eq 'NotSigned'){throw '签名缺失或文件散列不匹配'}
 if(-not $signature.SignerCertificate -or $signature.SignerCertificate.Thumbprint -ne $certificate.Thumbprint){throw '签名证书不匹配'}
 if(-not $signature.TimeStamperCertificate){throw '签名缺少时间戳，停止打包'}
 if($trustResult -eq $untrustedRoot){Write-Output '自签名文件已核对身份及时间戳；Windows 不信任其根属预期，不导入根证书'}
}finally{
 $cleanupFailed=$false
 # 任一清理失败也继续其他清理，避免遗留私钥/PFX。
 foreach($cleanup in @(
  {if($addedPersonal -and $certificate){
   $personalPath="Cert:\CurrentUser\My\$($certificate.Thumbprint)"
   if(Test-Path -LiteralPath $personalPath){Remove-Item -LiteralPath $personalPath -DeleteKey}
  }},
  {if(Test-Path -LiteralPath $pfx){Remove-Item -LiteralPath $pfx}},
  {if($certificate){$certificate.Dispose()}},
  # 非递归，只移除本轮创建且已清空的临时目录。
  {if(Test-Path -LiteralPath $tempRoot){Remove-Item -LiteralPath $tempRoot}}
 )){
  try{& $cleanup}catch{$cleanupFailed=$true}
 }
 if($cleanupFailed){throw '签名临时材料清理失败，停止发布并检查隔离签名环境'}
}
