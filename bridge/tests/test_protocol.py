from __future__ import annotations

import unittest

from protocol import FrameKind, Reassembler, decode_frame, encode_frames


class ProtocolTests(unittest.TestCase):
    def test_large_payload_round_trip_out_of_order(self) -> None:
        value = {"operation": "message", "payload": {"text": "EKO " * 180}}
        frames = encode_frames(FrameKind.REQUEST, 42, value)
        self.assertGreater(len(frames), 1)
        reassembler = Reassembler()
        complete = None
        for frame in reversed(frames):
            complete = reassembler.push(decode_frame(frame)) or complete
        self.assertEqual(complete, (FrameKind.REQUEST, 42, value))

    def test_rejects_short_frame(self) -> None:
        with self.assertRaisesRegex(ValueError, "too short"):
            decode_frame(b"\x01\x02")


if __name__ == "__main__":
    unittest.main()
