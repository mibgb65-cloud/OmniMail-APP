param(
    [Parameter(Mandatory=$true)][string]$Package
)
$ErrorActionPreference = 'Stop'
$desktop = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$packagePath = (Resolve-Path -LiteralPath $Package).Path
if ([IO.Path]::GetFileName($packagePath) -notmatch '^OmniMail-\d+\.\d+\.\d+-dev-unsigned-windows-amd64-setup\.exe$') {
    throw '只允许隔离的未签名开发安装包，不能拿正式用户安装做冒烟测试'
}
$registryPath = 'HKCU:\Software\OmniMail-Development\Installation'
if (Test-Path -LiteralPath $registryPath) { throw '已有开发版安装，拒绝覆盖' }
$legacyUninstall = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{33D8613D-72FB-412E-9838-C694DF14655E}_is1'
if (Test-Path -LiteralPath $legacyUninstall) { throw '已有旧开发版安装，拒绝覆盖' }
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'OmniMail-Development.lnk'
$menuShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'OmniMail-Development.lnk'
if ((Test-Path -LiteralPath $desktopShortcut) -or (Test-Path -LiteralPath $menuShortcut)) { throw '已有开发版快捷方式，拒绝覆盖' }
$root = Join-Path $desktop ('.task\installer-smoke-' + [guid]::NewGuid().ToString('N'))
$app = Join-Path $root 'Program'
$data = Join-Path $root 'Data'
[void](New-Item -ItemType Directory -Path $root)

function Invoke-Installer([string[]]$Extra) {
    $arguments = @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-',"/DIR=`"$app`"") + $Extra
    $process = Start-Process -FilePath $packagePath -ArgumentList $arguments -WindowStyle Hidden -PassThru
    if (-not $process.WaitForExit(120000)) {
        throw '安装器超时，保留实例与日志供诊断；不得把超时当成成功'
    }
    return $process.ExitCode
}

$installed = $false
try {
    if ((Invoke-Installer @('/DATADIR=relative\invalid',"/LOG=`"$root\reject.log`"")) -eq 0) { throw '相对数据路径不应安装成功' }
    if (Test-Path -LiteralPath $registryPath) { throw '拒绝路径时不应写安装记录' }
    if ((Invoke-Installer @("/DATADIR=`"$app\Data`"", "/LOG=`"$root\overlap.log`"")) -eq 0) { throw '数据目录不能位于程序目录中' }
    if ((Invoke-Installer @("/DATADIR=`"$data`"",'/ALLOWC=1','/LANG=chinesesimp',"/LOG=`"$root\install.log`"")) -ne 0) {
        throw '首次当前用户安装失败'
    }
    $installed = $true
    $layout = Get-ItemProperty -LiteralPath $registryPath
    if ($layout.DataDir -ne $data -or $layout.InstallDir -ne $app -or $layout.Language -ne 'zh-CN') { throw '安装路径或语言未登记' }
    $runPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
    if (Test-Path -LiteralPath $runPath) {
        if ((Get-Item -LiteralPath $runPath).GetValue('OmniMail-Development')) { throw '安装不能默认注册登录自启' }
    }
    if (-not (Test-Path -LiteralPath $desktopShortcut)) { throw '默认桌面快捷方式未创建' }
    if (-not (Test-Path -LiteralPath (Join-Path $app 'OmniMail.exe'))) { throw '未安装主程序' }
    foreach ($name in @('OmniMail.exe','OmniMailUpdate.exe')) {
        $bytes = [IO.File]::ReadAllBytes((Join-Path $app $name))
        $offset = [BitConverter]::ToInt32($bytes, 0x3c)
        if ([BitConverter]::ToUInt32($bytes, $offset) -ne 0x4550 -or
            [BitConverter]::ToUInt16($bytes, $offset+4) -ne 0x8664) { throw '安装的程序不是 Windows x64 PE' }
    }
    $sentinel = Join-Path $data 'synthetic-retention-check.txt'
    [IO.File]::WriteAllText($sentinel, 'synthetic-data', [Text.UTF8Encoding]::new($false))
    if ((Invoke-Installer @('/DATADIR=relative\ignored-on-upgrade','/LANG=english',"/LOG=`"$root\upgrade.log`"")) -ne 0) { throw '保留原位置的覆盖升级失败' }
    $layout = Get-ItemProperty -LiteralPath $registryPath
    if ($layout.DataDir -ne $data -or $layout.Language -ne 'zh-CN' -or -not (Test-Path -LiteralPath $sentinel)) { throw '升级改变了数据位置、语言或数据' }
    try {
        Set-ItemProperty -LiteralPath $registryPath -Name DataDir -Value (Join-Path $root 'MissingData')
        if ((Invoke-Installer @("/LOG=`"$root\offline.log`"")) -eq 0) { throw '原数据目录失效时不能升级或回退' }
    } finally {
        Set-ItemProperty -LiteralPath $registryPath -Name DataDir -Value $data
    }
    try {
        Set-ItemProperty -LiteralPath $registryPath -Name Version -Value '65535.65535.65535'
        if ((Invoke-Installer @("/LOG=`"$root\downgrade.log`"")) -eq 0) { throw '不能降级覆盖' }
    } finally {
        Set-ItemProperty -LiteralPath $registryPath -Name Version -Value $layout.Version
    }
    Write-Output '当前用户隔离安装、相对/互含路径拒绝、原目录失效/降级拒绝、默认不自启、升级保留数据/语言：通过'
} finally {
    if ($installed) {
        # 只调用本轮已验证路径下的卸载器，不递归删除安装树/数据目录。
        $uninstaller = Join-Path $app 'unins000.exe'
        $process = Start-Process -FilePath $uninstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART') -WindowStyle Hidden -Wait -PassThru
        if ($process.ExitCode -ne 0) { throw '测试实例卸载失败，请保留日志人工检查' }
        if (Test-Path -LiteralPath $registryPath) { throw '测试安装记录未清除' }
        if ((Test-Path -LiteralPath $desktopShortcut) -or (Test-Path -LiteralPath $menuShortcut)) { throw '卸载未移除本轮快捷方式' }
        if (-not (Test-Path -LiteralPath (Join-Path $data 'synthetic-retention-check.txt'))) { throw '卸载删除了用户数据' }
        Write-Output "卸载保留合成数据：通过；日志保留在 $root"
    } elseif (Test-Path -LiteralPath $registryPath) {
        $layout = Get-ItemProperty -LiteralPath $registryPath
        if ($layout.InstallDir -eq $app) {
            $uninstaller = Join-Path $app 'unins000.exe'
            $process = Start-Process -FilePath $uninstaller -ArgumentList @('/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART') -WindowStyle Hidden -Wait -PassThru
            if ($process.ExitCode -ne 0) { throw '失败测试的隔离实例卸载失败' }
        }
    }
}
