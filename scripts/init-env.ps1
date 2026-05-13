# 从 .env.example 生成仓库根目录 .env（不提交 Git）
param([switch]$Force)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root
$Example = Join-Path $Root ".env.example"
$Target = Join-Path $Root ".env"
if (-not (Test-Path $Example)) { throw "未找到 .env.example" }
if ((Test-Path $Target) -and -not $Force) {
    Write-Host ".env 已存在。若需覆盖请执行: .\scripts\init-env.ps1 -Force" -ForegroundColor Yellow
    exit 1
}
Copy-Item -Path $Example -Destination $Target -Force
Write-Host "已生成 $Target ，请编辑填写真实值后再启动。" -ForegroundColor Green
