import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";
import { server } from "./websocket";
import configurations from "./common/configurations";
const blessed = require("blessed");

import { messageHandler } from "./message_handler";
import { commandHandler } from "./command_handler";

// Loads .env file contents
dotenv.config();

//#region Discord Bot Setup

export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences,
    ],
    partials: [Partials.Channel],
});

// Set callback for when the bot has logged on
client.once("ready", () => {
    console.log(`> Logged in as ${client.user?.tag}!`);
});
// Set callback for dealing with certain messages
client.on("messageCreate", messageHandler);
// Set callback for dealing with commands
client.on("interactionCreate", commandHandler);

//#endregion

//#region Bot Connection

// Connect bot
client.login(process.env.TOKEN);

if (configurations.start_server) {
    // Start API
    server.listen(configurations.port, () => {
        console.log(`> Server running on https://127.0.0.1:${configurations.port}`);
    });
}

//#endregion