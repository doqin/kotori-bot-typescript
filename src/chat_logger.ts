import { Attachment, ChannelType, DMChannel, Guild, Message, User } from "discord.js";
import db from "./database";
import fs from "fs"
import { imageUrlToBase64 } from "./imageUrlToBase64";
import { ktrMessage, UserProfile } from "./types";

type GetMessagesResult = {
    isDM: boolean;
    serverId: string | null;
    messages: ktrMessage[];
};

const configurations = JSON.parse(fs.readFileSync("configurations.json", "utf-8"));

// Abstraction for loading queries
function loadQuery(filename: string): string {
    return fs.readFileSync(`./src/queries/${filename}`, "utf-8");
}

function addUser(user: User) {
    const stmt = db.prepare(loadQuery("insert_user.sql"));
    stmt.run(user.id, user.username, user.displayName);
}

function addServer(server: Guild) {
    const stmt = db.prepare(loadQuery("insert_server.sql"));
    stmt.run(server.id, server.name);
}

function addChannel(channel: any) {
    const isDM: boolean = channel.type === ChannelType.DM;
    if (!isDM && channel.guild) {
        addServer(channel.guild);
    }

    let channelName: string;
    if (isDM) {
        channelName = (channel as DMChannel).recipient?.username ?? "Unknown DM";
    } else {
        channelName = channel.name ?? "Unknown";
    }

    const stmt = db.prepare(loadQuery("insert_channel.sql"));
    stmt.run(channel.id, channelName, isDM ? 1 : 0, isDM ? null : channel.guild.id);
}

export function logMessage(user: User, role: "user" | "model", channel: any, message: Message) {
    addUser(user);
    addChannel(channel);

    const userRow: any = db.prepare(loadQuery("select_user.sql")).get(user.id);
    const channelRow: any = db.prepare(loadQuery("select_channel.sql")).get(channel.id);

    if (!userRow) throw new Error(`User not found in database: ${user.id}`);
    if (!channelRow) throw new Error(`Channel not found in database: ${channel.id}`);

    const stmt = db.prepare(loadQuery("insert_message.sql"));
    const timestamp: string = new Date(message.createdTimestamp).toISOString();
    stmt.run(message.id, userRow.id, channelRow.id, role, message.content, timestamp);

    message.attachments.forEach(async (attachment: Attachment) => {
        if (attachment.contentType?.startsWith("image/")) {
            const base64 = await imageUrlToBase64(attachment.url);
            const attachmentStmt = db.prepare(loadQuery("insert_attachment.sql"));
            attachmentStmt.run(message.id, attachment.contentType, base64);
        }
    });
}

export function getMessages(channel: any): GetMessagesResult | null {
    const channelRow: any = db.prepare(loadQuery("select_channel.sql")).get(channel.id);
    if (!channelRow) return null;

    const stmt = db.prepare(loadQuery("select_messages.sql"));
    const rows = stmt.all(channelRow.id, configurations.message_limit, configurations.message_offset);

    const messages: ktrMessage[] = rows.map((row: any) => ({
        username: row.username,
        display_name: row.display_name,
        content: row.content,
        timestamp: row.timestamp,
        mime_type: row.mime_type ?? null,
        data: row.data ? Buffer.from(row.data) : null
    }));

    return {
        isDM: channelRow.is_dm === 1,
        serverId: channelRow.server_id,
        messages: messages.reverse(),
    };
}

export function saveUserMemory(userId: string, personality: string, summary: string) {
    const stmt = db.prepare(loadQuery("insert_user_memory.sql"));
    stmt.run(userId, personality, summary);
}

export function addUserFact(userId: string, fact: string) {
    const countStmt = db.prepare("SELECT COUNT(*) as count FROM user_facts WHERE user_id = ?");
    const countRow = countStmt.get(userId) as { count: number } | undefined;
    const count = countRow?.count || 0;

    if (count >= configurations.max_facts) {
        db.prepare(loadQuery("delete_user_fact.sql")).run(userId);
    }

    const stmt = db.prepare(loadQuery("insert_user_fact.sql"));
    stmt.run(userId, fact);
}

export function getUserProfile(userId: string): UserProfile | null {
    const stmt = db.prepare(loadQuery("select_user_profile.sql"));
    const row = stmt.get(userId) as { personality: string; summary: string; facts: string | null };

    if (!row) return null;

    return {
        personality: row.personality,
        summary: row.summary,
        facts: row.facts ? row.facts.split("||") : [],
    };
}