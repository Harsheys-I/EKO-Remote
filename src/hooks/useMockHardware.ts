import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { EkoClient } from "../client";
import { websocketAuthProtocol, websocketUrl } from "../transports/websocketAuth";
import type { ConnectionProfile, LinkStats, MockMotion, RuntimeSettings } from "../types";

type MockMessage = Record<string, unknown> & { type?: string };

export interface MockHardwareController {
  active: boolean;
  connecting: boolean;
  error: string | null;
  stream: MediaStream | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  motion: MockMotion;
  devices: { microphone: boolean; camera: boolean; speaker: boolean };
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  sendSensorReadings: (readings: Record<string, number>) => void;
}

const stoppedMotion: MockMotion = { vx: 0, vy: 0, wz: 0, wheels: {}, receivedAt: 0 };

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return window.btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function downsample(input: Float32Array, sourceRate: number, targetRate = 16000) {
  if (sourceRate <= targetRate) return input;
  const ratio = sourceRate / targetRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio));
    let total = 0;
    for (let cursor = start; cursor < end; cursor += 1) total += input[cursor];
    output[index] = total / Math.max(1, end - start);
  }
  return output;
}

async function requestBrowserMedia() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not provide camera/microphone access.");
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "environment" } });
  } catch (combinedError) {
    const tracks: MediaStreamTrack[] = [];
    const failures: string[] = [];
    try { tracks.push(...(await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks()); }
    catch (cause) { failures.push(`microphone: ${cause instanceof Error ? cause.message : String(cause)}`); }
    try { tracks.push(...(await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })).getTracks()); }
    catch (cause) { failures.push(`camera: ${cause instanceof Error ? cause.message : String(cause)}`); }
    if (!tracks.length) throw new Error(failures.join("; ") || (combinedError instanceof Error ? combinedError.message : "Media permission was denied"));
    return new MediaStream(tracks);
  }
}

