# EKO BLE protocol v1

## GATT service

| Purpose | UUID | Properties |
| --- | --- | --- |
| EKO service | `7ad20001-8e45-4a2f-9d3b-2c8e7f1a0001` | Primary service |
| Command input | `7ad20002-8e45-4a2f-9d3b-2c8e7f1a0001` | Write |
| Telemetry/output | `7ad20003-8e45-4a2f-9d3b-2c8e7f1a0001` | Read, notify |
| Emergency stop | `7ad20004-8e45-4a2f-9d3b-2c8e7f1a0001` | Write |

Writing any byte to the stop characteristic asks EKO to stop immediately. It does not wait for a framed response.

## Frame layout

Every command or notification is at most 180 bytes. Multi-frame messages may arrive out of order and are keyed by `(kind, message_id)`.

| Offset | Size | Field | Encoding |
| --- | --- | --- | --- |
| 0 | 1 | Version | `1` |
| 1 | 1 | Kind | Enum below |
| 2 | 2 | Message ID | Unsigned big-endian |
| 4 | 2 | Chunk index | Unsigned big-endian, zero-based |
| 6 | 2 | Chunk count | Unsigned big-endian |
| 8 | ≤172 | Payload | UTF-8 JSON fragment |

Kinds:

| Value | Meaning |
| --- | --- |
| `1` | Browser request |
| `2` | Bridge response |
| `3` | Telemetry message |
| `4` | Reserved standalone event |
| `5` | Protocol error |

## Request envelope

```json
{
  "operation": "drive",
  "payload": { "vx": 0.0, "vy": 0.5, "wz": 0.0 },
  "auth": "optional-ble-token",
  "noReply": true
}
```

`noReply` is used for repeated drive traffic. Requests that need data omit it and receive a response with the same message ID.

## Response envelope

```json
{ "ok": true, "data": {} }
```

or:

```json
{ "ok": false, "error": "Human-readable failure" }
```

## Operations

`health`, `events`, `memories`, `memory.remember`, `memory.forget`, `message`, `command`, `drive`, `control`, `settings.get`, `settings.update`, `ai`, `vision.snapshot`, `config.list`, and `config.update` map directly to EKO's v0.3.2 control API.

## Telemetry

The bridge sends a complete transport-neutral telemetry object once per second:

```json
{
  "type": "telemetry",
  "sent_at": 1784200000.0,
  "status": {},
  "events": []
}
```

The browser deduplicates events by timestamp, name, and correlation ID.

## Limits and failure behavior

- Maximum payload is 65,535 × 172 bytes.
- Incomplete assemblies expire after 30 seconds.
- Normal requests time out in the browser after 12 seconds; snapshots allow 90 seconds.
- GATT writes are serialized.
- Malformed frames are discarded.
- If a connection fails during motion, the browser stops sending and the robot watchdog stops EKO.
