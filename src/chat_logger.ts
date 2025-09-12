import { Attachment, ChannelType, DMChannel, Guild, Message, User } from "discord.js";
import db from "./database";
import fs from "fs"
import { imageUrlToBase64 } from "./helpers/imageUrlToBase64";
import { ktrChatHistory, ktrMessage, UserProfile } from "./common/types";
import configurations from "./common/configurations";

// Abstraction for loading queries
export function loadQuery(filename: string): string {
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

export function logMessage(user: User, role: "user" | "assistant", channel: any, message: Message) {
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

export function getChannelMessages(
    channel: any, 
    limit: number = configurations.message_limit,
    offset: number = configurations.message_offset
): ktrChatHistory | null {
    const channelRow: any = db.prepare(loadQuery("select_channel.sql")).get(channel.id);
    if (!channelRow) return null;

    const stmt = db.prepare(loadQuery("select_channel_messages.sql"));
    const rows = stmt.all(channelRow.id, limit, offset);

    if (rows.length === 0) return null;

    const messages: ktrMessage[] = rows.map((row: any) => ({
        username: row.username,
        display_name: row.display_name,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp,
        mime_type: row.mime_type ?? null,
        data: row.data ? row.data : null
    }));

    return {
        isDM: channelRow.is_dm === 1,
        serverId: channelRow.server_id,
        messages: messages.reverse(),
    };
}

export function getUserMessages(
    user: any,
    limit: number = configurations.message_limit,
    offset: number = configurations.message_offset
): ktrMessage[] | [] {
    const userRow: any = db.prepare(loadQuery("select_user.sql")).get(user.id);
    if (!userRow) return [];

    const stmt = db.prepare(loadQuery("select_user_messages.sql"));
    const rows = stmt.all(userRow.id, limit, offset);

    if (rows.length === 0) return [];

    const messages: ktrMessage[] = rows.map((row: any) => ({
        username: row.username,
        display_name: row.display_name,
        role: row.role,
        content: row.content,
        timestamp: row.timestamp,
        mime_type: row.mime_type ?? null,
        data: row.data ? row.data : null
    }));

    return messages.reverse();
}

export function saveUserMemory(userId: string, summary: string) {
    const stmt = db.prepare(loadQuery("insert_user_memory.sql"));
    stmt.run(userId, summary);
}

export function getUserProfile(user: User): UserProfile | null {
    const stmt = db.prepare(loadQuery("select_user_profile.sql"));
    const row = stmt.get(user.id) as { personality: string; summary: string; facts: string | null };

    if (!row) return null;

    return {
        summary: row.summary
    };
}