const { WebSocketServer, WebSocket } = require("ws");
const server = new WebSocketServer({ port: 3000 });

// broadcasts messages to every user
function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const client of server.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

// return the list of current users who have already joined
function userList() {
  const ulist = [];
  for (const client of server.clients) {
    if (client.readyState === WebSocket.OPEN && client.joined) {
      ulist.push({ id: client.id, name: client.name });
    }
  }
  return ulist;
}

// random name
function randName() {
  const choices = ["Leo", "Oscar", "Josie", "Max"];
  const pick = choices[Math.floor(Math.random() * choices.length)];
  const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${pick}-${tag}`;
}

let currId = 1;

server.on("connection", (ws) => {
  ws.id = String(currId++);
  ws.joined = true;             // you’re auto-joining everyone
  ws.name = randName();

  // tell THIS client their id & final name (helps the frontend set 'You')
  ws.send(JSON.stringify({ type: "ack", of: "join", id: ws.id, name: ws.name }));

  // announce to room + update roster
  broadcast({ type: "system", text: `${ws.name} has joined` });
  broadcast({ type: "users", users: userList() });

  ws.on("message", (data) => {
    const text = data.toString();

    // rename command
    if (text.startsWith("/name ")) {
      const newName = text.slice(6).trim();
      if (newName) {
        const old = ws.name;
        ws.name = newName;
        broadcast({ type: "system", text: `${old} is now ${ws.name}` });
        broadcast({ type: "users", users: userList() });
      }
      return;
    }

    // regular chat
    const msg = text.trim();
    if (!msg) return;

    broadcast({
      type: "message",
      from: { id: ws.id, name: ws.name },
      text: msg,
      ts: Date.now(),
    });
  });

  ws.on("close", () => {
    if (ws.joined) {
      broadcast({ type: "system", text: `${ws.name} has left` });
      broadcast({ type: "users", users: userList() });
    }
  });
});

console.log("Server is running on ws://localhost:3000");
