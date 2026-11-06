param()
$ErrorActionPreference = 'Stop'
$version = '10.0.26100.3916'
$expected = 'PcpU7O/npzZoFrvDdmjopbNYjJGLXhZMuu577aK/i1WPyDCD/gLaZNPJcBGB9+3KCX8LUbjL5nemSaKWdmgDMg=='
$root = Join-Path $env:LOCALAPPDATA "OmniMail\release-tools\windows-sdk-$version"
$package = Join-Path $root "microsoft.windows.sdk.buildtools.$version.nupkg"
$expanded = Join-Path $root 'package'
if (-not (Test-Path -LiteralPath $root)) { [void](New-Item -ItemType Directory -Path $root) }
if (-not (Test-Path -LiteralPath $package)) {
    $download = Join-Path $root 'sdk-buildtools.download'
    $url = "https://api.nuget.org/v3-flatcontainer/microsoft.windows.sdk.buildtools/$version/microsoft.windows.sdk.buildtools.$version.nupkg"
    # 仅重试公开、可重复下载的固定文件；不关闭 TLS 校验，不把部分文件当成工具包。
    & curl.exe --fail --location --silent --show-error --retry 2 --retry-all-errors --retry-delay 1 --output $download $url
    if ($LASTEXITCODE) { throw '官方签名工具包下载失败，未使用部分内容' }
    $downloadHash = (Get-FileHash -LiteralPath $download -Algorithm SHA512).Hash
    if ([Convert]::ToBase64String([Convert]::FromHexString($downloadHash)) -cne $expected) { throw '官方签名工具包下载校验失败' }
    Move-Item -LiteralPath $download -Destination $package
}
$hash = (Get-FileHash -LiteralPath $package -Algorithm SHA512).Hash
if ([Convert]::ToBase64String([Convert]::FromHexString($hash)) -cne $expected) {
    throw '官方 SDK 工具包 SHA-512 不匹配，停止使用，不覆盖未知缓存'
}
$telemetry = $env:DOTNET_CLI_TELEMETRY_OPTOUT
try {
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    dotnet nuget verify $package --all
    if ($LASTEXITCODE) { throw '官方 NuGet 工具包签名核对失败' }
} finally { $env:DOTNET_CLI_TELEMETRY_OPTOUT = $telemetry }
if (-not (Test-Path -LiteralPath $expanded)) {
    [IO.Compression.ZipFile]::ExtractToDirectory($package,$expanded)
}
$tools = @(Get-ChildItem -LiteralPath $expanded -Filter signtool.exe -File -Recurse |
    Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' })
if ($tools.Count -ne 1) { throw '官方工具包中的 x64 signtool 数量异常' }
$signature = Get-AuthenticodeSignature -LiteralPath $tools[0].FullName
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch '(^|,\s*)O=Microsoft Corporation(,|$)') {
    throw 'signtool 微软代码签名无效，停止执行'
}
Write-Output $tools[0].FullName
