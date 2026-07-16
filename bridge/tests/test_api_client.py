from __future__ import annotations

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from api_client import EkoAPI


class Handler(BaseHTTPRequestHandler):
    calls: list[dict[str, object]] = []

    def log_message(self, *_: object) -> None:
        pass

    def _reply(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length)) if length else None
        self.calls.append({"method": self.command, "path": self.path, "body": body, "authorization": self.headers.get("Authorization")})
        payload = json.dumps({"ok": True, "path": self.path}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    do_GET = _reply
    do_POST = _reply
    do_DELETE = _reply


class APIClientTests(unittest.TestCase):
    def setUp(self) -> None:
        Handler.calls = []
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.api = EkoAPI(f"http://127.0.0.1:{self.server.server_port}", "secret")

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_routes_and_authorization(self) -> None:
        self.api.request("message", {"text": "hello"})
        self.api.request("memory.forget", {"id": 7})
        self.api.request("memories", {"query": "robot project", "limit": 4})
        self.assertEqual(Handler.calls[0], {"method": "POST", "path": "/message", "body": {"text": "hello"}, "authorization": "Bearer secret"})
        self.assertEqual(Handler.calls[1]["method"], "DELETE")
        self.assertEqual(Handler.calls[1]["path"], "/memory/7")
        self.assertEqual(Handler.calls[2]["path"], "/memories?q=robot%20project&limit=4")

    def test_unknown_operation_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "Unsupported BLE operation"):
            self.api.request("not.real")


if __name__ == "__main__":
    unittest.main()
