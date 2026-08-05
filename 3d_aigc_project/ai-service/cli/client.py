"""HTTP 客户端 — 默认 ai-service :8855，可选 --via-business :8854。"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class AigcClient:
    def __init__(
        self,
        base_url: str = "http://localhost:8855",
        via_business: bool = False,
        timeout: float = 600.0,
    ):
        if via_business and base_url == "http://localhost:8855":
            base_url = "http://localhost:8854"
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.via_business = via_business

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = Request(url, data=data, headers=headers, method=method)
        try:
            with urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code} {path}: {detail}") from exc
        except URLError as exc:
            raise RuntimeError(f"请求失败 {url}: {exc}") from exc

    def health(self) -> Dict[str, Any]:
        return self._request("GET", "/health")

    def image_to_3d(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.via_business:
            return self._request("POST", "/api/generate/image-to-3d", payload)
        return self._request("POST", "/api/generate/image-to-3d", payload)

    def submit_generate(self, payload: Dict[str, Any]) -> str:
        if self.via_business:
            resp = self._request("POST", "/api/generate/image-to-3d", payload)
            data = resp.get("data") or resp
            return str(data.get("task_id") or payload.get("task_id"))
        resp = self._request("POST", "/api/generate/image-to-3d", payload)
        return str(resp.get("task_id") or payload.get("task_id"))

    def get_status(self, task_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/api/generate/status/{task_id}")

    def cancel_task(self, task_id: str) -> Dict[str, Any]:
        return self._request("POST", f"/api/generate/cancel/{task_id}", {})

    def get_result(self, task_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/api/generate/result/{task_id}")

    def wait_task(
        self,
        task_id: str,
        *,
        poll_interval: float = 3.0,
        timeout: float = 3600.0,
    ) -> Dict[str, Any]:
        deadline = time.time() + timeout
        while time.time() < deadline:
            status = self.get_status(task_id)
            st = status.get("status")
            if st in ("completed", "failed", "cancelled"):
                return status
            time.sleep(poll_interval)
        raise TimeoutError(f"任务 {task_id} 等待超时 ({timeout}s)")

    def run_debug_step_direct(
        self,
        step_id: str,
        raw_mesh_path: str,
        inlay_mesh_path: str,
        context: Optional[Dict[str, Any]] = None,
        force: bool = False,
    ) -> Dict[str, Any]:
        body = {
            "raw_mesh_path": str(Path(raw_mesh_path).resolve()),
            "inlay_mesh_path": str(Path(inlay_mesh_path).resolve()),
            "force": force,
        }
        if context:
            body["context"] = context
        return self._request("POST", f"/api/debug/steps/{step_id}/run", body)

    @staticmethod
    def new_task_id(prefix: str = "cli") -> str:
        return f"{prefix}-{uuid.uuid4()}"
