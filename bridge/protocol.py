"""Binary BLE framing shared conceptually with the EKO Remote browser."""

from __future__ import annotations

import json
import struct
import time
from dataclasses import dataclass
from enum import IntEnum
from typing import Any


FRAME_VERSION = 1
FRAME_BYTES = 180
HEADER_BYTES = 8
PAYLOAD_BYTES = FRAME_BYTES - HEADER_BYTES


class FrameKind(IntEnum):
    REQUEST = 1
    RESPONSE = 2
    TELEMETRY = 3
    EVENT = 4
    ERROR = 5


@dataclass(frozen=True, slots=True)
class Frame:
    kind: FrameKind
    message_id: int
    chunk_index: int
    chunk_count: int
    payload: bytes


def encode_frames(kind: FrameKind, message_id: int, value: Any) -> list[bytes]:
    payload = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    chunk_count = max(1, (len(payload) + PAYLOAD_BYTES - 1) // PAYLOAD_BYTES)
    if chunk_count > 0xFFFF:
        raise ValueError("BLE message exceeds protocol limit")
    return [
        struct.pack("!BBHHH", FRAME_VERSION, int(kind), message_id, index, chunk_count)
        + payload[index * PAYLOAD_BYTES : (index + 1) * PAYLOAD_BYTES]
        for index in range(chunk_count)
    ]


def decode_frame(value: bytes | bytearray) -> Frame:
    data = bytes(value)
    if len(data) < HEADER_BYTES:
        raise ValueError("BLE frame is too short")
    version, kind, message_id, chunk_index, chunk_count = struct.unpack("!BBHHH", data[:HEADER_BYTES])
    if version != FRAME_VERSION:
        raise ValueError("Unsupported BLE protocol version")
    if not chunk_count or chunk_index >= chunk_count:
        raise ValueError("Invalid BLE chunk metadata")
    return Frame(FrameKind(kind), message_id, chunk_index, chunk_count, data[HEADER_BYTES:])


class Reassembler:
    def __init__(self, ttl_seconds: float = 30.0) -> None:
        self.ttl_seconds = ttl_seconds
        self._messages: dict[tuple[FrameKind, int], tuple[list[bytes | None], float]] = {}

    def push(self, frame: Frame) -> tuple[FrameKind, int, Any] | None:
        now = time.monotonic()
        self._messages = {key: value for key, value in self._messages.items() if value[1] > now}
        key = (frame.kind, frame.message_id)
        chunks, _ = self._messages.get(key, ([None] * frame.chunk_count, now + self.ttl_seconds))
        if len(chunks) != frame.chunk_count:
            chunks = [None] * frame.chunk_count
        chunks[frame.chunk_index] = frame.payload
        self._messages[key] = (chunks, now + self.ttl_seconds)
        if any(chunk is None for chunk in chunks):
            return None
        del self._messages[key]
        value = json.loads(b"".join(chunk for chunk in chunks if chunk is not None).decode("utf-8"))
        return frame.kind, frame.message_id, value
