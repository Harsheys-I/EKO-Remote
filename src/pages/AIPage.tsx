import { Bot, BrainCircuit, ChevronRight, Mic, RefreshCw, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import type { EkoClient } from "../client";
import { Panel, SectionHeading, Toggle } from "../components/Common";
import type { EkoEvent, LinkStats, RuntimeSettings, StatusPayload } from "../types";

type ChatItem = { role: "user" | "eko"; text: string; at: Date };

const suggestions = [
  "Introduce yourself and list your capabilities",
  "Remember that EKO is my robotics project",
  "What do you remember about me?",
  "Calculate 2 ** 40",
];

export function AIPage({ client, status, events, stats, onSettings }: { client: EkoClient | null; status: StatusPayload | null; events: EkoEvent[]; stats: LinkStats; onSettings: (settings: RuntimeSettings) => void }) {
  const [chat, setChat] = useState<ChatItem[]>([
    { role: "eko", text: "Remote AI channel ready. Each request is stateless unless it is explicitly routed to MEMORY.", at: new Date() },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settings = status?.settings;
  const latestRoute = events.find((event) => event.name === "conversation.categorized");

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
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Request failed";
      setError(message);
      setChat((items) => [...items, { role: "eko", text: `I could not complete that request: ${message}`, at: new Date() }]);
    } finally {
      setBusy(false);
    }
  };

  const update = async (changes: Partial<RuntimeSettings>) => {
    if (!client) return;
    try {
      onSettings(await client.updateSettings(changes));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update AI setting");
    }
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
        <dl className="detail-list"><div><dt>Provider</dt><dd>{status?.ai.provider ?? "—"}</dd></div><div><dt>Model</dt><dd>{status?.ai.model ?? "—"}</dd></div><div><dt>Context</dt><dd>{status ? "Stateless" : "—"}</dd></div><div><dt>Last route</dt><dd>{String(latestRoute?.payload.category ?? "Waiting")}</dd></div></dl>
      </Panel>
      <Panel>
        <SectionHeading kicker="VOICE & CONTEXT" title="Behavior" action={<Mic size={19} />} />
        <Toggle checked={Boolean(settings?.voice_responses)} label="Voice responses" description="Speak replies through EKO" disabled={!client} onChange={(value) => void update({ voice_responses: value })} />
        <Toggle checked={Boolean(settings?.wakeword_enabled)} label="Wake word" description="Listen for the configured phrase" disabled={!client || !settings?.audio_enabled} onChange={(value) => void update({ wakeword_enabled: value })} />
        <Toggle checked={false} label="Stateless CHAT" description="Past messages are never sent to Groq" disabled onChange={() => undefined} />
        <Toggle checked={Boolean(settings?.web_search_enabled)} label="Web search" description="Allow grounded current-information routing" disabled={!client} onChange={(value) => void update({ web_search_enabled: value })} />
      </Panel>
      <Panel className="prompt-panel">
        <SectionHeading kicker="QUICK REQUESTS" title="Suggestions" action={<Sparkles size={18} />} />
        {suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}<ChevronRight size={15} /></button>)}
      </Panel>
    </div>
  </div>;
}
