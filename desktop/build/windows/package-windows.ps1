param(
  [string]$Version = "v0.0.1",
  [string]$ReleaseRepo = "mibgb65-cloud/OmniMail-APP"
)

$ErrorActionPreference = "Stop"

$Version = $Version.Trim()
$stableRegex = '^v(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)$'
$betaRegex   = '^v(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)[.-]beta\.(?<pre>[1-9]\d*)$'
$alphaRegex  = '^v(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)[.-]alpha\.(?<pre>[1-9]\d*)$'

if ($Version -match $stableRegex) {
  $channel = "stable"
  $maj = [int]$Matches.major
  $min = [int]$Matches.minor
  $pat = [int]$Matches.patch
  $rev = 0
  $pkgVer = "v$maj.$min.$pat"
} elseif ($Version -match $betaRegex) {
  $channel = "beta"
  $maj = [int]$Matches.major
  $min = [int]$Matches.minor
  $pat = [int]$Matches.patch
  $rev = [int]$Matches.pre
  $pkgVer = "v$maj.$min.$pat.beta.$rev"
} elseif ($Version -match $alphaRegex) {
  $channel = "alpha"
  $maj = [int]$Matches.major
  $min = [int]$Matches.minor
  $pat = [int]$Matches.patch
  $rev = [int]$Matches.pre
  $pkgVer = "v$maj.$min.$pat.alpha.$rev"
} else {
  throw "非法版本号格式 '$Version'。支持三轨格式：正式版 vX.Y.Z（如 v0.0.1）、测试版 vX.Y.Z-beta.N（如 v1.2.0-beta.1）或本地开发版 vX.Y.Z-alpha.N（如 v1.2.0-alpha.1）。"
}

foreach ($seg in @($maj, $min, $pat, $rev)) {
  if ($seg -lt 0 -or $seg -gt 65535) {
    throw "版本号段值 '$seg' 超出 Windows PE / NSIS 四段数字范围 (0..65535)。"
  }
}

$fileVersion = "$maj.$min.$pat.$rev"
$buildTime = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopDir = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$repoRoot = (Resolve-Path (Join-Path $desktopDir "..")).Path
$releaseDir = Join-Path $repoRoot "dist\release\$Version"
$stageBinDir = Join-Path $desktopDir "bin\.stage-$Version"
$licenseFile = Join-Path $repoRoot "LICENSE"
if (-not (Test-Path $licenseFile)) {
  throw "仓库根目录缺少 LICENSE 开源许可协议文件：$licenseFile"
}

Write-Host "==> 发布构建元数据：Version=$Version | PackageVer=$pkgVer | Channel=$channel | FileVersion=$fileVersion | OutDir=$releaseDir" -ForegroundColor Magenta

$tempInfoJson = Join-Path $desktopDir "build\windows\.info.generated.json"
$sysoOut = Join-Path $desktopDir "omnimail_windows_amd64.syso"
$exeOut = Join-Path $stageBinDir "OmniMail.exe"

