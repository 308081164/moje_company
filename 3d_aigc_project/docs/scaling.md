# 多 GPU / 多实例扩展

## 单卡（默认）

- **GPU 推理**：单进程 FIFO 串行（Hunyuan3D 非线程安全）
- **后处理**：`PostprocessExecutor` 线程池，默认 4 worker（`MAX_POSTPROCESS_WORKERS`）
- **RTX 4060 Ti 8GB**：不建议同机双 ai-service 实例（双倍显存）

吞吐优化：

1. 提高 `MAX_CONCURRENT_TASKS` 允许更多任务排队
2. CLI `aigc batch --workers N` 并发提交与轮询
3. 后处理与 GPU 阶段分离，GPU 释放后可并行 mesh 处理

## 多卡环境（可选 profile）

使用 `docker-compose.workers.yml`：

```bash
docker compose -f docker-compose.yml -f docker-compose.workers.yml --profile multi-gpu up -d --build
```

- 每 GPU 一个 `ai-service-gpuN` 容器，`CUDA_VISIBLE_DEVICES` 隔离
- `ai-lb`（nginx）round-robin 到各实例 `:8855`
- business-service / CLI `--base-url http://localhost:8860` 指向负载均衡

## 监控

```bash
curl http://localhost:8855/health
```

关注：

- `gpu_job_running`
- `queue_depth`
- `gpu_available: true`

## 禁止

自动化脚本勿使用 `start.bat --cpu`；见 `AGENTS.md`。
