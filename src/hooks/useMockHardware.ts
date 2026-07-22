import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { EkoClient } from "../client";
import { websocketAuthProtocol, websocketUrl } from "../transports/websocketAuth";
import type { ConnectionProfile, LinkStats, MockMotion, RuntimeSettings } from "../types";

type MockMessage = Record<string, unknown> & { type?: string };
type BrowserDevices = { microphone: boolean; camera: boolean; speaker: boolean; gamepad: boolean };

export interface MockHardwareController {
  active: boolean;
  connecting: boolean;
  cameraActive: boolean;
  error: string | null;
  warning: string | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  motion: MockMotion;
  devices: BrowserDevices;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  sendSensorReadings: (readings: Record<string, number>) => void;
}

const stoppedMotion: MockMotion = { vx: 0, vy: 0, wz: 0, wheels: {}, receivedAt: 0 };
const stoppedDevices: BrowserDevices = { microphone: false, camera: false, speaker: false, gamepad: false };

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

async function requestBrowserMicrophone(): Promise<{ stream: MediaStream | null; warning: string | null }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { stream: null, warning: "This browser cannot provide microphone audio. Camera, gamepad, and simulation remain available." };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    return { stream, warning: null };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return { stream: null, warning: `Microphone access is unavailable (${detail}). Camera, gamepad, and simulation remain available.` };
  }
}

async function waitForVideoFrame(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => finish(new Error("Camera did not produce a frame in time")), 8000);
    const ready = () => finish();
    const failed = () => finish(new Error("Browser camera could not start"));
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("canplay", ready);
      video.removeEventListener("error", failed);
      if (error) reject(error); else resolve();
    };
    video.addEventListener("loadeddata", ready, { once: true });
    video.addEventListener("canplay", ready, { once: true });
    video.addEventListener("error", failed, { once: true });
  });
}

