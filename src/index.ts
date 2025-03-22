import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";
const blessed = require("blessed");

import { messageHandler } from "./message_handler";
import { commandHandler } from "./command_handler";

// Loads .env file contents
dotenv.config();

const client = new Client({
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
    addLog(`> Logged in as ${client.user?.tag}!`);
});

// Set callback for dealing with certain messages
client.on("messageCreate", messageHandler);

// Set callback for dealing with commands
client.on("interactionCreate", commandHandler);

// Set up CLI
const screen = blessed.screen({
    smartCSR: true,
    title: "Logger"
});

const logBox = blessed.log({
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    label: " Logs ",
    border: { type: "line" },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: " ", inverse: true },
    style: {
        border: { fg: "cyan" },
        fg: "white",
        bg: "black",
    }
})

screen.append(logBox);

export function addLog(msg: any) {
    logBox.log(msg + "\n");
    screen.render();
}

// Disable mouse scrolls
screen.key(["q", "C-c"], () => process.exit(0));
screen.program.disableMouse();
screen.program.key(["S-up", "S-down"], () => {});

// Scroll up
screen.key("i", () => {
    logBox.scroll(-1); // Scroll up by 1 line
    screen.render();
});

// Scroll down
screen.key("k", () => {
    logBox.scroll(1); // Scroll down by 1 line
    screen.render();
});

screen.render();

// Connect bot
client.login(process.env.TOKEN);