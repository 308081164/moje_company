#Requires -RunAsAdministrator
<#
.SYNOPSIS
  为 Docker Desktop 安装 WSL2（需管理员 PowerShell）

  重要：WSL 内核更新包 (wsl_update_x64.msi) 只能在「Windows Subsystem for Linux」
  功能已启用并重启后才能安装，否则会报 Setup Wizard ended prematurely。

.USAGE
  右键 PowerShell → 以管理员身份运行：
  Set-ExecutionPolicy -Scope Process Bypass -Force
  & "D:\Hui_Loading\moje_company\3d_aigc_project\scripts\install-wsl-for-docker.ps1"
#>

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "OK  $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "!!  $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "ERR $msg" -ForegroundColor Red }

function Test-FeatureEnabled($name) {
    $info = dism /online /get-featureinfo /featurename:$name 2>&1 | Out-String
    return ($info -match "State : Enabled") -or ($info -match "状态 : 已启用")
}

Write-Host "========================================" -ForegroundColor White
Write-Host " WSL2 安装脚本（Docker Desktop 前置依赖）" -ForegroundColor White
Write-Host "========================================" -ForegroundColor White

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).
    IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Err "请右键 PowerShell，选择「以管理员身份运行」后再执行本脚本。"
    exit 1
}
Write-Ok "当前为管理员权限"

# --- 阶段 1：启用 Windows 可选功能 ---
Write-Step "阶段 1/2：启用 WSL 与虚拟机平台"
$features = @(
    "Microsoft-Windows-Subsystem-Linux",
    "VirtualMachinePlatform"
)
$needReboot = $false
foreach ($f in $features) {
    if (Test-FeatureEnabled $f) {
        Write-Ok "$f 已启用"
    } else {
        Write-Host "正在启用 $f ..."
        dism /online /enable-feature /featurename:$f /all /norestart | Out-Host
        if ($LASTEXITCODE -ne 0) {
            Write-Err "启用 $f 失败，请确认以管理员运行。"
            exit 1
        }
        Write-Ok "$f 已启用（需重启生效）"
        $needReboot = $true
    }
}

if ($needReboot) {
    Write-Host ""
    Write-Warn "Windows 功能刚被启用，必须先重启，才能安装 WSL 内核。"
    Write-Warn "请勿现在运行 wsl_update_x64.msi，否则会报 Setup Wizard ended prematurely。"
    Write-Host ""
    $ans = Read-Host "是否立即重启？(Y/N)"
    if ($ans -match '^[Yy]') {
        shutdown /r /t 30 /c "WSL 功能已启用，30 秒后重启。取消请运行: shutdown /a"
        Write-Host "30 秒后将重启。取消: shutdown /a"
        Write-Host "重启后请再次以管理员运行本脚本完成阶段 2。"
    } else {
        Write-Host "请手动重启后，再次以管理员运行本脚本。"
    }
    exit 0
}

# --- 阶段 2：功能已启用且已重启，安装 WSL 组件 ---
Write-Step "阶段 2/2：安装 WSL 内核与组件"

Write-Host "尝试 wsl --install --no-distribution ..."
$installOut = wsl --install --no-distribution 2>&1 | Out-String
Write-Host $installOut

if ($installOut -match "403|已禁止|Forbidden") {
    Write-Warn "wsl --install 被阻止，改用手动安装内核更新包 ..."
    $wslUpdateMsi = Join-Path $env:TEMP "wsl_update_x64.msi"
    $wslUpdateUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
    try {
        Invoke-WebRequest -Uri $wslUpdateUrl -OutFile $wslUpdateMsi -UseBasicParsing
        Write-Host "安装 $wslUpdateMsi ..."
        Start-Process msiexec.exe -ArgumentList "/i `"$wslUpdateMsi`" /passive /norestart" -Wait
        if ($LASTEXITCODE -eq 0) { Write-Ok "WSL2 内核更新包已安装" }
    } catch {
        Write-Err "下载失败: $_"
        Write-Host "请手动下载: $wslUpdateUrl"
    }
}

Write-Step "设置 WSL2 为默认版本"
wsl --set-default-version 2 2>&1 | ForEach-Object { Write-Host $_ }

Write-Step "验证"
Write-Host "WSL 版本："
wsl --version 2>&1
Write-Host "`n已安装发行版："
wsl -l -v 2>&1

Write-Host "`n========================================" -ForegroundColor White
Write-Host " 完成" -ForegroundColor White
Write-Host "========================================" -ForegroundColor White
Write-Host "1. 若 wsl --version 正常显示版本号，打开 Docker Desktop 即可"
Write-Host "2. 验证: docker info"
Write-Host "3. 若仍失败，参考: https://learn.microsoft.com/zh-cn/windows/wsl/install-manual"