async function canvasJpeg(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Canvas JPEG capture is unavailable")), "image/jpeg", 0.82);
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export function useMockHardware(
  client: EkoClient | null,
  profile: ConnectionProfile,
  stats: LinkStats,
  onSettings: (settings: RuntimeSettings) => void,
): MockHardwareController {
  const [active, setActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [motion, setMotion] = useState<MockMotion>(stoppedMotion);
  const [devices, setDevices] = useState<BrowserDevices>(stoppedDevices);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const microphoneRef = useRef<MediaStream | null>(null);
  const cameraRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioNodeRef = useRef<ScriptProcessorNode | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const playbackRef = useRef<Set<HTMLAudioElement>>(new Set());
  const captureInFlightRef = useRef(false);
  const lifecycleRef = useRef(0);

  const send = useCallback((payload: MockMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }, []);

  const stopLocal = useCallback((closeSocket = true) => {
    lifecycleRef.current += 1;
    if (heartbeatRef.current !== null) window.clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    if (audioNodeRef.current) {
      audioNodeRef.current.onaudioprocess = null;
      audioNodeRef.current.disconnect();
    }
    audioNodeRef.current = null;
    if (audioContextRef.current) void audioContextRef.current.close();
    audioContextRef.current = null;
    microphoneRef.current?.getTracks().forEach((track) => track.stop());
    microphoneRef.current = null;
    cameraRef.current?.getTracks().forEach((track) => track.stop());
    cameraRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    playbackRef.current.forEach((audio) => { audio.pause(); URL.revokeObjectURL(audio.src); });
    playbackRef.current.clear();
    if (closeSocket && socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
    }
    socketRef.current = null;
    captureInFlightRef.current = false;
    setCameraActive(false);
    setActive(false);
    setDevices(stoppedDevices);
    setMotion(stoppedMotion);
  }, []);

  const captureFrame = useCallback(async (requestId: string) => {
    if (!requestId) return;
    if (captureInFlightRef.current) {
      send({ type: "camera.frame", request_id: requestId, error: "Another camera capture is already in progress" });
      return;
    }
    captureInFlightRef.current = true;
    const lifecycle = lifecycleRef.current;
    setCameraActive(true);
    let camera: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not provide camera access");
      const video = videoRef.current;
      if (!video) throw new Error("Camera capture surface is not ready");
      camera = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (lifecycleRef.current !== lifecycle || socketRef.current?.readyState !== WebSocket.OPEN) {
        throw new Error("Browser hardware session ended before the camera became ready");
      }
      cameraRef.current = camera;
      video.srcObject = camera;
      await video.play();
      await waitForVideoFrame(video);

      const largest = Math.max(video.videoWidth, video.videoHeight);
      const scale = Math.min(1, 1280 / Math.max(1, largest));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas capture is unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const jpeg = await canvasJpeg(canvas);
      send({ type: "camera.frame", request_id: requestId, image_base64: bytesToBase64(jpeg) });
      setDevices((current) => ({ ...current, camera: true }));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (lifecycleRef.current === lifecycle) {
        send({ type: "camera.frame", request_id: requestId, error: message });
        setWarning(`Camera capture failed: ${message}`);
      }
    } finally {
      camera?.getTracks().forEach((track) => track.stop());
      if (cameraRef.current === camera) cameraRef.current = null;
      if (videoRef.current?.srcObject === camera) videoRef.current.srcObject = null;
      if (lifecycleRef.current === lifecycle) {
        captureInFlightRef.current = false;
        setCameraActive(false);
      }
    }
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

  const startAudio = useCallback(async (media: MediaStream | null) => {
    const audioTracks = media?.getAudioTracks() ?? [];
    if (!audioTracks.length) return false;
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
    return true;
  }, [send]);

  const openSocket = useCallback(async (media: MediaStream | null, cameraAvailable: boolean) => {
    const endpoint = websocketUrl(profile.wifiUrl, "/mock/ws");
    const protocol = profile.wifiToken ? websocketAuthProtocol(profile.wifiToken) : undefined;
    const socket = protocol ? new WebSocket(endpoint, [protocol]) : new WebSocket(endpoint);
    socketRef.current = socket;
    await new Promise<void>((resolve, reject) => {
      let ready = false;
      const timeout = window.setTimeout(() => {
        if (!ready) reject(new Error("Browser hardware WebSocket timed out before EKO confirmed the session"));
      }, 10000);
      const failBeforeReady = (message: string) => {
        if (ready) return;
        window.clearTimeout(timeout);
        reject(new Error(message));
      };
      socket.onopen = () => {
        socket.send(JSON.stringify({
          type: "hello",
          microphone: Boolean(media?.getAudioTracks().length),
          camera: cameraAvailable,
          speaker: true,
          gamepad: "getGamepads" in navigator,
          user_agent: navigator.userAgent.slice(0, 240),
        }));
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as MockMessage;
          switch (message.type) {
            case "session.ready":
              ready = true;
              window.clearTimeout(timeout);
              setActive(true);
              setError(null);
              resolve();
              break;
            case "camera.capture": void captureFrame(String(message.request_id ?? "")); break;
            case "speaker.play": playSpeaker(message); break;
            case "motion.command":
              setMotion({
                vx: Number(message.vx ?? 0), vy: Number(message.vy ?? 0), wz: Number(message.wz ?? 0),
                wheels: typeof message.wheels === "object" && message.wheels ? message.wheels as Record<string, number> : {}, receivedAt: performance.now(),
              });
              break;
            case "heartbeat.request": send({ type: "heartbeat", sent_at: Date.now() / 1000 }); break;
            case "session.replaced": setError("This browser hardware session was replaced by another browser."); break;
            case "protocol.error": setWarning(String(message.error ?? "Browser hardware protocol error")); break;
          }
        } catch {
          setWarning("EKO sent an invalid browser hardware message.");
        }
      };
      socket.onerror = () => {
        failBeforeReady("Could not open the authenticated browser hardware channel");
        socket.close();
      };
      socket.onclose = () => {
        failBeforeReady("Browser hardware channel closed before EKO confirmed the session");
        if (socketRef.current === socket) {
          stopLocal(false);
          setError("Browser hardware disconnected. EKO applied an emergency stop.");
        }
      };
    });
    heartbeatRef.current = window.setInterval(() => send({ type: "heartbeat", sent_at: Date.now() / 1000 }), 15000);
  }, [captureFrame, playSpeaker, profile.wifiToken, profile.wifiUrl, send, stopLocal]);

  const enable = useCallback(async () => {
    if (!client || !stats.connected) throw new Error("Connect to EKO before enabling browser hardware.");
    if (profile.kind !== "wifi") throw new Error("Browser hardware requires the HTTPS/WSS Wi-Fi connection, not BLE.");
    setConnecting(true);
    setError(null);
    setWarning(null);
    stopLocal();
    let enabledOnRobot = false;
    try {
      const cameraAvailable = Boolean(navigator.mediaDevices?.getUserMedia);
      const microphone = await requestBrowserMicrophone();
      microphoneRef.current = microphone.stream;
      setWarning(microphone.warning);
      setDevices({
        microphone: Boolean(microphone.stream?.getAudioTracks().length),
        camera: cameraAvailable,
        speaker: true,
        gamepad: "getGamepads" in navigator,
      });
      await openSocket(microphone.stream, cameraAvailable);
      const settings = await client.updateSettings({ mock_mode: true, voice_responses: true });
      enabledOnRobot = true;
      onSettings(settings);

      let microphoneReady = Boolean(microphone.stream?.getAudioTracks().length);
      if (microphoneReady) {
        try {
          microphoneReady = await startAudio(microphone.stream);
        } catch (cause) {
          microphone.stream?.getTracks().forEach((track) => track.stop());
          microphoneRef.current = null;
          microphoneReady = false;
          const detail = cause instanceof Error ? cause.message : String(cause);
          setWarning(`Microphone streaming could not start (${detail}). Other browser hardware remains active.`);
        }
      }
      setDevices((current) => ({ ...current, microphone: microphoneReady }));
      send({ type: "device.status", microphone: microphoneReady, camera: cameraAvailable, speaker: true, gamepad: "getGamepads" in navigator });
    } catch (cause) {
      stopLocal();
      if (enabledOnRobot) {
        try { onSettings(await client.updateSettings({ mock_mode: false })); } catch { /* Pi link may have failed */ }
      }
      const message = cause instanceof Error ? cause.message : "Could not start browser hardware";
      setError(message);
      throw cause;
    } finally {
      setConnecting(false);
    }
  }, [client, onSettings, openSocket, profile.kind, send, startAudio, stats.connected, stopLocal]);

  const disable = useCallback(async () => {
    setError(null);
    setWarning(null);
    // Release browser devices immediately; a slow API acknowledgement must
    // never keep the microphone or an in-flight camera stream alive.
    stopLocal();
    try {
      if (client) onSettings(await client.updateSettings({ mock_mode: false }));
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(`Browser hardware stopped locally, but EKO did not confirm the mode change: ${detail}`);
      throw cause;
    }
  }, [client, onSettings, stopLocal]);

  const sendSensorReadings = useCallback((readings: Record<string, number>) => {
    send({ type: "sensor.telemetry", readings });
  }, [send]);

  useEffect(() => () => stopLocal(), [stopLocal]);
  useEffect(() => {
    if (!stats.connected && active) stopLocal();
  }, [active, stats.connected, stopLocal]);

  return { active, connecting, cameraActive, error, warning, videoRef, motion, devices, enable, disable, sendSensorReadings };
}
