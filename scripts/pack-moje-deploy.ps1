# 生产手动部署用：只打包源码与静态站，排除 target/node_modules/安装包等大目录
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$out = Join-Path (Get-Location) "moje-deploy.tgz"
if (Test-Path $out) { Remove-Item $out -Force }

$items = @(
    "backend",
    "b2c-web",
    "frontend",
    "docker-compose.prod.yml",
    "scripts/prod-deploy-remote.sh",
    "scripts/deploy_backend_b2c_prod.sh"
)

$exclude = @(
    "--exclude=backend/target",
    "--exclude=backend/logs",
    "--exclude=frontend/node_modules",
    "--exclude=frontend/release",
    "--exclude=frontend/release-*",
    "--exclude=frontend/dist",
    "--exclude=.git"
)

& tar -czf $out @exclude @items
Write-Host "Created $out ($((Get-Item $out).Length) bytes)"
