import { Router } from "express";
import { loadQuery } from "./chat_logger";
import configurations from "./configurations";
import connectDB from "./connectDB";
import { addLog } from ".";

export const router = Router();

router.get("/channels", async (req, res) => {
    const db = await connectDB();
    const channels = await db.all(loadQuery("select_channels.sql"));
    res.json(channels);
    addLog(`> Sent channels`);
});

// Get messages from a specific channel
router.get("/messages/:channel_id", async (req, res) => {
    const db = await connectDB();
    const { channel_id } = req.params;

    const limit = parseInt(req.query.limit as string) || configurations.message_limit;
    const before = req.query.before as string | undefined;
    let query = "SELECT messages.id AS message_id, messages.user_id, users.username, users.display_name, messages.channel_id, messages.role, messages.content, messages.timestamp, message_attachments.mime_type, message_attachments.data FROM messages JOIN users ON messages.user_id = users.id LEFT JOIN message_attachments ON messages.id = message_attachments.message_id WHERE messages.channel_id = ?";

    let params: any[] = [channel_id];

    if (before) {
        query += "AND timestamp < ? ";
        params.push(before);
    }

    query += "ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);

    const messages = await db.all(query, params);
    res.json(messages);
    addLog(`> Sent messages from ${channel_id}`);
});

// Get user profile
router.get("/user_profile/:user_id", async (req, res) => {
    const db = await connectDB();
    const { user_id } = req.params;

    const profile = await db.get(loadQuery("select_user_profile"), [user_id]);
    res.json(profile || {});
});