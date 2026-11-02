param()
$ErrorActionPreference = 'Stop'
$desktop = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$packageScript = Join-Path $PSScriptRoot 'package-windows.ps1'
$signScript = Join-Path $PSScriptRoot 'sign-windows.ps1'

foreach ($script in @($packageScript, $signScript)) {
    $tokens = $null
    $parseErrors = $null
    [void][Management.Automation.Language.Parser]::ParseFile($script, [ref]$tokens, [ref]$parseErrors)
    if ($parseErrors) { throw '发布脚本语法检查失败' }
}

function Assert-Fails([scriptblock]$Action, [string]$Expected) {
    $failure = $null
    try { & $Action | Out-Null } catch { $failure = $_.Exception.Message }
    if (-not $failure -or $failure -notmatch $Expected) { throw '发布拒绝测试未按预期失败' }
}

# 只临时清空当前进程环境中的材料，测试后原样恢复；不打印或落盘 Secret 内容。
$names = @('WINDOWS_SIGN_CERT_PFX_BASE64','WINDOWS_SIGN_CERT_PASSWORD','UPDATE_MANIFEST_PRIVATE_KEY','UPDATE_PUBLIC_KEY')
$saved = @{}
try {
    foreach ($name in $names) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name)
        [Environment]::SetEnvironmentVariable($name, $null)
    }
    $notes = Join-Path $desktop 'docs\08-history\changelog.md'
    foreach ($name in $names) {
        Assert-Fails { & $packageScript -Version '0.1.0' -NotesFile $notes } ([regex]::Escape($name))
        # 逐项通过存在性门禁，但绝不进入真实签名或使用任意已有材料。
        [Environment]::SetEnvironmentVariable($name, 'synthetic-not-a-key')
    }
    Assert-Fails { & $signScript -File 'missing.exe' } 'Cannot find path|找不到'
    [Environment]::SetEnvironmentVariable('WINDOWS_SIGN_CERT_PFX_BASE64', $null)
    Assert-Fails { & $signScript -File 'missing.exe' } '缺少 Windows 签名'
    Assert-Fails { & $packageScript -Version '0.1.0' -NotesFile $notes -AllowUnsignedDevelopment -ISCC 'missing-iscc.exe' } '6\.7\.0'
    Write-Output '发布脚本语法、4 项材料缺失拒绝、签名缺失和编译器缺失拒绝：通过'
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
}
