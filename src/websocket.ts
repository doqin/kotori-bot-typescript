import { TextChannel, DMChannel, ThreadChannel, Message } from "discord.js";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import app from "./app";
import { client } from ".";
import { ktrMessage } from "./common/types";

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
    console.log(`> New client connected`);

    ws.on("message", async (data) => {
        try {
            const messageData = JSON.parse(data.toString());
            let { channel_id, content } = messageData;

            const channel = await client.channels.fetch(channel_id);
            
            if (channel instanceof TextChannel || channel instanceof DMChannel || channel instanceof ThreadChannel) {
                channel.send(content);
            } else {
                console.log(`> Channel ${channel_id} not found or not a text channel.`)
            }
        } catch (error) {
            console.log(`> Error processing message: ${error}`);
        }
    });

    ws.on("close", () => {
        console.log(`> Client disconnected`);
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
    console.log(`> Sent message to clients`);
}

export { server };