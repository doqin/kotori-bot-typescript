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
    addMessage(`> Logged in as ${client.user?.tag}!`);
});

// Set callback for dealing with certain messages
client.on("messageCreate", messageHandler);

// Set callback for dealing with commands
client.on("interactionCreate", commandHandler);

// Set up CLI
const screen = blessed.screen({
    smartCSR: true,
    title: "Chat Logger"
});

const logBox = blessed.log({
    top: 0,
    left: 0,
    width: "70%",
    height: "90%",
    label: " Chat Log ",
    border: { type: "line" },
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: " ", inverse: true },
    style: {
        border: { fg: "cyan" },
        fg: "white",
        bg: "black",
    }
});

const errorBox = blessed.log({
    top: 0,
    right: 0,
    width: "30%",
    height: "90%",
    label: " Error Log ",
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

const inputBox = blessed.textbox({
    bottom: 0,
    left: 0,
    width: "100%",
    height: "10%",
    label: " Type your message ",
    border: { type: "line" },
    inputOnFocus: true,
    style: {
        border: { fg: "magenta" },
        fg: "white",
        bg: "black"
    }
});

screen.append(logBox);
screen.append(errorBox);
screen.append(inputBox);

export function addMessage(msg: any) {
    logBox.log(msg + "\n");
    screen.render();
}

export function addError(msg: any) {
    errorBox.log(msg + "\n");
    screen.render();
}

inputBox.key("enter", () => {
    const message = inputBox.getValue().trim();
    if (message) {
        addMessage(`> ${message}`);
        inputBox.clearValue();
    }
    inputBox.focus();
});

// Disable mouse scrolls
screen.key(["q", "C-c"], () => process.exit(0));
screen.program.disableMouse();
screen.program.key(["S-up", "S-down"], () => {});

// Scroll up
screen.key("up", () => {
    logBox.scroll(-1); // Scroll up by 1 line
    screen.render();
});

// Scroll down
screen.key("down", () => {
    logBox.scroll(1); // Scroll down by 1 line
    screen.render();
});

// Scroll up
screen.key("i", () => {
    errorBox.scroll(-1); // Scroll up by 1 line
    screen.render();
});

// Scroll down
screen.key("k", () => {
    errorBox.scroll(1); // Scroll down by 1 line
    screen.render();
});

// Scroll page up
screen.key(["pageup"], () => {
    logBox.scroll(-5); // Scroll up by 5 lines
    screen.render();
});

// Scroll page down
screen.key(["pagedown"], () => {
    logBox.scroll(5); // Scroll down by 5 lines
    screen.render();
});

// Gain focus on input box
screen.key("enter", () => {
    inputBox.focus();
})

inputBox.focus();

screen.render();

// Connect bot
client.login(process.env.TOKEN);