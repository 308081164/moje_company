#Requires -Version 5.1
# Build Inno Setup installer with embedded CPython (no system PATH / py launcher).
# ASCII-only user-visible strings for Windows PowerShell 5.x.
<#
.SYNOPSIS
  Stage xianyu-super-butler, embed Python 3.12 (official embeddable zip), write Launch.bat, compile ISS.

.PARAMETER SourceRoot
  Path to xianyu-super-butler repo root (contains Start.py, requirements.txt, frontend).

.PARAMETER SkipFrontendBuild
  Skip npm install / npm run build in SourceRoot\frontend.

.PARAMETER SkipStaging
  Skip staging (embedded Python + robocopy + Launch.bat). Staging must already exist for ISCC.

.PARAMETER EmbedVersion
  Python embed zip version, default 3.12.9.

.PARAMETER PipIndexUrl
  Optional PyPI index for get-pip, e.g. https://pypi.tuna.tsinghua.edu.cn/simple

.PARAMETER UseTsinghuaPip
  Use Tsinghua PyPI mirror for get-pip (helps when pypi.org is slow from China).

.EXAMPLE
  cd packaging\xianyu-super-butler-windows
  .\build-installer.ps1 -SourceRoot D:\src\xianyu-super-butler
.EXAMPLE
  .\build-installer.ps1 -SourceRoot D:\src\xianyu-super-butler -UseTsinghuaPip
#>
param(
    [string]$SourceRoot = "",
    [switch]$SkipFrontendBuild,
    [switch]$SkipStaging,
    [string]$EmbedVersion = "3.12.9",
    [string]$PipIndexUrl = "",
    [switch]$UseTsinghuaPip
)

$ErrorActionPreference = "Stop"
$Here = $PSScriptRoot
$StagingRoot = Join-Path $Here "staging"
$StagingApp = Join-Path $StagingRoot "XianyuSuperButler"
$DistOut = Join-Path $Here "dist-installer"
$CacheDir = Join-Path $Here ".cache"
$EmbedTag = "python-$EmbedVersion-embed-amd64"
$EmbedZipName = "$EmbedTag.zip"
$EmbedUrl = "https://www.python.org/ftp/python/$EmbedVersion/$EmbedZipName"
$GetPipUrl = "https://bootstrap.pypa.io/get-pip.py"

if (-not $SourceRoot) {
    $repoRoot = Split-Path (Split-Path $Here -Parent) -Parent
    $SourceRoot = Join-Path $repoRoot "third_party\xianyu-super-butler"
}
if (-not (Test-Path -LiteralPath (Join-Path $SourceRoot "Start.py"))) {
    throw "SourceRoot invalid or missing Start.py: $SourceRoot (use -SourceRoot)"
}

