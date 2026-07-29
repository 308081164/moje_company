# Agent / 自动化注意事项

## 强制 GPU（严格）

本项目 **默认且必须使用 GPU** 做 3D 推理。静默落到 CPU 会导致 FAST 模式也接近 1 小时，属于严重事故。

### 重启 / 应用更新时

1. **优先**使用 `start.bat` / `start.sh`（默认 GPU，启动后校验 `/health` 的 `gpu_available`）。
2. 若直接用 Compose，**裸跑即可**：
   ```bash
   docker compose up -d --build
   # 或只重建 AI：
   docker compose up -d --build ai-service
   ```
   主文件 `docker-compose.yml` **已内置** NVIDIA `deploy.resources.reservations.devices`、CUDA PyTorch 构建参数，以及 `REQUIRE_GPU=1`。
3. 兼容旧命令（冗余但无害）：
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
   ```
4. **禁止**为了“简化”去掉 GPU 配置后重启。历史上 `DeviceRequests=null` → CPU 推理即因此发生。
5. 重启后请确认：
   - `docker inspect 3d-aigc-ai-service` 中 `HostConfig.DeviceRequests` 非 null
   - `curl http://localhost:8855/health` 中 `gpu_available: true`、`require_gpu: true`、`device: "cuda"`

### 紧急 CPU（仅人工应急）

```bash
start.bat --cpu   # 或 ./start.sh --cpu
```

会叠加 `docker-compose.cpu.yml`（`REQUIRE_GPU=0`，清除 GPU devices）。脚本会打印强烈警告。  
**Agent 自动化禁止使用 `--cpu`。**

### 运行时硬失败

`ai-service` 在 `REQUIRE_GPU=1`（compose 默认）时，若 `torch.cuda.is_available()` 为 false，进程以 **非零退出**，不会静默用 CPU 继续服务。
