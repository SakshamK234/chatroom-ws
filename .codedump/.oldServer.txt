const ws = require("ws");

const server = new ws.WebSocketServer({port: 3000})

//broadcasts messages to every user
function broadcast(obj)
{
    data = JSON.stringify(obj);
    for (const client of server.clients)
    {
        if(client.readyState == WebSocket.OPEN)
        {
            client.send(data);
        }
    }
}

//return the list of current users who have already joined
function userList()
{
    const ulist = []
    for(const client of server.clients)
    {
        if(client.readyState == WebSocket.OPEN)
        {
            ulist.push({id: client.id, name: client.name});
        }
    }
    return ulist;
}

//Generated a random name if the user doesn't pick one. The current list is 4 dogs I know
function randName()
{
    const choices = ["Leo", "Oscar", "Josie", "Max"]
    const pick = choices[Math.floor(Math.random() * choices.length)];
    const tag = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${pick}-${tag}`;
}


let currId = 1; //generates custom IDs

//main backend code
server.on("connection", (ws) => {
    ws.id = String(currId);
    currId++;
    ws.joined = true;
    ws.name = randName();

    broadcast({type: "system", text: `${ws.name} has joined`});
    broadcast({type: "users", users: userList()});

    ws.on("message", (data) => {
        const text = data.toString();

        if(text.startsWith("/name "))
        {
            const newName = text.slice(6).trim();
            if(newName)
            {
                const old = ws.name;
                ws.name = newName;
                broadcast({type: "system", text: `${old} is now ${ws.name}`});
                broadcast({type: "users", users: userList()});
            } 
            return;
        }

        broadcast({type: "message", from: {id: ws.id, name: ws.name}, text: text.trim()});
    });

    ws.on("close", () => {
        if(ws.joined)
        {
            broadcast({type: "system", text: `${ws.name} has left`});
            broadcast({type: "users", users: userList()});
        }
    });
});

console.log('Server is running')