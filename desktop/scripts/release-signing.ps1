param(
    [Parameter(Mandatory=$true)][ValidateSet('Initialize','ConfigureGitHub','Package')][string]$Action,
    [ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version = '0.0.1'
)
$ErrorActionPreference = 'Stop'
$repository = 'mibgb65-cloud/OmniMail-APP'
$desktop = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$vault = Join-Path $env:LOCALAPPDATA 'OmniMail\release-signing\mibgb65-cloud-OmniMail-APP'
$metadataPath = Join-Path $vault 'metadata.json'
$receiptPath = Join-Path $vault 'github-receipt.json'
$entropy = [Text.Encoding]::UTF8.GetBytes('OmniMail.ReleaseSigning.v1')
$scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
$utf8 = [Text.UTF8Encoding]::new($false, $true)
$names = @('WINDOWS_SIGN_CERT_PFX_BASE64','WINDOWS_SIGN_CERT_PASSWORD','UPDATE_MANIFEST_PRIVATE_KEY','UPDATE_PUBLIC_KEY')

function Write-NewBytes([string]$Path, [byte[]]$Bytes) {
    $file = [IO.File]::Open($Path, 'CreateNew', 'Write', 'None')
    try { $file.Write($Bytes, 0, $Bytes.Length); $file.Flush($true) } finally { $file.Dispose() }
}

function Read-ProtectedBytes([string]$Name) {
    $path = Join-Path $vault $Name
    if ((Get-Item -LiteralPath $path).Length -gt 262144) { throw '加密材料大小异常' }
    return ,([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path), $entropy, $scope))
}

function Read-Metadata {
    $value = [IO.File]::ReadAllText($metadataPath, $utf8) | ConvertFrom-Json
    if ($value.schema -ne 1 -or $value.repository -cne $repository -or
        $value.publicKey -notmatch '^[A-Za-z0-9+/]{43}=$' -or $value.thumbprint -notmatch '^[0-9A-F]{40}$') {
        throw '签名材料元数据无效，不自动修复或轮换密钥'
    }
    return $value
}

function Initialize-Materials {
    if (Test-Path -LiteralPath $metadataPath) {
        $null = Read-Metadata
        Write-Output '已存在当前用户加密材料，保留并复用，不生成新身份'
        return
    }
    if (Test-Path -LiteralPath $vault) { throw '材料目录已有未完成内容，停止并人工恢复，不能覆盖' }
    [void](New-Item -ItemType Directory -Path $vault)
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $acl.SetOwner($identity)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    Set-Acl -LiteralPath $vault -AclObject $acl
    $rsa = [Security.Cryptography.RSA]::Create(3072)
    $certificate = $null
    $pfx = $null
    $plaintext = $null
    try {
        $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new(
            'CN=OmniMail', $rsa, [Security.Cryptography.HashAlgorithmName]::SHA256,
            [Security.Cryptography.RSASignaturePadding]::Pkcs1)
        $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false,$false,0,$true))
        $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new(
            [Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature,$true))
        $oids = [Security.Cryptography.OidCollection]::new()
        [void]$oids.Add([Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.3'))
        $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids,$true))
        $certificate = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5),[DateTimeOffset]::UtcNow.AddYears(3))
        $random = [byte[]]::new(48)
        [Security.Cryptography.RandomNumberGenerator]::Fill($random)
        $password = [Convert]::ToBase64String($random)
        [Array]::Clear($random, 0, $random.Length)
        $pfx = $certificate.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $password)
        $plaintext = $utf8.GetBytes((@{pfx=[Convert]::ToBase64String($pfx);password=$password} | ConvertTo-Json -Compress))
        Write-NewBytes (Join-Path $vault 'certificate.dpapi') ([Security.Cryptography.ProtectedData]::Protect($plaintext,$entropy,$scope))
        Push-Location $desktop
        try {
            $publicKey = (go run ./cmd/release-key --out (Join-Path $vault 'manifest-private.dpapi')).Trim()
            if ($LASTEXITCODE -or $publicKey -notmatch '^[A-Za-z0-9+/]{43}=$') { throw '更新密钥生成失败，保留已有加密材料供恢复' }
        } finally { Pop-Location }
        $metadata = @{
            schema=1;repository=$repository;thumbprint=$certificate.Thumbprint;publicKey=$publicKey
            createdAt=[DateTimeOffset]::UtcNow.ToString('o');expiresAt=$certificate.NotAfter.ToUniversalTime().ToString('o')
        }
        Write-NewBytes $metadataPath ($utf8.GetBytes(($metadata | ConvertTo-Json)))
        Write-Output "签名身份已生成并按当前 Windows 用户加密保存：$vault"
    } finally {
        if ($plaintext) { [Array]::Clear($plaintext,0,$plaintext.Length) }
        if ($pfx) { [Array]::Clear($pfx,0,$pfx.Length) }
        if ($certificate) { $certificate.Dispose() }
        $rsa.Dispose()
    }
}

