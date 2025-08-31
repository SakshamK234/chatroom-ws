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

  const connect = useCallback(() => {
    
  })
}