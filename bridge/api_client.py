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
            with urlopen(request, timeout=95 if operation == "vision.snapshot" else 10) as response:
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
        if operation == "config.list":
            return "GET", "/config", None
        if operation == "config.update":
            return "POST", f"/config/{quote(str(payload['name']))}", {"values": payload.get("values", {})}
        raise ValueError(f"Unsupported BLE operation: {operation}")