try {
  Push-Location $desktopDir
  try {
    Write-Host "==> [1/5] 生成 Wails TypeScript 绑定..." -ForegroundColor Cyan
    wails3 generate bindings -ts -i -f "-tags=bindings" .
    if ($LASTEXITCODE -ne 0) { throw "Wails 绑定生成失败" }

    Write-Host "==> [2/5] 执行前端 TypeScript 校验与生产压缩构建..." -ForegroundColor Cyan
    pnpm --dir frontend build
    if ($LASTEXITCODE -ne 0) { throw "前端生产构建失败" }

    Write-Host "==> [3/5] 生成动态 PE 版本描述与多尺寸图标资源 (.syso)..." -ForegroundColor Cyan
    $icoPath = Join-Path $desktopDir "build\windows\icon.ico"
    $pngPath = Join-Path $desktopDir "build\appicon.png"
    if (-not (Test-Path $icoPath)) {
      wails3 generate icons -input $pngPath -windowsfilename $icoPath -sizes "256,128,64,48,32,16" | Out-Null
    }

    $infoObj = Get-Content (Join-Path $desktopDir "build\windows\info.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    $infoObj.fixed.file_version = $fileVersion
    $infoObj.fixed.product_version = $fileVersion
    $prodName = if ($channel -eq "beta") { "OmniMail (Beta)" } elseif ($channel -eq "alpha") { "OmniMail (Alpha)" } else { "OmniMail" }
    $infoObj.info."0804".FileVersion = $Version
    $infoObj.info."0804".ProductVersion = $Version
    $infoObj.info."0804".ProductName = $prodName
    $infoObj.info."0409".FileVersion = $Version
    $infoObj.info."0409".ProductVersion = $Version
    $infoObj.info."0409".ProductName = $prodName

    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($tempInfoJson, ($infoObj | ConvertTo-Json -Depth 6), $utf8NoBom)

    wails3 generate syso `
      -arch amd64 `
      -icon "build/windows/icon.ico" `
      -manifest "build/windows/wails.exe.manifest" `
      -info "build/windows/.info.generated.json" `
      -out $sysoOut
    if ($LASTEXITCODE -ne 0) { throw "生成 Windows .syso 资源失败" }

    Write-Host "==> [4/5] 编译 OmniMail 生产版主程序 (CGO_ENABLED=0, windows/amd64)..." -ForegroundColor Cyan
    if (Test-Path $stageBinDir) { Remove-Item $stageBinDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $stageBinDir | Out-Null
    $env:GOOS = "windows"
    $env:GOARCH = "amd64"
    $env:CGO_ENABLED = "0"
    $ldflags = "-s -w -H windowsgui -X main.AppVersion=$Version -X main.ReleaseChannel=$channel -X main.BuildTime=$buildTime -X main.ReleaseRepo=$ReleaseRepo"
    go build -tags production -trimpath -buildvcs=false -ldflags="$ldflags" -o $exeOut .
    if ($LASTEXITCODE -ne 0) { throw "Go 生产编译失败" }
  } finally {
    if (Test-Path $tempInfoJson) { Remove-Item $tempInfoJson -Force }
    if (Test-Path $sysoOut) { Remove-Item $sysoOut -Force }
    Pop-Location
  }

  New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

  Write-Host "==> [5/5] 使用 NSIS 编译交互式安装包 (.exe) 并生成校验摘要..." -ForegroundColor Cyan
  $makensis = $null
  $cmdCheck = Get-Command makensis -ErrorAction SilentlyContinue
  if ($cmdCheck) {
    $makensis = $cmdCheck.Source
  } else {
    $candidates = @(
      "C:\Program Files (x86)\NSIS\makensis.exe",
      "C:\Program Files\NSIS\makensis.exe",
      "$env:LOCALAPPDATA\Programs\NSIS\makensis.exe",
      "$env:USERPROFILE\scoop\apps\nsis\current\makensis.exe"
    )
    foreach ($c in $candidates) {
      if (Test-Path $c) { $makensis = $c; break }
    }
  }
  if (-not $makensis) {
    throw "未检测到 NSIS (makensis.exe)，请先安装 NSIS 3.x"
  }

  $installerExe = Join-Path $releaseDir "OmniMail-windows-Setup-$pkgVer.exe"
  $nsiScript = Join-Path $desktopDir "build\windows\installer\omnimail.nsi"
  & $makensis `
    /WX `
    /INPUTCHARSET UTF8 `
    "/DAPP_VERSION=$Version" `
    "/DAPP_FILE_VERSION=$fileVersion" `
    "/DAPP_CHANNEL=$channel" `
    "/DAPP_BINARY=$exeOut" `
    "/DLICENSE_FILE=$licenseFile" `
    "/DINSTALLER_OUT=$installerExe" `
    $nsiScript
  if ($LASTEXITCODE -ne 0) { throw "NSIS 安装包编译失败（含零警告门禁 /WX）" }

  $installerHash = (Get-FileHash $installerExe -Algorithm SHA256).Hash.ToLower()
  $installerLeaf = Split-Path -Leaf $installerExe
  Set-Content -Path (Join-Path $releaseDir "SHA256SUMS.txt") -Value "$installerHash  $installerLeaf" -Encoding ASCII

  Write-Host "`n安装包构建成功 [$Version | $channel | PE=$fileVersion] -> $releaseDir" -ForegroundColor Green
  Get-Item $installerExe, (Join-Path $releaseDir "SHA256SUMS.txt") |
    Select-Object Name, @{Name="SizeMB";Expression={[math]::Round($_.Length / 1MB, 2)}}, FullName |
    Format-Table -AutoSize
} finally {
  if (Test-Path $stageBinDir) { Remove-Item $stageBinDir -Recurse -Force }
}
