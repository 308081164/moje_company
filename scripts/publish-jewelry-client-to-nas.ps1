#Requires -Version 5.1
<#
.SYNOPSIS
  把珠宝定制管理系统 Windows 安装包发布到 NAS，供员工从企业软件目录下载。
  凭据复用镶嵌库 scripts/.nas-credentials（NAS_HOST / NAS_USER / NAS_PASSWORD）。
.EXAMPLE
  .\scripts\publish-jewelry-client-to-nas.ps1 -SetupExe D:\path\珠宝定制管理系统 Setup 1.1.0.exe
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$SetupExe,
    [string]$Apk = "",
    [string]$CredentialsFile = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path -LiteralPath $SetupExe)) {
    throw "安装包不存在: $SetupExe"
}

$credPath = if ($CredentialsFile) { $CredentialsFile } else { Join-Path $Root "AI_3d_DataBase\scripts\.nas-credentials" }
if (-not (Test-Path -LiteralPath $credPath)) {
    throw "找不到 NAS 凭据: $credPath"
}

$config = @{}
Get-Content -LiteralPath $credPath -Encoding UTF8 | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    if ($_ -match '^([^=]+)=(.*)$') {
        $config[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$NasHost = $config['NAS_HOST']
$NasUser = $config['NAS_USER']
$NasPassword = $config['NAS_PASSWORD']
$ClientRoot = if ($config['NAS_JEWELRY_CLIENT_ROOT']) { $config['NAS_JEWELRY_CLIENT_ROOT'] } else { '/volume1/企业软件/珠宝管理系统' }
$HistoryRoot = "$ClientRoot/历史版本"

if (-not $NasHost -or -not $NasUser) {
    throw 'NAS_HOST / NAS_USER 未配置'
}

$AskPass = Join-Path $Root "AI_3d_DataBase\scripts\.ssh-askpass.cmd"
if ($NasPassword) {
    $env:NAS_SSH_PASSWORD = $NasPassword
    $env:SSH_ASKPASS = $AskPass
    $env:SSH_ASKPASS_REQUIRE = "force"
    if (-not $env:DISPLAY) { $env:DISPLAY = "1" }
}

$sshTarget = "${NasUser}@${NasHost}"
$setupName = Split-Path $SetupExe -Leaf

Write-Host "Publish jewelry client -> ${sshTarget}:$ClientRoot" -ForegroundColor Cyan

function Invoke-Remote([string]$Command) {
    ssh -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no $sshTarget $Command
    if ($LASTEXITCODE -ne 0) { throw "Remote failed: $Command" }
}

function Invoke-Scp([string]$Local, [string]$Remote) {
    scp -O -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no $Local "${sshTarget}:${Remote}"
    if ($LASTEXITCODE -ne 0) { throw "SCP failed: $Local" }
}

Invoke-Remote "mkdir -p '$ClientRoot' '$HistoryRoot'; for f in '$ClientRoot'/*.exe '$ClientRoot'/*.apk; do [ -f `"`$f`" ] || continue; mv -f `"`$f`" '$HistoryRoot'/; done"
Invoke-Scp $SetupExe "$ClientRoot/$setupName"
if ($Apk -and (Test-Path -LiteralPath $Apk)) {
    Invoke-Scp $Apk "$ClientRoot/$(Split-Path $Apk -Leaf)"
}

Write-Host "Latest: $ClientRoot/$setupName" -ForegroundColor Green
Write-Host "SMB: \\$NasHost\企业软件\珠宝管理系统" -ForegroundColor Green
