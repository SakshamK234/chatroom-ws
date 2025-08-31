import React, {useEffect, useMemo, useRef, useState, useCallback} from "react";

const WS_URL = import .meta.env.VITE_WS_URL || "ws://localhost:3000";

function randName()
{
  const choices = ["Leo", "Oscar", "Josie", "Max"];
  const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
  const pick = choices[Math.floor(Math.random() * choices.length)];
  return `${pick}-${tag}`;
}

const fmtTime = (ts) =>
  new Intl.DateTimeFormat(undefined, {hour: "2-digit", minute: "2-digit"}).format(ts);

export default function App()
{
  const [phase, setPhase] = useState("join");

  const [usernameInp, setUsernameInp] = useState(() => localStorage.getItem("name") || "");
  const [name, setName] = useState("");
  const [selfId, setSelfId] = useState(null);

  const [status, setStatus] = useState("idle");
  const wsRef = useState(null);

  const [users, setUsers] = useState([]);
  const [items, setItems] = useState([]);
  const[draft, setDraft] = useState("");

  const listRef = useRef(null);
  const nearBottomRef = useRef(true);
  useEffect(() => {
    const el = listRef.current;
    if(!el) return;
    const nearBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 24;
    if (nearBottom || nearBottomRef.current)
    {
      el.scrollTop = el.scrollHeight;
    }
  }, [items]);

  const onScroll = () => {
    const el = listRef.current;
    if(!el) return;
    nearBottomRef.current = el.scrollHeight - el.clientHeight - el.scrollTop < 24;
  };

  const wsUrlWithName = useMemo(() => {
    const n = encodeURIComponent(name || "");
    const sep = WS_URL.includes("?") ? "&" : "?";
    return `${WS_URL}${n ? `${sep}name=${n}` : ""}`;
  }, [name]);

  const scheduleReconnect = useCallback(() => {
    reconnectAttempts.current = Math.min(reconnectAttempts.current + 1, 6);
    const delay = Math.min(500 * 2 ** (reconnectAttempts.current - 1), 10000);
    setStatus("reconnecting");
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    reconnectTimer.current = setTimeout(() => connect(), delay);
  }, []);

  const connect = useCallback(() => {
    if(!name.trim()) return;
    if(wsRef.current && (wsRef.current.readystate === WebSocket.OPEN || wsRef.current.readystate === WebSocket.CONNECTING))
    {
      return;
    }
    try {
      setStatus((s) => (s==="open" ? "open" : "connecting"));
      const ws = new WebSocket(wsUrlWithName);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("open");
      };

      ws.onmessage = (ev) => {
        let msg = null;
        try{
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if(!msg || !msg.type) return;

        switch(msg.type) {

          case "ack": {
            if(msg.of === "join" || (msg.payload && msg.payload.of === "join"))
            {
              const id = msg.id ?? msg.payload?.id;
              const finalName = msg.name ?? msg.payload?.name ?? name;
              if(id) setSelfId(id);
              if(finalName)
              {
                setName(finalName);
                localStorage.setItem("name", finalName);
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
            setItems((prev) => [..prev, {kind: "system", id, text, ts}]);
            break;
          }

          case "message": {
            const p = msg.payload ?? msg;
            const id = p.id ?? `m-${p.ts ?? Date.now()}-${Math.random().toString(36).slice(2)}`;
            const from = p.from ?? {id: "?", name: "?"};
            const text = String(p.text ?? "");
            const ts = p.ts ?? Date.now();
            setItems((prev) => [..prev, {kind: "user", id, from, text, ts}]);
            break;
          }
          default:
            break;
        }
      };

      ws.onclose = () => {
        setStatus("Closed");
        scheduleReconnect();
      };
    } catch {
      scheduleReconnect();
    }
  }, [name, scheduleReconnect, wsUrlWithName]);

  useEffect(() => {
    return() => {
      if(reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if(wsRef.current) try {wsRef.current.close();} catch {}
    };
  }, []);

  
}