import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";

import { guildMessageHandler } from "./message_handler";

// Loads .env file contents
dotenv.config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});

// Set callback for when the bot has logged on
client.once("ready", () => {
    console.log(`Logged in as ${client.user?.tag}!`);
});


// Set callback for dealing with certain messages
client.on("messageCreate", guildMessageHandler);

client.login(process.env.TOKEN);