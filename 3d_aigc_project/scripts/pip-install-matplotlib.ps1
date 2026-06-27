$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:ALL_PROXY = $null
$env:NO_PROXY = "*"
pip install --proxy="" -i https://pypi.tuna.tsinghua.edu.cn/simple matplotlib
