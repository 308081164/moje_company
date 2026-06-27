$env:HTTP_PROXY = $null
$env:HTTPS_PROXY = $null
$env:ALL_PROXY = $null
$env:NO_PROXY = "*"

pip install --proxy="" -i https://pypi.tuna.tsinghua.edu.cn/simple `
    fastapi uvicorn[standard] python-multipart pydantic python-dotenv httpx Pillow numpy trimesh open3d manifold3d

pip install --proxy="" `
    torch torchvision --index-url https://mirrors.tuna.tsinghua.edu.cn/pytorch-wheels/cu124

pip install --proxy="" -i https://pypi.tuna.tsinghua.edu.cn/simple hy3dgen
