const { WebSocketServer, WebSocket } = require("ws");
const http = require("http");
const url = require("url");

const PORT = process.env.PORT || 3000;
const wss = new WebSocketServer({ noServer: true });

function randName() {
  const choices = ["Leo", "Oscar", "Josie", "Max"];
  const pick = choices[Math.floor(Math.random() * choices.length)];
  const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${pick}-${tag}`;
}

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function userList() {
  const list = [];
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.joined) {
      list.push({ id: client.id, name: client.name });
    }
  }
  return list;
}

let nextId = 1;

wss.on("connection", (ws, req) => {
  ws.id = String(nextId++);
  ws.joined = false;

  let requested = "";
  try {
    const { query } = url.parse(req.url, true);
    requested = (query.name || "").toString().trim();
  } catch {}

  ws.name = (requested || randName()).slice(0, 24);
  ws.joined = true;

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ack", of: "join", id: ws.id, name: ws.name }));
  }

  broadcast({ type: "system", text: `${ws.name} has joined`, ts: Date.now() });
  broadcast({ type: "users", users: userList() });

  ws.on("message", (raw, isBinary) => {
    if (isBinary) return;
    const text = raw.toString().trim();
    if (!text) return;

    // Rename command
    if (text.startsWith("/name ")) {
      const newName = text.slice(6).trim().slice(0, 24);
      if (newName) {
        const old = ws.name;
        ws.name = newName;
        broadcast({ type: "system", text: `${old} is now ${ws.name}`, ts: Date.now() });
        broadcast({ type: "users", users: userList() });
      }
      return;
    }

    //Normal chat
    broadcast({
      type: "message",
      from: { id: ws.id, name: ws.name },
      text,
      ts: Date.now(),
    });
  });

  ws.on("close", () => {
    if (ws.joined) {
      broadcast({ type: "system", text: `${ws.name} has left`, ts: Date.now() });
      broadcast({ type: "users", users: userList() });
    }
  });
});

const server = http.createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
});

server.listen(PORT, () => {
  console.log(`WS chat listening on ws://localhost:${PORT}  (health: http://localhost:${PORT}/healthz)`);
});
