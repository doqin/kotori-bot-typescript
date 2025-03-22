import { ChannelType, DMChannel, Guild, Message } from "discord.js";
import db from "./database";
import fs from "fs"

type User = {
    id: string,
    username: string
};

type GetMessage = {
    username: string;
    content: string;
    timestamp: string;
};

type GetMessagesResult = {
    isDM: boolean;
    serverId: string | null;
    messages: GetMessage[];
};

function loadQuery(filename: string): string {
    return fs.readFileSync(`./src/queries/${filename}`, "utf-8");
}

export function addUser(user: User) {
    const stmt = db.prepare(loadQuery("insert_user.sql"));
    stmt.run(user.id, user.username);
}

export function addServer(server: Guild) {
    const stmt = db.prepare(loadQuery("insert_server.sql"));
    stmt.run(server.id, server.name);
}

export function addChannel(channel: any) {
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

export function logMessage(user: User, channel: any, message: Message) {
    addUser(user);
    addChannel(channel);

    const userRow: any = db.prepare(loadQuery("select_user.sql")).get(user.id);
    const channelRow: any = db.prepare(loadQuery("select_channel.sql")).get(channel.id);

    if (userRow && channelRow) {
        const stmt = db.prepare(loadQuery("insert_message.sql"));
        const timestamp: string = new Date(message.createdTimestamp).toISOString();
        stmt.run(message.id, userRow.id, channelRow.id, message.content, timestamp);
    }
}

export function getMessages(channel: any): GetMessagesResult | null {
    const channelRow: any = db.prepare(loadQuery("select_channel.sql")).get(channel.id);
    if (!channelRow) return null;

    const stmt = db.prepare(loadQuery("select_messages.sql"));
    return {
        isDM: channelRow.is_dm === 1,
        serverId: channelRow.server_id,
        messages: stmt.all(channelRow.id) as GetMessage[],
    };
}