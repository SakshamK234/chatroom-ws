import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3000";

function randName() {
  const choices = ["Leo", "Oscar", "Josie", "Max"];
  const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
  const pick = choices[Math.floor(Math.random() * choices.length)];
  return `${pick}-${tag}`;
}

const fmtTime = (ts) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(ts);

export default function App() {
  // Phases
  const [phase, setPhase] = useState("join"); // 'join' | 'chat'

  // Identity
  const [usernameInput, setUsernameInput] = useState(() => localStorage.getItem("name") || "");
  const [name, setName] = useState("");
  const nameRef = useRef(""); // latest name for reconnects
  const [selfId, setSelfId] = useState(null);

  // Socket state
  const [status, setStatus] = useState("idle"); // 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);

  // Data
  const [users, setUsers] = useState([]);   // [{id, name}]
  const [items, setItems] = useState([]);   // feed: system + user messages
  const [draft, setDraft] = useState("");

  // Auto-scroll
  const listRef = useRef(null);
  const nearBottomRef = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 24;
    if (nearBottom || nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [items]);
  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.clientHeight - el.scrollTop < 24;
  };

  // Build WS URL with ?name=
  const buildWsUrl = useCallback((n) => {
    const enc = encodeURIComponent(n || "");
    const sep = WS_URL.includes("?") ? "&" : "?";
    return `${WS_URL}${enc ? `${sep}name=${enc}` : ""}`;
  }, []);

  const scheduleReconnect = useCallback(() => {
    reconnectAttempts.current = Math.min(reconnectAttempts.current + 1, 6);
    const delay = Math.min(500 * 2 ** (reconnectAttempts.current - 1), 10000);
    setStatus("reconnecting");
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => connect(nameRef.current), delay);
  }, []);

  const connect = useCallback((n) => {
    const finalName = (n || "").trim();
    if (!finalName) return;

    // Avoid duplicate sockets
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      setStatus((s) => (s === "open" ? "open" : "connecting"));
      const ws = new WebSocket(buildWsUrl(finalName));
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("open");
      };

      ws.onmessage = (ev) => {
        let msg = null;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (!msg || !msg.type) return;

        switch (msg.type) {
          case "ack": {
            const of = msg.of ?? msg.payload?.of;
            if (of === "join") {
              const id = msg.id ?? msg.payload?.id;
              const serverName = msg.name ?? msg.payload?.name ?? finalName;
              if (id) setSelfId(id);
              if (serverName) {
                setName(serverName);
                nameRef.current = serverName;
                localStorage.setItem("name", serverName);
              }
              setPhase("chat");
            }
            break;
          }
          case "users": {
            const list = msg.users ?? msg.payload?.users ?? [];
            setUsers(Array.isArray(list) ? list : []);
            break;
          }
          case "system": {
            const text = msg.text ?? msg.payload?.text ?? "";
            const ts = msg.ts ?? msg.payload?.ts ?? Date.now();
            const id = `sys-${ts}-${Math.random().toString(36).slice(2)}`;
            setItems((prev) => [...prev, { kind: "system", id, text, ts }]);
            break;
          }
          case "message": {
            const p = msg.payload ?? msg;
            const id = p.id ?? `m-${p.ts ?? Date.now()}-${Math.random().toString(36).slice(2)}`;
            const from = p.from ?? { id: "?", name: "?" };
            const text = String(p.text ?? "");
            const ts = p.ts ?? Date.now();
            setItems((prev) => [...prev, { kind: "user", id, from, text, ts }]);
            break;
          }
          default:
            break;
        }
      };

      ws.onclose = () => {
        setStatus("closed");
        scheduleReconnect();
      };

      ws.onerror = () => {
        // handled via onclose
      };
    } catch {
      scheduleReconnect();
    }
  }, [buildWsUrl, scheduleReconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, []);

  // Join click
  const handleJoin = () => {
    const chosen = (usernameInput || "").trim() || randName();
    setName(chosen);
    nameRef.current = chosen;
    localStorage.setItem("name", chosen);
    connect(chosen);            // pass the name directly (avoids stale state)
    setPhase("chat");
  };

  // Send a plain-text message
  const sendMessage = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const text = draft.trim();
    if (!text) return;
    ws.send(text);
    setDraft("");
  };

  const onlineCount = users.length;
  const connected = status === "open";

  return (
    <div className="app">
      <header className="header">
        <div className="brand">WS Chat</div>
        <div className="header-right">
          {phase === "chat" && <span className="badge">{onlineCount} online</span>}
          <ConnPill state={status} />
        </div>
      </header>

      {phase === "join" ? (
        <section className="join">
          <h2>Choose a username</h2>
          <input
            className="input"
            placeholder="e.g., Alice (leave blank for random)"
            maxLength={24}
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
          <button className="btn" onClick={handleJoin}>Join Chat</button>
          <p className="hint">Server URL: <code>{WS_URL}</code></p>
        </section>
      ) : (
        <section className="layout">
          <aside className="sidebar">
            <h3>People</h3>
            <ul className="people">
              {users.map((u) => (
                <li key={u.id}>
                  <span className={u.id === selfId ? "me" : ""}>
                    {u.name}{u.id === selfId ? " (you)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          <main className="main">
            <div className="messages" ref={listRef} onScroll={onScroll} aria-live="polite">
              {items.map((m) =>
                m.kind === "system" ? (
                  <div key={m.id} className="system">
                    <span>{m.text}</span>
                    <time className="time">{fmtTime(m.ts)}</time>
                  </div>
                ) : (
                  <div
                    key={m.id}
                    className={`bubble ${m.from.id === selfId ? "self" : "other"}`}
                    title={fmtTime(m.ts)}
                  >
                    <div className="bubble-head">
                      <strong>{m.from.id === selfId ? "You" : m.from.name}</strong>
                      <time className="time">{fmtTime(m.ts)}</time>
                    </div>
                    <div>{m.text}</div>
                  </div>
                )
              )}
            </div>

            <div className="composer">
              <textarea
                className="textarea"
                placeholder={connected ? "Type a message…" : "Reconnecting…"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={!connected}
                maxLength={1000}
              />
              <button className="send" onClick={sendMessage} disabled={!connected || !draft.trim()}>
                Send
              </button>
            </div>
          </main>
        </section>
      )}
    </div>
  );
}

function ConnPill({ state }) {
  const label =
    state === "open" ? "Connected" :
    state === "connecting" ? "Connecting…" :
    state === "reconnecting" ? "Reconnecting…" :
    state === "closed" ? "Offline" : "Idle";

  const cls =
    state === "open" ? "pill green" :
    state === "connecting" ? "pill amber" :
    state === "reconnecting" ? "pill red" :
    "pill gray";

  return <span className={cls} aria-live="polite">{label}</span>;
}
