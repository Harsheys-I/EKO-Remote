"""Dependency-free client for the EKO loopback JSON API."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


class EkoAPI:
    def __init__(self, base_url: str, token: str = "") -> None:
        self.base_url = base_url.rstrip("/")
        self.token = token

    def request(self, operation: str, payload: dict[str, Any] | None = None) -> Any:
        payload = payload or {}
        method, path, body = self._route(operation, payload)
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = Request(self.base_url + path, data=data, headers=headers, method=method)
        try:
            timeout = 95 if operation in {"vision.snapshot", "faces.enroll", "message"} else 10
            with urlopen(request, timeout=timeout) as response:
                return json.load(response)
        except HTTPError as exc:
            try:
                detail = json.loads(exc.read().decode()).get("error")
            except Exception:
                detail = None
            raise RuntimeError(detail or f"EKO API returned HTTP {exc.code}") from exc
        except URLError as exc:
            raise RuntimeError(f"Cannot reach EKO API at {self.base_url}: {exc.reason}") from exc

    @staticmethod
    def _route(operation: str, payload: dict[str, Any]) -> tuple[str, str, dict[str, Any] | None]:
        if operation == "health":
            return "GET", "/health", None
        if operation == "events":
            return "GET", f"/events?limit={int(payload.get('limit', 100))}", None
        if operation == "memories":
            return "GET", f"/memories?q={quote(str(payload.get('query', '')))}&limit={int(payload.get('limit', 50))}", None
        if operation == "memory.forget":
            return "DELETE", f"/memory/{int(payload['id'])}", None
        if operation == "chat.history":
            return "GET", "/chat/history", None
        if operation == "chat.forget":
            return "DELETE", "/chat/history", None
        if operation in {"memory.remember", "message", "command", "drive", "settings.update"}:
            path = {
                "memory.remember": "/memory",
                "message": "/message",
                "command": "/command",
                "drive": "/drive",
                "settings.update": "/settings",
            }[operation]
            return "POST", path, payload
        if operation in {"control", "settings.get", "ai"}:
            path = {"control": "/control", "settings.get": "/settings", "ai": "/ai"}[operation]
            return "GET", path, None
        if operation == "vision.snapshot":
            return "POST", "/vision/snapshot", {}
        if operation == "eyes.get":
            return "GET", "/eyes", None
        if operation == "eyes.expression":
            return "POST", "/eyes/expression", payload
        if operation == "faces.list":
            return "GET", "/faces", None
        if operation == "faces.enroll":
            return "POST", "/faces/enroll", {"name": payload.get("name", "")}
        if operation == "faces.delete":
            return "DELETE", f"/faces/{quote(str(payload['face_id']))}", None
        if operation == "follow.get":
            return "GET", "/vision/follow", None
        if operation == "follow.start":
            return "POST", "/vision/follow/start", {}
        if operation == "follow.stop":
            return "POST", "/vision/follow/stop", {}
        if operation == "map.get":
            return "GET", "/map", None
        if operation == "map.reset":
            return "POST", "/map/reset", {}
        if operation == "map.layout.update":
            return "POST", "/map/layout", {"layout": payload.get("layout")}
        if operation == "config.list":
            return "GET", "/config", None
        if operation == "config.update":
            return "POST", f"/config/{quote(str(payload['name']))}", {"values": payload.get("values", {})}
        if operation == "config.batch":
            return "POST", "/config/batch", {
                "changes": payload.get("changes", {}),
                "dry_run": bool(payload.get("dry_run", False)),
            }
        if operation == "wifi.profiles":
            return "GET", "/wifi/profiles", None
        if operation == "wifi.profiles.update":
            return "POST", "/wifi/profiles", {"profiles": payload.get("profiles", [])}
        if operation == "debug.logs":
            return (
                "GET",
                f"/debug/logs?limit={int(payload.get('limit', 300))}"
                f"&after={int(payload.get('after', 0))}",
                None,
            )
        if operation == "terminal.status":
            return "GET", "/terminal/status", None
        raise ValueError(f"Unsupported BLE operation: {operation}")
