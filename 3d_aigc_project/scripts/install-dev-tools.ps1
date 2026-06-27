# 下载项目本地开发工具（JDK / Maven / Node），无需系统级安装
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:ALL_PROXY = $null
$env:NO_PROXY = "*"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Tools = Join-Path $Root ".tools"
New-Item -ItemType Directory -Force -Path $Tools | Out-Null

function Ensure-Archive($url, $destDir, $innerFolder) {
    $target = Join-Path $destDir $innerFolder
    if (Test-Path $target) {
        Write-Host "OK  已存在: $innerFolder"
        return $target
    }
    $zip = Join-Path $env:TEMP ([IO.Path]::GetFileName($url))
    Write-Host "下载 $url ..."
    curl.exe --noproxy "*" --ssl-no-revoke -fsSL -L -o $zip $url
    if (-not (Test-Path $zip) -or (Get-Item $zip).Length -lt 1024) {
        throw "下载失败: $url"
    }
    Expand-Archive -Path $zip -DestinationPath $destDir -Force
    Remove-Item $zip -Force
    if (-not (Test-Path $target)) {
        $found = Get-ChildItem $destDir -Directory | Where-Object { $_.Name -like "*$($innerFolder)*" -or $_.Name -match 'jdk|maven|node' } | Select-Object -First 1
        if ($found) { $target = $found.FullName }
    }
    Write-Host "OK  解压完成: $(Split-Path $target -Leaf)"
    return $target
}

# Microsoft OpenJDK 17
$jdkDir = Ensure-Archive `
    "https://aka.ms/download-jdk/microsoft-jdk-17.0.13-windows-x64.zip" `
    $Tools "jdk-17.0.13+11"

# Maven 3.9.9（Apache 归档）
$mvnDir = Ensure-Archive `
    "https://archive.apache.org/dist/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.zip" `
    $Tools "apache-maven-3.9.9"

# Node.js 20 LTS（npmmirror）
$nodeDir = Ensure-Archive `
    "https://npmmirror.com/mirrors/node/v20.18.0/node-v20.18.0-win-x64.zip" `
    $Tools "node-v20.18.0-win-x64"

# 写入 env 脚本
$envScript = @"
@echo off
set "JAVA_HOME=$($jdkDir -replace '/','\')"
set "MAVEN_HOME=$($mvnDir -replace '/','\')"
set "NODE_HOME=$($nodeDir -replace '/','\')"
set "PATH=%JAVA_HOME%\bin;%MAVEN_HOME%\bin;%NODE_HOME%;%PATH%"
"@
Set-Content -Path (Join-Path $Tools "env.bat") -Value $envScript -Encoding ASCII
Write-Host "`n开发工具已就绪: $Tools"
Write-Host "运行 scripts\start-dev.bat 启动项目"
