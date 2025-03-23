import { Server } from "socket.io";
import connectDB from "./connectDB";
import { loadQuery } from "./chat_logger";
import http from "http";
import app from "./app";
import { addLog } from ".";

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
});

io.on("connection", (socket) => {
    addLog(`> New client connected: ${socket.id}`);

    socket.on("send_message", async (messageData) => {
        const db = await connectDB();
        const { id, user_id, channel_id, role, content } = messageData;

        // Insert message into database
        await db.run(loadQuery("insert_message.sql"), [id, user_id, channel_id, role, content]);

        // Broadcast the message to all clients
        io.emit("receive_message", messageData);
    });

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

export { server };