function Remove-DirectoryRobust {
    param([Parameter(Mandatory)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    $full = (Resolve-Path -LiteralPath $Path).Path
    Write-Host ">>> Removing directory (robocopy empty mirror + rd)..."
    $empty = Join-Path ([System.IO.Path]::GetTempPath()) ("xy_sb_empty_" + [Guid]::NewGuid().ToString("N"))
    try {
        New-Item -ItemType Directory -Path $empty -Force | Out-Null
        & robocopy.exe $empty $full /MIR /R:1 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    } finally {
        if (Test-Path -LiteralPath $empty) {
            Remove-Item -LiteralPath $empty -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    $exit = $LASTEXITCODE
    if ($exit -ge 8) {
        Write-Host "[WARN] robocopy mirror exit code $exit ; trying rd /s /q"
    }
    cmd.exe /c "rd /s /q `"$full`"" | Out-Null
    if (Test-Path -LiteralPath $Path) {
        $long = if ($full -match '^\\\\') { $full } else { "\\?\$full" }
        Remove-Item -LiteralPath $long -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $Path) {
        throw "Cannot remove: $Path. Close programs using it or delete manually, then retry."
    }
}

function Ensure-Download {
    param([string]$Url, [string]$DestPath)
    if (Test-Path -LiteralPath $DestPath) { return }
    Write-Host ">>> Downloading: $Url"
    New-Item -ItemType Directory -Path (Split-Path $DestPath -Parent) -Force | Out-Null
    Invoke-WebRequest -Uri $Url -OutFile $DestPath -UseBasicParsing -TimeoutSec 600
}

function Invoke-PythonWithRedirect {
    param(
        [string]$PyExe,
        [string[]]$Arguments,
        [string]$WorkDir,
        [string]$StdOutLog,
        [string]$StdErrLog
    )
    Remove-Item -LiteralPath $StdOutLog -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $StdErrLog -Force -ErrorAction SilentlyContinue
    $p = Start-Process -FilePath $PyExe `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkDir `
        -Wait -PassThru `
        -WindowStyle Hidden `
        -RedirectStandardOutput $StdOutLog `
        -RedirectStandardError $StdErrLog
    if (Test-Path -LiteralPath $StdOutLog) {
        Get-Content -LiteralPath $StdOutLog -ErrorAction SilentlyContinue | Write-Host
    }
    if (Test-Path -LiteralPath $StdErrLog) {
        Get-Content -LiteralPath $StdErrLog -ErrorAction SilentlyContinue | Write-Host
    }
    if ($null -eq $p) { return 1 }
    return [int]$p.ExitCode
}

function Install-EmbeddedPython {
    param(
        [string]$StagingRuntimeDir,
        [string]$PipIndexUrl,
        [switch]$UseTsinghuaPip
    )
    New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
    $zipLocal = Join-Path $CacheDir $EmbedZipName
    Ensure-Download -Url $EmbedUrl -DestPath $zipLocal
    $getPipLocal = Join-Path $CacheDir "get-pip.py"
    Ensure-Download -Url $GetPipUrl -DestPath $getPipLocal

    $extractParent = Join-Path $StagingRuntimeDir "python312"
    if (Test-Path -LiteralPath $extractParent) {
        Remove-DirectoryRobust -Path $extractParent
    }
    New-Item -ItemType Directory -Path $extractParent -Force | Out-Null
    Write-Host ">>> Expand embedded Python to staging..."
    Expand-Archive -LiteralPath $zipLocal -DestinationPath $extractParent -Force

    $pthFiles = Get-ChildItem -Path $extractParent -Filter "python*._pth" -File -ErrorAction SilentlyContinue
    $pkgRelForPth = '..\..\python_packages'
    foreach ($pth in $pthFiles) {
        $lines = Get-Content -LiteralPath $pth.FullName
        $out = foreach ($line in $lines) {
            if ($line -match '^\s*#\s*import\s+site') { "import site" }
            elseif ($line -eq 'import site') { 'import site' }
            else { $line }
        }
        if ($out -notcontains 'import site') {
            $out = @($out) + 'import site'
        }
        # Embed ignores PYTHONPATH for -c in some setups; add target dir to sys.path via ._pth (relative to python.exe dir).
        $norm = foreach ($x in $out) { $x.Trim().Replace('/', '\') }
        if ($norm -notcontains $pkgRelForPth) {
            $out = @($out) + $pkgRelForPth
        }
        Set-Content -LiteralPath $pth.FullName -Value $out -Encoding ASCII
    }

    $pyExe = Join-Path $extractParent "python.exe"
    if (-not (Test-Path -LiteralPath $pyExe)) {
        throw "python.exe not found after expand: $pyExe"
    }
    $env:PIP_DEFAULT_TIMEOUT = '180'
    $env:PIP_RETRIES = '25'
    $outLog = Join-Path $CacheDir 'get-pip-stdout.log'
    $errLog = Join-Path $CacheDir 'get-pip-stderr.log'

    $tryUrls = [System.Collections.ArrayList]@()
    if ($UseTsinghuaPip) {
        [void]$tryUrls.Add('https://pypi.tuna.tsinghua.edu.cn/simple')
    }
    elseif ($PipIndexUrl) {
        [void]$tryUrls.Add($PipIndexUrl)
    }
    else {
        [void]$tryUrls.Add('')
        [void]$tryUrls.Add('https://pypi.tuna.tsinghua.edu.cn/simple')
    }

    $lastCode = 1
    foreach ($idx in $tryUrls) {
        if ($idx) {
            $env:PIP_INDEX_URL = $idx
            Write-Host ">>> get-pip into embedded runtime [index=$idx]..."
        }
        else {
            Remove-Item Env:PIP_INDEX_URL -ErrorAction SilentlyContinue
            Write-Host ">>> get-pip into embedded runtime [default PyPI]..."
        }
        $lastCode = Invoke-PythonWithRedirect -PyExe $pyExe `
            -Arguments @($getPipLocal, '--no-warn-script-location') `
            -WorkDir $extractParent -StdOutLog $outLog -StdErrLog $errLog
        if ($lastCode -eq 0) { break }
        Write-Host "[WARN] get-pip exit $lastCode ; will retry if another index is available"
    }
    if ($lastCode -ne 0) {
        Remove-Item Env:PIP_INDEX_URL -ErrorAction SilentlyContinue
        Remove-Item Env:PIP_DEFAULT_TIMEOUT -ErrorAction SilentlyContinue
        Remove-Item Env:PIP_RETRIES -ErrorAction SilentlyContinue
        throw "get-pip failed exit $lastCode . Try: -UseTsinghuaPip or -PipIndexUrl <mirror> . See $errLog"
    }
    Remove-Item Env:PIP_INDEX_URL -ErrorAction SilentlyContinue
    Remove-Item Env:PIP_DEFAULT_TIMEOUT -ErrorAction SilentlyContinue
    Remove-Item Env:PIP_RETRIES -ErrorAction SilentlyContinue
}

Write-Host "SourceRoot: $SourceRoot"
Write-Host "StagingApp: $StagingApp"

if (-not $SkipFrontendBuild) {
    $fe = Join-Path $SourceRoot "frontend"
    if (-not (Test-Path -LiteralPath $fe)) { throw "frontend not found: $fe" }
    Push-Location $fe
    try {
        Write-Host ">>> npm install (frontend)"
        npm install
        Write-Host ">>> npm run build (frontend)"
        npm run build
    }
    finally { Pop-Location }
}

if (-not $SkipStaging) {
    if (Test-Path -LiteralPath $StagingRoot) {
        Write-Host ">>> Clear staging: $StagingRoot"
        Remove-DirectoryRobust -Path $StagingRoot
    }
    New-Item -ItemType Directory -Path $StagingApp -Force | Out-Null

    Write-Host ">>> robocopy app sources to staging..."
    $robolog = Join-Path $Here "robocopy-staging.log"
    & robocopy.exe $SourceRoot $StagingApp /E /MT:8 /NFL /NDL /NJH /NJS /nc /ns /np `
        /XD .git /XD .venv /XD node_modules /XD __pycache__ /XD .cursor `
        /XD dist-installer /XD installer /XD runtime /XD python_packages /XD "frontend\node_modules" `
        /LOG:$robolog /TEE
    $code = $LASTEXITCODE
    if ($code -ge 8) { throw "robocopy failed exit $code ; see $robolog" }

    $runtimeRoot = Join-Path $StagingApp "runtime"
    Install-EmbeddedPython -StagingRuntimeDir $runtimeRoot -PipIndexUrl $PipIndexUrl -UseTsinghuaPip:$UseTsinghuaPip

    # Launch.bat: embeddable Python + virtualenv/.venv often yields broken Scripts\python.exe on Windows.
    # Use only runtime\python312\python.exe + pip --target python_packages + PYTHONPATH.
    $launchBat = @(
        '@echo off',
        'setlocal EnableExtensions',
        'chcp 65001 >nul',
        'cd /d "%~dp0"',
        '',
        'set "NO_PAUSE=0"',
        'if /i "%~1"=="/nopause" set NO_PAUSE=1',
        '',
        'set "API_PORT=8080"',
        'set "EMBED_PY=%CD%\runtime\python312\python.exe"',
        'set "PKG=%CD%\python_packages"',
        '',
        'if exist "%EMBED_PY%" goto :CHK_PKG',
        'echo [ERROR] Embedded Python missing. Reinstall the application.',
        'pause',
        'exit /b 1',
        '',
        ':CHK_PKG',
        'if not exist "%PKG%" mkdir "%PKG%"',
        'set "PYTHONPATH=%PKG%"',
        '',
        '"%EMBED_PY%" -c "import uvicorn" 2>"%PKG%\_import_check_err.txt"',
        'if not errorlevel 1 goto :START_SRV',
        'echo [INFO] pip install into python_packages - first run needs network ...',
        '"%EMBED_PY%" -m pip install -r requirements.txt --target "%PKG%" --disable-pip-version-check',
        'if errorlevel 1 goto :ERR_PIP',
        'set "PYTHONPATH=%PKG%"',
        '"%EMBED_PY%" -c "import uvicorn" 2>"%PKG%\_import_check_err.txt"',
        'if errorlevel 1 goto :ERR_PIP',
        'goto :START_SRV',
        '',
        ':ERR_PIP',
        'echo [ERROR] pip install or import check failed.',
        'if exist "%PKG%\_import_check_err.txt" type "%PKG%\_import_check_err.txt"',
        'pause',
        'exit /b 1',
        '',
        ':START_SRV',
        'set "PYTHONPATH=%PKG%"',
        'echo [INFO] Starting server on port %API_PORT% ...',
        'start "XianyuSuperButler" /MIN "%EMBED_PY%" Start.py',
        '',
        'ping 127.0.0.1 -n 10 >nul',
        'start "" "http://127.0.0.1:%API_PORT%/"',
        '',
        'echo [INFO] Browser should open. Close the minimized server window to stop.',
        'echo [INFO] You may delete the old .venv folder if it exists - it is no longer used.',
        'if "%NO_PAUSE%"=="0" pause',
        'endlocal'
    ) -join "`r`n"

    Set-Content -Path (Join-Path $StagingApp "Launch.bat") -Value $launchBat -Encoding OEM

    $pkgDir = Join-Path $StagingApp "python_packages"
    New-Item -ItemType Directory -Path $pkgDir -Force | Out-Null
    Set-Content -Path (Join-Path $pkgDir ".gitkeep") -Value "" -Encoding ASCII

    $readmeSrc = Get-ChildItem -LiteralPath $Here -Filter "README*.txt" -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName
    if (-not $readmeSrc) { throw "No README*.txt in packaging folder" }
    Copy-Item -LiteralPath $readmeSrc -Destination (Join-Path $StagingApp (Split-Path -Leaf $readmeSrc)) -Force

    Write-Host ">>> staging ready: $StagingApp"
}

$iscc = $null
foreach ($p in @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 5\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 5\ISCC.exe"
    )) {
    if (Test-Path -LiteralPath $p) { $iscc = $p; break }
}
if (-not $iscc) {
    Write-Host ""
    Write-Host "[HINT] ISCC.exe not found. Install Inno Setup 6: https://jrsoftware.org/isdl.php"
    Write-Host ('       ISCC.exe "' + $Here + '\XianyuSuperButler.iss" /DStagingDir="' + $StagingApp + '"')
    exit 2
}

New-Item -ItemType Directory -Path $DistOut -Force | Out-Null
Push-Location $Here
try {
    Write-Host ">>> Inno Setup: $iscc"
    $stagingArg = '/DStagingDir="' + $StagingApp + '"'
    & $iscc @("XianyuSuperButler.iss", $stagingArg)
    if ($LASTEXITCODE -ne 0) { throw "ISCC exit code $LASTEXITCODE" }
}
finally { Pop-Location }

$setup = Get-ChildItem $DistOut -Filter "*Setup*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host ""
Write-Host "Done. Installer: $($setup.FullName)"
