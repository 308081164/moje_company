$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:ALL_PROXY = $null
$env:NO_PROXY = "*"

pip install --proxy="" torchvision --index-url https://mirrors.tuna.tsinghua.edu.cn/pytorch-wheels/cu124