function Read-Materials {
    $metadata = Read-Metadata
    $plaintext = Read-ProtectedBytes 'certificate.dpapi'
    $seed = Read-ProtectedBytes 'manifest-private.dpapi'
    try {
        $certificateData = $utf8.GetString($plaintext) | ConvertFrom-Json
        if ($seed.Length -ne 32 -or $certificateData.pfx.Length -gt 131072 -or
            $certificateData.password.Length -lt 32 -or $certificateData.password.Length -gt 4096) { throw '签名材料格式无效' }
        return @{
            WINDOWS_SIGN_CERT_PFX_BASE64=$certificateData.pfx
            WINDOWS_SIGN_CERT_PASSWORD=$certificateData.password
            UPDATE_MANIFEST_PRIVATE_KEY=[Convert]::ToBase64String($seed)
            UPDATE_PUBLIC_KEY=$metadata.publicKey
        }
    } finally {
        [Array]::Clear($plaintext,0,$plaintext.Length)
        [Array]::Clear($seed,0,$seed.Length)
    }
}

function Send-GitHubValue([string]$Kind, [string]$Name, [string]$Value) {
    $start = [Diagnostics.ProcessStartInfo]::new((Get-Command gh -ErrorAction Stop).Source)
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in @($Kind,'set',$Name,'--repo',$repository)) { $start.ArgumentList.Add($argument) }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        $output = $process.StandardOutput.ReadToEndAsync()
        $failure = $process.StandardError.ReadToEndAsync()
        # 敏感值只通过匿名标准输入传递，不出现在参数、历史、临时文件或日志中。
        $process.StandardInput.Write($Value)
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(90000)) { throw "GitHub 写入超时：$Name；请核对远端状态后恢复，禁止盲目重试" }
        $null = $output.GetAwaiter().GetResult()
        $null = $failure.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw "GitHub 配置失败：$Name；未回显底层诊断或密钥" }
    } finally { $process.Dispose() }
}

function Configure-GitHub {
    $metadata = Read-Metadata
    $materials = Read-Materials
    $remoteSecrets = gh api "repos/$repository/actions/secrets" --jq '.secrets[].name'
    if ($LASTEXITCODE) { throw '无法核对 GitHub Secrets，未发送任何新配置' }
    $remoteVariables = gh api "repos/$repository/actions/variables" --jq '.variables[].name'
    if ($LASTEXITCODE) { throw '无法核对 GitHub Variables，未发送任何新配置' }
    $completed = @()
    if (Test-Path -LiteralPath $receiptPath) {
        $receipt = [IO.File]::ReadAllText($receiptPath, $utf8) | ConvertFrom-Json
        if ($receipt.repository -cne $repository -or $receipt.thumbprint -cne $metadata.thumbprint -or
            $receipt.publicKey -cne $metadata.publicKey) { throw '既有上传回执不属于此身份，不能覆盖远端' }
        $completed = @($receipt.completed)
    }
    foreach ($name in $names) {
        if ($name -in $completed) { Write-Output "保留已成功配置项：$name"; continue }
        if ($name -in @($remoteSecrets) -or $name -in @($remoteVariables)) { throw "远端已有未知配置，停止覆盖：$name" }
        $kind = if ($name -eq 'UPDATE_PUBLIC_KEY') { 'variable' } else { 'secret' }
        Send-GitHubValue $kind $name $materials[$name]
        $completed += $name
        $receipt = @{repository=$repository;thumbprint=$metadata.thumbprint;publicKey=$metadata.publicKey;completed=$completed;updatedAt=[DateTimeOffset]::UtcNow.ToString('o')}
        [IO.File]::WriteAllText($receiptPath, ($receipt | ConvertTo-Json), $utf8)
        Write-Output "已配置 GitHub $kind：$name"
    }
    $materials.Clear()
}

function Package-Release {
    $materials = Read-Materials
    $saved = @{}
    $savedTool = $env:OMNIMAIL_SIGNTOOL
    foreach ($name in $names) { $saved[$name] = [Environment]::GetEnvironmentVariable($name) }
    try {
        if (-not $env:OMNIMAIL_SIGNTOOL -and -not (Test-Path -LiteralPath 'C:\Program Files (x86)\Windows Kits\10\bin')) {
            $tool = & (Join-Path $PSScriptRoot 'install-signing-tools.ps1')
            $env:OMNIMAIL_SIGNTOOL = @($tool)[-1]
        }
        foreach ($name in $names) {
            [Environment]::SetEnvironmentVariable($name,$materials[$name])
        }
        & (Join-Path $PSScriptRoot 'package-windows.ps1') -Version $Version `
            -NotesFile (Join-Path $desktop "docs\06-release\notes\v$Version.md")
    } finally {
        foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$saved[$name]) }
        $env:OMNIMAIL_SIGNTOOL = $savedTool
        $materials.Clear()
    }
}

if ([Environment]::OSVersion.Platform -ne 'Win32NT') { throw '签名材料保管仅支持 Windows 当前用户' }
switch ($Action) {
    'Initialize' { Initialize-Materials }
    'ConfigureGitHub' { Configure-GitHub }
    'Package' { Package-Release }
}
