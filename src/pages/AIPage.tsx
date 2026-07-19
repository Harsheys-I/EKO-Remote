import { Bot, BrainCircuit, Camera, ChevronRight, Eraser, Globe2, History, Music2, RefreshCw, Send, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { EkoClient } from "../client";
import { Panel, SectionHeading, Toggle } from "../components/Common";
import type { CapabilityQuotaStatus, EkoEvent, LinkStats, RuntimeSettings, StatusPayload, TemporaryChatStatus } from "../types";

type ChatItem = { role: "user" | "eko"; text: string; at: Date };

const welcome = (): ChatItem => ({
  role: "eko",
  text: "Remote AI channel ready. CHAT keeps five exact exchanges in temporary RAM context and compresses older ones into a tiny rolling summary.",
  at: new Date(),
});

const suggestions = [
  "Introduce yourself and list your capabilities",
  "My name is Harshit and I am building EKO",
  "What am I building?",
  "Calculate 2 ** 40",
];

export function AIPage({ client, status, events, stats, onSettings }: {
  client: EkoClient | null;
  status: StatusPayload | null;
  events: EkoEvent[];
  stats: LinkStats;
  onSettings: (settings: RuntimeSettings) => void;
}) {
  const [chat, setChat] = useState<ChatItem[]>([welcome()]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingGate, setUpdatingGate] = useState<string | null>(null);
  const [history, setHistory] = useState<TemporaryChatStatus | null>(status?.ai.temporary_chat ?? null);
  const latestRoute = events.find((event) => event.name === "conversation.categorized");

  useEffect(() => {
    if (!client) {
      setHistory(null);
      return;
    }
    void client.chatHistory().then(setHistory).catch(() => setHistory(null));
  }, [client]);

  useEffect(() => {
    if (status?.ai.temporary_chat) setHistory(status.ai.temporary_chat);
  }, [
    status?.ai.temporary_chat?.enabled,
    status?.ai.temporary_chat?.exact_exchanges,
    status?.ai.temporary_chat?.summary_words,
    status?.ai.temporary_chat?.total_exchanges,
  ]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!client || !text || busy) return;
    setInput("");
    setBusy(true);
    setError(null);
    setChat((items) => [...items, { role: "user", text, at: new Date() }]);
    try {
      const result = await client.message(text);
      setChat((items) => [...items, { role: "eko", text: result.response ?? "Request completed.", at: new Date() }]);
      setHistory(await client.chatHistory());
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Request failed";
      setError(message);
      setChat((items) => [...items, { role: "eko", text: `I could not complete that request: ${message}`, at: new Date() }]);
    } finally {
      setBusy(false);
    }
  };

  const forgetHistory = async () => {
    if (!client || busy) return;
    if (!window.confirm("Forget EKO's temporary CHAT history? Durable memories will stay intact.")) return;
    setBusy(true);
    setError(null);
    try {
      setHistory(await client.forgetChatHistory());
      setChat([{ role: "eko", text: "Temporary CHAT history forgotten. Durable MEMORY records were not touched.", at: new Date() }]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not forget temporary history");
    } finally {
      setBusy(false);
    }
  };

  const exact = history?.exact_exchanges ?? 0;
  const limit = history?.exact_limit ?? 5;
  const cameraQuota = status?.capability_status?.camera;
  const songQuota = status?.capability_status?.song;

  const updateGate = async (name: string, changes: Partial<RuntimeSettings>) => {
    if (!client || updatingGate) return;
    setUpdatingGate(name);
    setError(null);
    try {
      onSettings(await client.updateSettings(changes));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not update ${name}`);
    } finally {
      setUpdatingGate(null);
    }
  };

  const quotaLabel = (quota: CapabilityQuotaStatus | undefined) => {
    if (!quota?.configured) return "Enable its hardware and dependencies first";
    if (quota.retry_after_seconds > 0) return `Cooldown ${Math.ceil(quota.retry_after_seconds)}s · ${quota.remaining}/${quota.limit} available`;
    return `Ready · ${quota.remaining}/${quota.limit} requests available`;
  };

  return <div className="page-grid ai-page">
    <Panel className="chat-panel">
      <SectionHeading kicker="CONVERSATION ROUTER" title="Talk to EKO" action={<span className={`live-indicator ${stats.connected ? "online" : ""}`}><i />{stats.kind === "ble" ? "BLE channel" : stats.connected ? "AI online" : "Offline"}</span>} />
      <div className="chat-stream">{chat.map((item, index) => <article className={`chat-message ${item.role}`} key={`${item.at.toISOString()}-${index}`}><div className="chat-avatar">{item.role === "eko" ? <Bot size={17} /> : "YOU"}</div><div><header><strong>{item.role === "eko" ? "EKO" : "Operator"}</strong><time>{item.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></header><p>{item.text}</p></div></article>)}</div>
      {error && <p className="inline-error chat-error">{error}</p>}
      <form className="message-composer" onSubmit={send}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={stats.connected ? "Send a request to EKO..." : "Connect to send a request"} disabled={!stats.connected || busy} /><button disabled={!stats.connected || busy || !input.trim()}>{busy ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}</button></form>
    </Panel>

    <div className="ai-sidebar">
      <Panel>
        <SectionHeading kicker="ACTIVE BRAIN" title="Model status" action={<BrainCircuit size={19} />} />
        <dl className="detail-list"><div><dt>Provider</dt><dd>{status?.ai.provider ?? "—"}</dd></div><div><dt>Model</dt><dd>{status?.ai.model ?? "—"}</dd></div><div><dt>CHAT context</dt><dd>{status ? `${exact}/${limit} exact` : "—"}</dd></div><div><dt>Last route</dt><dd>{String(latestRoute?.payload.category ?? "Waiting")}</dd></div></dl>
      </Panel>
      <Panel className="capability-gates-panel">
        <SectionHeading kicker="LIVE CAPABILITY GATES" title="AI tools" action={<SlidersHorizontal size={19} />} />
        <div className="capability-toggle-row"><Globe2 size={17} /><Toggle checked={Boolean(status?.settings.web_search_enabled)} label="Web search" description="Permit Tavily retrieval" disabled={!client || updatingGate !== null} onChange={(value) => void updateGate("web search", { web_search_enabled: value })} /></div>
        <div className="capability-toggle-row"><Camera size={17} /><Toggle checked={Boolean(status?.settings.camera_on_demand)} label="Camera questions" description={quotaLabel(cameraQuota)} disabled={!client || !cameraQuota?.configured || updatingGate !== null} onChange={(value) => void updateGate("camera AI", { camera_on_demand: value })} /></div>
        <div className="capability-toggle-row"><Music2 size={17} /><Toggle checked={Boolean(status?.settings.song_enabled)} label="Song listening" description={quotaLabel(songQuota)} disabled={!client || !songQuota?.configured || updatingGate !== null} onChange={(value) => void updateGate("song recognition", { song_enabled: value })} /></div>
      </Panel>
      <Panel className="temp-history-panel">
        <SectionHeading kicker="RAM-ONLY CONTEXT" title="Temporary chat" action={<History size={19} />} />
        <div className="temp-history-stats"><article><strong>{exact}</strong><span>Exact exchanges</span></article><article><strong>{history?.summary_words ?? 0}</strong><span>Summary words</span></article><article><strong>{history?.total_exchanges ?? 0}</strong><span>Total this run</span></article></div>
        <p>Only CHAT uses this bounded context. It is isolated per user and disappears on restart. Durable MEMORY is separate.</p>
        <button className="history-forget-button" disabled={!client || busy || !(history?.total_exchanges)} onClick={() => void forgetHistory()}><Eraser size={16} />Forget history</button>
      </Panel>
      <Panel className="prompt-panel">
        <SectionHeading kicker="QUICK REQUESTS" title="Suggestions" action={<Sparkles size={18} />} />
        {suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}<ChevronRight size={15} /></button>)}
      </Panel>
    </div>
  </div>;
}
