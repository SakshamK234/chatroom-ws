const ws = require("ws");

const server = new ws.WebSocketServer({port: 3000})

//broadcasts messages to every user
function broadcast(obj)
{
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
}

//Generated a random name if the user doesn't pick one. The current list is 4 dogs I know
function randName()
{
    const choices = ["Leo", "Oscar", "Josie", "Max"]
    const pick = choices[Math.floor(Math.random() * animals.length)];
    return '${pick}';
}


let currId = 1; //generates custom IDs

//main backend code
server.on("connection", (ws) => {
    ws.id = String(currId);
    currId++;
    ws.joined = false;
    ws.name = null;

    ws.on("message", (data) => {
        let msg;
        msg = JSON.parse(data.toString());

        const type = msg?.type;

        if(!ws.joined)
        {
            const reqName = msg.text.trim();
            ws.name = requestedName || randName();
            ws.joined = true;

            broadcast({type: "system", text: "${ws.name} has joined"});
            broadcast({type: "users", users: userList()});
            return;
        }

        if(type == "message")
        {
            const text = msg.text.trim();
            broadcast({type: "message", from: {id:ws.id, name: ws.name}, text});
            return;
        }
    })

    ws.on("close", () => {
        if(ws.joined)
        {
            broadcast({type: "system", text: "${ws.name} has left"});
            broadcast({type: "users", users: userList()});
        }
    })
})