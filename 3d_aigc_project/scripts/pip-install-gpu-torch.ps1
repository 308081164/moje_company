# 通过 curl 直链下载 wheel 后本地安装（绕过 pip 慢速/超时）
$ErrorActionPreference = "Continue"
$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:ALL_PROXY = $null
$env:NO_PROXY = "*"

$Cache = "D:\Hui_Loading\moje_company\3d_aigc_project\.tools\pytorch-wheels"
New-Item -ItemType Directory -Force -Path $Cache | Out-Null

$TorchWhl = Join-Path $Cache "torch-2.6.0+cu124-cp310-cp310-win_amd64.whl"
$VisionWhl = Join-Path $Cache "torchvision-0.21.0+cu124-cp310-cp310-win_amd64.whl"
$Base = "https://mirrors.aliyun.com/pytorch-wheels/cu124"

function Download-Wheel($url, $dest) {
    $need = 1024 * 1024  # 1MB 以上视为有效
    if ((Test-Path $dest) -and ((Get-Item $dest).Length -gt $need)) {
        Write-Host "OK  已缓存: $(Split-Path $dest -Leaf) ($([math]::Round((Get-Item $dest).Length/1MB,1)) MB)"
        return
    }
    Write-Host "下载 $url ..."
    curl.exe --noproxy "*" --ssl-no-revoke -fsSL -C - -o $dest $url
    if (-not (Test-Path $dest)) { throw "下载失败: $url" }
    Write-Host "OK  $(Split-Path $dest -Leaf) ($([math]::Round((Get-Item $dest).Length/1MB,1)) MB)"
}

Download-Wheel "$Base/torch-2.6.0%2Bcu124-cp310-cp310-win_amd64.whl" $TorchWhl
Download-Wheel "$Base/torchvision-0.21.0%2Bcu124-cp310-cp310-win_amd64.whl" $VisionWhl

Write-Host "==> 本地安装 wheel ..."
pip uninstall -y torch torchvision torchaudio 2>$null
pip install --proxy="" $TorchWhl $VisionWhl

Write-Host "==> 验证 ..."
python -c @"
import torch, torchvision
print('torch:', torch.__version__)
print('torchvision:', torchvision.__version__)
print('cuda available:', torch.cuda.is_available())
if torch.cuda.is_available():
    print('gpu:', torch.cuda.get_device_name(0))
"@