export function useMockHardware(
  client: EkoClient | null,
  profile: ConnectionProfile,
  stats: LinkStats,
  onSettings: (settings: RuntimeSettings) => void,
): MockHardwareController {
  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [motion, setMotion] = useState<MockMotion>(stoppedMotion);
  const [devices, setDevices] = useState({ microphone: false, camera: false, speaker: false });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodeRef = useRef<ScriptProcessorNode | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const playbackRef = useRef<Set<HTMLAudioElement>>(new Set());

  const send = useCallback((payload: MockMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }, []);

  const stopLocal = useCallback((closeSocket = true) => {
    if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    if (audioNodeRef.current) {
      audioNodeRef.current.onaudioprocess = null;
      audioNodeRef.current.disconnect();
    }
    audioNodeRef.current = null;
    if (audioContextRef.current) void audioContextRef.current.close();
    audioContextRef.current = null;
    mediaRef.current?.getTracks().forEach((track) => track.stop());
    mediaRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    playbackRef.current.forEach((audio) => { audio.pause(); URL.revokeObjectURL(audio.src); });
    playbackRef.current.clear();
    if (closeSocket && socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
    }
    socketRef.current = null;
    setStream(null);
    setActive(false);
    setDevices({ microphone: false, camera: false, speaker: false });
    setMotion(stoppedMotion);
  }, []);

  const captureFrame = useCallback((requestId: string) => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      send({ type: "camera.frame", request_id: requestId, error: "Browser camera has no ready video frame" });
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(video.videoWidth, 1280);
    canvas.height = Math.round(canvas.width * video.videoHeight / video.videoWidth);
    const context = canvas.getContext("2d");
    if (!context) {
      send({ type: "camera.frame", request_id: requestId, error: "Canvas capture is unavailable" });
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.86);
    send({ type: "camera.frame", request_id: requestId, image_base64: data.split(",", 2)[1] });
  }, [send]);

  const playSpeaker = useCallback((message: MockMessage) => {
    try {
      const bytes = base64ToBytes(String(message.audio_base64 ?? ""));
      const blob = new Blob([bytes], { type: String(message.mime_type ?? "audio/mpeg") });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      playbackRef.current.add(audio);
      const cleanup = () => { playbackRef.current.delete(audio); URL.revokeObjectURL(url); };
      audio.onended = () => { cleanup(); send({ type: "speaker.ended" }); };
      audio.onerror = () => { cleanup(); send({ type: "speaker.error", error: "Browser playback failed" }); };
      void audio.play().catch((cause) => {
        cleanup();
        send({ type: "speaker.error", error: cause instanceof Error ? cause.message : String(cause) });
      });
    } catch (cause) {
      send({ type: "speaker.error", error: cause instanceof Error ? cause.message : String(cause) });
    }
  }, [send]);

  const startAudio = useCallback(async (media: MediaStream) => {
    const audioTracks = media.getAudioTracks();
    if (!audioTracks.length) return;
    const context = new AudioContext();
    await context.resume();
    const source = context.createMediaStreamSource(new MediaStream(audioTracks));
    const processor = context.createScriptProcessor(2048, 1, 1);
    const silent = context.createGain();
    silent.gain.value = 0;
    const pending: number[] = [];
    processor.onaudioprocess = (event) => {
      const samples = downsample(event.inputBuffer.getChannelData(0), context.sampleRate, 16000);
      for (const sample of samples) pending.push(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))));
      while (pending.length >= 1280) {
        const frame = new Int16Array(pending.splice(0, 1280));
        send({ type: "audio.chunk", pcm_base64: bytesToBase64(new Uint8Array(frame.buffer)) });
      }
    };
    source.connect(processor);
    processor.connect(silent);
    silent.connect(context.destination);
    audioContextRef.current = context;
    audioNodeRef.current = processor;
  }, [send]);

  const openSocket = useCallback(async (media: MediaStream) => {
    const endpoint = websocketUrl(profile.wifiUrl, "/mock/ws");
    const protocol = profile.wifiToken ? websocketAuthProtocol(profile.wifiToken) : undefined;
    const socket = protocol ? new WebSocket(endpoint, [protocol]) : new WebSocket(endpoint);
    socketRef.current = socket;
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("Mock hardware WebSocket timed out")), 10000);
      socket.onopen = () => {
        window.clearTimeout(timeout);
        socket.send(JSON.stringify({
          type: "hello",
          microphone: media.getAudioTracks().length > 0,
          camera: media.getVideoTracks().length > 0,
          speaker: true,
          gamepad: "getGamepads" in navigator,
          user_agent: navigator.userAgent.slice(0, 240),
        }));
        resolve();
      };
      socket.onerror = () => { window.clearTimeout(timeout); reject(new Error("Could not open the authenticated mock hardware channel")); };
    });
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as MockMessage;
        switch (message.type) {
          case "session.ready":
            setActive(true);
            setError(null);
            break;
          case "camera.capture": captureFrame(String(message.request_id ?? "")); break;
          case "speaker.play": playSpeaker(message); break;
          case "motion.command":
            setMotion({
              vx: Number(message.vx ?? 0), vy: Number(message.vy ?? 0), wz: Number(message.wz ?? 0),
              wheels: typeof message.wheels === "object" && message.wheels ? message.wheels as Record<string, number> : {}, receivedAt: performance.now(),
            });
            break;
          case "heartbeat.request": send({ type: "heartbeat", sent_at: Date.now() / 1000 }); break;
          case "session.replaced": setError("This mock session was replaced by another browser."); break;
          case "protocol.error": setError(String(message.error ?? "Mock protocol error")); break;
        }
      } catch { setError("The Pi sent an invalid mock hardware message."); }
    };
    socket.onclose = () => {
      if (socketRef.current === socket) {
        stopLocal(false);
        setError("Mock hardware channel disconnected. EKO applied an emergency stop.");
      }
    };
    socket.onerror = () => socket.close();
    heartbeatRef.current = window.setInterval(() => send({ type: "heartbeat", sent_at: Date.now() / 1000 }), 15000);
  }, [captureFrame, playSpeaker, profile.wifiToken, profile.wifiUrl, send, stopLocal]);

  const enable = useCallback(async () => {
    if (!client || !stats.connected) throw new Error("Connect to EKO before enabling mock mode.");
    if (profile.kind !== "wifi") throw new Error("Mock hardware needs the HTTPS/WSS Wi-Fi connection, not BLE.");
    if (!window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      throw new Error("Camera and microphone access requires an HTTPS website.");
    }
    setConnecting(true);
    setError(null);
    stopLocal();
    try {
      const media = await requestBrowserMedia();
      mediaRef.current = media;
      setStream(media);
      setDevices({ microphone: media.getAudioTracks().length > 0, camera: media.getVideoTracks().length > 0, speaker: true });
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play().catch(() => undefined);
      }
      const settings = await client.updateSettings({ mock_mode: true, voice_responses: true });
      onSettings(settings);
      await openSocket(media);
      await startAudio(media);
      send({ type: "device.status", microphone: media.getAudioTracks().length > 0, camera: media.getVideoTracks().length > 0, speaker: true });
    } catch (cause) {
      stopLocal();
      try { onSettings(await client.updateSettings({ mock_mode: false })); } catch { /* Pi link may have failed */ }
      const message = cause instanceof Error ? cause.message : "Could not start browser mock hardware";
      setError(message);
      throw cause;
    } finally {
      setConnecting(false);
    }
  }, [client, onSettings, openSocket, profile.kind, send, startAudio, stats.connected, stopLocal]);

  const disable = useCallback(async () => {
    stopLocal();
    setError(null);
    if (client) onSettings(await client.updateSettings({ mock_mode: false }));
  }, [client, onSettings, stopLocal]);

  const sendSensorReadings = useCallback((readings: Record<string, number>) => {
    send({ type: "sensor.telemetry", readings });
  }, [send]);

  useEffect(() => () => stopLocal(), [stopLocal]);
  useEffect(() => {
    if (!stats.connected && active) stopLocal();
  }, [active, stats.connected, stopLocal]);
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [stream]);

  return { active, connecting, error, stream, videoRef, motion, devices, enable, disable, sendSensorReadings };
}
