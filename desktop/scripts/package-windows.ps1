param(
 [Parameter(Mandatory=$true)][ValidatePattern('^(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})\.(0|[1-9][0-9]{0,8})$')][string]$Version,
 [switch]$AllowUnsignedDevelopment,
 [string]$ISCC='C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
 [Parameter(Mandatory=$true)][string]$NotesFile
)
$ErrorActionPreference='Stop'
if([Environment]::OSVersion.Platform -ne 'Win32NT'){throw 'Windows 安装包必须在 Windows 上构建'}
$desktop=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
if(-not $AllowUnsignedDevelopment){
 foreach($name in @('WINDOWS_SIGN_CERT_PFX_BASE64','WINDOWS_SIGN_CERT_PASSWORD','UPDATE_MANIFEST_PRIVATE_KEY','UPDATE_PUBLIC_KEY')){
  if(-not [Environment]::GetEnvironmentVariable($name)){throw "正式发布缺少 Secret/变量: $name"}
 }
}
foreach($part in $Version.Split('.')){if([int64]$part -gt 65535){throw 'Windows 版本段不能超过 65535'}}
if(-not (Test-Path -LiteralPath $ISCC -PathType Leaf)){throw '未安装锁定的 Inno Setup 6.7.0，使用 -ISCC 指定编译器'}
$mode=if($AllowUnsignedDevelopment){'development'}else{'release'}
$key=if($AllowUnsignedDevelopment){''}else{$env:UPDATE_PUBLIC_KEY}
if($key -and $key -notmatch '^[A-Za-z0-9+/]{43}=$'){throw '更新公钥格式无效'}
$NotesFile=(Resolve-Path -LiteralPath $NotesFile).Path
if((Get-Item -LiteralPath $NotesFile).Length -gt 32768){throw '当前版本说明超过 32 KiB'}
$notes=(Get-Content -LiteralPath $NotesFile -Raw -Encoding utf8)
if([Text.Encoding]::UTF8.GetByteCount($notes) -gt 32768){throw '当前版本说明超过 32 KiB，请提供精简 NotesFile'}
# 每次独立目录，发布绝不混入上轮/其他版本产物，也不递归清理用户文件。
$run=[guid]::NewGuid().ToString('N')
$bin=Join-Path $desktop ".task\release-bin\$run"
$output=Join-Path $desktop ".task\release\$Version-$mode-$run"
[void](New-Item -ItemType Directory -Path $bin,$output)
[IO.File]::WriteAllText((Join-Path $bin 'RELEASE_NOTES.txt'),$notes,[Text.UTF8Encoding]::new($false))
Push-Location $desktop
try{
 if(-not $AllowUnsignedDevelopment){
  go run ./cmd/release-manifest --check-key
  if($LASTEXITCODE){throw '更新清单公私钥校验失败'}
 }
 go tool wails3 task frontend:build
 if($LASTEXITCODE){throw '前端构建失败'}
 $info=@{fixed=@{file_version="$Version.0";product_version="$Version.0"};info=@{'0000'=@{CompanyName='OmniMail';FileDescription='OmniMail';FileVersion=$Version;InternalName='OmniMail';OriginalFilename='OmniMail.exe';ProductName='OmniMail';ProductVersion=$Version}}}
 $infoPath=Join-Path $bin 'info.json';[IO.File]::WriteAllText($infoPath,($info|ConvertTo-Json -Depth 6),[Text.UTF8Encoding]::new($false))
 go tool wails3 generate syso -arch amd64 -icon frontend/public/brand/omnimail.ico -manifest build/windows/OmniMail.exe.manifest -info $infoPath -out wails_windows_amd64.syso
 if($LASTEXITCODE){throw '版本资源生成失败'}
 $commit=(git rev-parse --short=12 HEAD).Trim()
 if($LASTEXITCODE -or $commit -notmatch '^[0-9a-f]{12}$'){throw '无法确定构建提交'}
 $time=[DateTimeOffset]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
 $display=if($AllowUnsignedDevelopment){"$Version-dev"}else{$Version}
 $flags="-s -w -H windowsgui -X omnimail/desktop/internal/bridge.Version=$display -X omnimail/desktop/internal/bridge.Commit=$commit -X omnimail/desktop/internal/bridge.BuildTime=$time -X omnimail/desktop/internal/updater.ReleaseMode=$mode -X omnimail/desktop/internal/updater.PublicKey=$key"
 if($AllowUnsignedDevelopment){$flags+=' -X omnimail/desktop/internal/platform.InstallationRegistryKey=Software\OmniMail-Development\Installation'}
 $oldArch=$env:GOARCH;$oldOS=$env:GOOS;try{
  $env:GOARCH='amd64';$env:GOOS='windows'
  go build -tags production -trimpath -buildvcs=false -ldflags $flags -o (Join-Path $bin 'OmniMail.exe') .
  if($LASTEXITCODE){throw '主程序构建失败'}
  go build -trimpath -buildvcs=false -ldflags $flags -o (Join-Path $bin 'OmniMailUpdate.exe') ./cmd/update-helper
  if($LASTEXITCODE){throw '升级助手构建失败'}
 }finally{$env:GOARCH=$oldArch;$env:GOOS=$oldOS}
 $signer=Join-Path $PSScriptRoot 'sign-windows.ps1'
 $signingShell=Join-Path $PSHOME 'pwsh.exe'
 if(-not (Test-Path -LiteralPath $signingShell)){throw '生产打包需要 PowerShell 7，不能混用 Windows PowerShell 模块'}
 $arguments=@("/DAppVersion=$Version","/DBinaryDir=$bin","/DOutputPath=$output")
 if(-not $AllowUnsignedDevelopment){
  & $signer -File (Join-Path $bin 'OmniMail.exe')
  & $signer -File (Join-Path $bin 'OmniMailUpdate.exe')
  $arguments+=('/Somnimail=$q'+$signingShell+'$q -NoProfile -ExecutionPolicy Bypass -File $q'+$signer+'$q -File $f')
 }else{
  $arguments+='/DAllowUnsignedDevelopment=yes'
 }
 & $ISCC @arguments (Join-Path $desktop 'build\windows\installer.iss')
 if($LASTEXITCODE){throw 'Inno Setup 编译失败'}
 $packageVersion=if($AllowUnsignedDevelopment){"$Version-dev-unsigned"}else{$Version}
 $package=Join-Path $output "OmniMail-$packageVersion-windows-amd64-setup.exe"
 if(-not (Test-Path -LiteralPath $package -PathType Leaf)){throw '安装包产物缺失'}
 if(-not $AllowUnsignedDevelopment){
  & $signer -File $package
  go run ./cmd/release-manifest --version $Version --package $package --notes (Join-Path $bin 'RELEASE_NOTES.txt') --out $output
  if($LASTEXITCODE){throw '签名清单生成失败'}
 }
 $hash=(Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash.ToLowerInvariant()
 [IO.File]::WriteAllText((Join-Path $output 'SHA256SUMS.txt'),"$hash  $([IO.Path]::GetFileName($package))`n",[Text.UTF8Encoding]::new($false))
 Copy-Item -LiteralPath (Join-Path $bin 'RELEASE_NOTES.txt') -Destination $output
 if($env:GITHUB_OUTPUT){
  Add-Content -LiteralPath $env:GITHUB_OUTPUT -Encoding utf8 -Value "release_directory=$output"
 }
 if($AllowUnsignedDevelopment){Write-Warning '仅开发验证：未签名且不能自动升级，禁止发布此包'}
 Write-Output $package
}finally{Pop-Location}
