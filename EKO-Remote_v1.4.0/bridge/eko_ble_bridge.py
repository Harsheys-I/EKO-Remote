#!/usr/bin/env python3
"""Expose EKO's loopback control API as a BLE GATT peripheral."""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import secrets
import signal
from typing import Any

from bless import (  # type: ignore[import-untyped]
    BlessGATTCharacteristic,
    BlessServer,
    GATTAttributePermissions,
    GATTCharacteristicProperties,
)

from api_client import EkoAPI
from protocol import FrameKind, Reassembler, decode_frame, encode_frames


SERVICE_UUID = "7ad20001-8e45-4a2f-9d3b-2c8e7f1a0001"
COMMAND_UUID = "7ad20002-8e45-4a2f-9d3b-2c8e7f1a0001"
TELEMETRY_UUID = "7ad20003-8e45-4a2f-9d3b-2c8e7f1a0001"
STOP_UUID = "7ad20004-8e45-4a2f-9d3b-2c8e7f1a0001"


class EkoBleBridge:
    def __init__(self, api: EkoAPI, name: str = "EKO", ble_token: str = "") -> None:
        self.api = api
        self.name = name
        self.ble_token = ble_token
        self.loop = asyncio.get_running_loop()
        self.server = BlessServer(name=name, loop=self.loop)
        self.reassembler = Reassembler()
        self.send_lock = asyncio.Lock()
        self.running = False
        self.logger = logging.getLogger("eko.ble")
        self.last_log_sequence = 0

    async def start(self) -> None:
        self.server.write_request_func = self._write_request
        await self.server.add_new_service(SERVICE_UUID)
        await self.server.add_new_characteristic(
            SERVICE_UUID,
            COMMAND_UUID,
            GATTCharacteristicProperties.write,
            None,
            GATTAttributePermissions.writable,
        )
        await self.server.add_new_characteristic(
            SERVICE_UUID,
            TELEMETRY_UUID,
            GATTCharacteristicProperties.read | GATTCharacteristicProperties.notify,
            bytearray(),
            GATTAttributePermissions.readable,
        )
        await self.server.add_new_characteristic(
            SERVICE_UUID,
            STOP_UUID,
            GATTCharacteristicProperties.write,
            bytearray(),
            GATTAttributePermissions.writable,
        )
        await self.server.start()
        self.running = True
        self.logger.info("Advertising BLE peripheral %s", self.name)
        asyncio.create_task(self._telemetry_loop())

    async def stop(self) -> None:
        self.running = False
        try:
            await asyncio.to_thread(self.api.request, "command", {"command": "stop"})
        except Exception:
            self.logger.warning("Could not send stop while closing BLE bridge")
        await self.server.stop()

    def _write_request(self, characteristic: BlessGATTCharacteristic, value: Any, **_: Any) -> None:
        characteristic.value = value
        uuid = str(characteristic.uuid).lower()
        if uuid == STOP_UUID:
            self.loop.call_soon_threadsafe(lambda: asyncio.create_task(self._stop_now()))
            return
        if uuid != COMMAND_UUID:
            return
        try:
            complete = self.reassembler.push(decode_frame(bytes(value)))
        except Exception as exc:
            self.logger.warning("Discarding malformed BLE frame: %s", exc)
            return
        if complete is not None:
            _, message_id, request = complete
            self.loop.call_soon_threadsafe(
                lambda: asyncio.create_task(self._handle_request(message_id, request))
            )

    async def _stop_now(self) -> None:
        try:
            await asyncio.to_thread(self.api.request, "command", {"command": "stop"})
        except Exception as exc:
            self.logger.error("BLE emergency stop failed: %s", exc)

    async def _handle_request(self, message_id: int, request: Any) -> None:
        if not isinstance(request, dict):
            await self._send(FrameKind.ERROR, message_id, {"ok": False, "error": "Request must be an object"})
            return
        operation = str(request.get("operation", ""))
        payload = request.get("payload") if isinstance(request.get("payload"), dict) else {}
        no_reply = bool(request.get("noReply", False))
        is_stop = operation == "command" and str(payload.get("command", "")).lower() in {"stop", "emergency stop"}
        if self.ble_token and not is_stop and not secrets.compare_digest(str(request.get("auth", "")), self.ble_token):
            if not no_reply:
                await self._send(FrameKind.RESPONSE, message_id, {"ok": False, "error": "Invalid BLE bridge token"})
            return
        try:
            data = await asyncio.to_thread(self.api.request, operation, payload)
            response = {"ok": True, "data": data}
        except Exception as exc:
            self.logger.warning("BLE operation %s failed: %s", operation, exc)
            response = {"ok": False, "error": str(exc)}
        if not no_reply:
            await self._send(FrameKind.RESPONSE, message_id, response)

    async def _telemetry_loop(self) -> None:
        while self.running:
            try:
                status, events, logs = await asyncio.gather(
                    asyncio.to_thread(self.api.request, "health", {}),
                    asyncio.to_thread(self.api.request, "events", {"limit": 30}),
                    asyncio.to_thread(
                        self.api.request,
                        "debug.logs",
                        {"limit": 12, "after": self.last_log_sequence},
                    ),
                )
                records = [
                    {
                        **record,
                        "message": str(record.get("message", ""))[:700],
                        "exception": (
                            str(record["exception"])[:1200]
                            if record.get("exception")
                            else None
                        ),
                    }
                    for record in logs.get("logs", [])
                    if isinstance(record, dict)
                ]
                if records:
                    self.last_log_sequence = int(records[-1]["sequence"])
                await self._send(
                    FrameKind.TELEMETRY,
                    0,
                    {
                        "type": "telemetry",
                        "sent_at": __import__("time").time(),
                        "status": status,
                        "events": events.get("events", []),
                        "logs": records,
                    },
                )
            except Exception as exc:
                self.logger.debug("BLE telemetry unavailable: %s", exc)
            await asyncio.sleep(1.0)

    async def _send(self, kind: FrameKind, message_id: int, value: Any) -> None:
        characteristic = self.server.get_characteristic(TELEMETRY_UUID)
        if characteristic is None:
            return
        async with self.send_lock:
            for frame in encode_frames(kind, message_id, value):
                characteristic.value = bytearray(frame)
                self.server.update_value(SERVICE_UUID, TELEMETRY_UUID)
                await asyncio.sleep(0.012)


async def run(args: argparse.Namespace) -> None:
    api = EkoAPI(args.api_url, os.getenv("EKO_API_TOKEN", ""))
    bridge = EkoBleBridge(api, name=args.name, ble_token=os.getenv("EKO_BLE_TOKEN", ""))
    stopped = asyncio.Event()
    for signal_name in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(signal_name, stopped.set)
        except NotImplementedError:
            pass
    await bridge.start()
    await stopped.wait()
    await bridge.stop()


def main() -> None:
    parser = argparse.ArgumentParser(description="Expose the EKO control API over Bluetooth LE")
    parser.add_argument("--api-url", default=os.getenv("EKO_API_URL", "http://127.0.0.1:8765"))
    parser.add_argument("--name", default=os.getenv("EKO_BLE_NAME", "EKO"))
    parser.add_argument("--log-level", default=os.getenv("EKO_BLE_LOG_LEVEL", "INFO"))
    args = parser.parse_args()
    logging.basicConfig(level=getattr(logging, args.log_level.upper(), logging.INFO), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
