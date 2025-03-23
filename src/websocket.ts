import { TextChannel, DMChannel, ThreadChannel, Message } from "discord.js";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import app from "./app";
import { addLog, client } from ".";
import { ktrMessage } from "./types";

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
    addLog(`> New client connected`);

    ws.on("message", async (data) => {
        try {
            const messageData = JSON.parse(data.toString());
            let { channel_id, content } = messageData;

            const channel = await client.channels.fetch(channel_id);
            
            if (channel instanceof TextChannel || channel instanceof DMChannel || channel instanceof ThreadChannel) {
                channel.send(content);
            } else {
                addLog(`> Channel ${channel_id} not found or not a text channel.`)
            }
        } catch (error) {
            addLog(`> Error processing message: ${error}`);
        }
    });

    ws.on("close", () => {
        addLog(`> Client disconnected`);
    });
});

export function sendMessageToClients(message: Message) {
    const messageData = {
        user_id: message.author.id,
        channel_id: message.channel.id,
        username: message.author.username,
        display_name: message.author.username,
        content: message.content,
        timestamp: new Date(message.createdTimestamp).toISOString()
    };

    const messageString = JSON.stringify(messageData);

    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
    addLog(`> Sent message to clients`);
}

export { server };