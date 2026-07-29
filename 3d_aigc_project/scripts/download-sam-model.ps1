# 下载 SAM 点选分割模型（SAM2 优先，SAM1 vit_b 为回退）
# 用法: powershell -ExecutionPolicy Bypass -File scripts/download-sam-model.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Sam2Dir = Join-Path $Root "models\sam2"
$Sam1Dir = Join-Path $Root "models\sam"
New-Item -ItemType Directory -Force -Path $Sam2Dir | Out-Null
New-Item -ItemType Directory -Force -Path $Sam1Dir | Out-Null

Write-Host "==> 下载 SAM2.1 Hiera Tiny (~150MB) ..."
$sam2Url = "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt"
$sam2Out = Join-Path $Sam2Dir "sam2.1_hiera_tiny.pt"
if (-not (Test-Path $sam2Out)) {
    Invoke-WebRequest -Uri $sam2Url -OutFile $sam2Out -UseBasicParsing
    Write-Host "    已保存: $sam2Out"
} else {
    Write-Host "    已存在，跳过"
}

Write-Host "==> 下载 SAM1 vit_b 回退权重 (~375MB) ..."
$sam1Url = "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth"
$sam1Out = Join-Path $Sam1Dir "sam_vit_b_01ec64.pth"
if (-not (Test-Path $sam1Out)) {
    Invoke-WebRequest -Uri $sam1Url -OutFile $sam1Out -UseBasicParsing
    Write-Host "    已保存: $sam1Out"
} else {
    Write-Host "    已存在，跳过"
}

Write-Host ""
Write-Host "完成。请安装 Python 依赖:"
Write-Host "  pip install segment-anything"
Write-Host "  pip install git+https://github.com/facebookresearch/sam2.git   # 可选，优先 SAM2"
Write-Host "然后重启 ai-service (8855)"
