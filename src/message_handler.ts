import { Message, TextChannel, DMChannel, ThreadChannel, Channel} from "discord.js";
import fs from "fs"
import { generateGeminiResponse } from "./generate_message";

// Fetch characters from characters.json
const characters = JSON.parse(fs.readFileSync("characters.json", "utf8")).characters;

// Select current character as the first character in the list
let currentCharacter = characters[0];

function keepTyping(channel: TextChannel | DMChannel | ThreadChannel, stopSignal: () => boolean) {
    (async() => {    
        while(!stopSignal()) {
            await channel.sendTyping();
            await new Promise((resolve) => setTimeout(resolve, 5000)) // Call every 5s
        }
    })();
}

export async function messageHandler(message: Message) {
    console.log(`${message.author.displayName}: ${message.content}`);

    if (message.author.bot) return;

    if (message.channel instanceof TextChannel || message.channel instanceof DMChannel || message.channel instanceof ThreadChannel) {
        // If message is a reply, check which message is replying to
        let repliedMessage;
        if (message.reference) {
            try {
                repliedMessage = await message.channel.messages.fetch(message.reference.messageId!);
            } catch (error) {
                console.error("Failed to fetch replied message:", error);
            }
        }
        // If meets condition reply to message
        if (message.mentions.has(message.client.user) || message.channel.isDMBased() || repliedMessage?.author.id === message.client.user?.id) {
            let isDone: boolean = false;
            keepTyping(message.channel, () => isDone);
    
            const botMention = new RegExp(`<@!?${message.client.user?.id}>`);
            const cleanMessage = message.content.replace(botMention, "").trim();
    
            if (!cleanMessage) {
                await message.reply(`Hey ${message.author}, you mentioned me!`);
                isDone = true;
                return;
            }
    
            try {
                const response = await generateGeminiResponse(message, cleanMessage, currentCharacter);
                if (message.channel.isDMBased()) {
                    await message.channel.send(response);
                } else {
                    await message.reply(response);
                }
                isDone = true;
            } catch (error) {
                if (message.channel.isDMBased()) {
                    await message.channel.send("Sorry, I couldn't generate a response.");
                } else {
                    await message.reply("Sorry, I couldn't generate a response.");
                }
                isDone = true;
            }
        }
    }
}