import { Message, TextChannel, DMChannel, ThreadChannel } from "discord.js";
import fs from "fs"
import { generateGeminiResponse, generateOpenRouterResponse } from "./generate_message";
import { logMessage } from "./chat_logger"
import { sendMessageToClients } from "./websocket";

function keepTyping(channel: TextChannel | DMChannel | ThreadChannel, stopSignal: () => boolean) {
    (async() => {
        while(!stopSignal()) {
            await channel.sendTyping();
            await new Promise((resolve) => setTimeout(resolve, 5000)) // Call every 5s
        }
    })();
}

// Fetch characters from characters.json
export let characters = JSON.parse(fs.readFileSync("characters.json", "utf8"));

// Select current character as the first character in the list
export let currentCharacter = characters.characters?.[0];

if (!currentCharacter) {
    throw new Error("No characters found in characters.json or characters array is empty");
}



/**
 * Handles incoming messages and generates responses
 * @param message The incoming message
 * @returns A promise that resolves when the message has been processed
 */
export async function messageHandler(message: Message) {
    // console.log(`${message.author.displayName}: ${message.content}`);
    
    if (message.author.bot) {
        sendMessageToClients(message);
        logMessage(message.author, "assistant", message.channel, message);
        return;
    }

    if (message.channel instanceof TextChannel || message.channel instanceof DMChannel || message.channel instanceof ThreadChannel) {
        // If message is a reply, check which message is replying to
        let repliedMessage;
        if (message.reference) {
            try {
                repliedMessage = await message.channel.messages.fetch(message.reference.messageId!);
            } catch (error) {
                console.log(`Failed to fetch replied message: ${error}`);
            }
        }
        // If meets condition reply to message
        if (message.mentions.has(message.client.user) || message.channel.isDMBased() || repliedMessage?.author.id === message.client.user?.id) {
            sendMessageToClients(message);
            let isDone: boolean = false;
            keepTyping(message.channel, () => isDone);
            const botMention = new RegExp(`<@!?${message.client.user?.id}>`);
            message.content = message.content.replace(botMention, "").trim();
            
            try {
                const { text, images }  = 
                    process.env.BOT == "GEMINI"
                    ? await generateGeminiResponse(message, currentCharacter)
                    : await generateOpenRouterResponse(message, currentCharacter);
                if (message.channel.isDMBased()) {
                    if (images.length > 0) {
                        await message.channel.send({
                            content: text,
                            files: images.map((img, index) => ({
                                attachment: img,
                                name: `image_${index + 1}.png`
                            }))
                        });
                    } else {
                        if (text) {
                            await message.channel.send(text);
                        } else {
                            console.log(`Response is empty`);
                        }
                    }
                } else {
                    if (images.length > 0) {
                        await message.reply({
                            content: text,
                            files: images.map((img, index) => ({
                                attachment: img,
                                name: `image_${index + 1}.png`
                            }))
                        });
                    } else {
                        if (text) {
                            await message.reply(text);
                        } else {
                            console.log(`Response is empty`);
                        }
                    } 
                }
                isDone = true;
            } catch (error) {
                console.error(`Failed to handle message: ${error}`);
                if (message.channel.isDMBased()) {
                    await message.channel.send("Sorry, I couldn't generate a response.");
                } else {
                    await message.reply("Sorry, I couldn't generate a response.");
                }
                isDone = true;
            }
            try {
                logMessage(message.author, "user", message.channel, message);
            } catch (error) {
                console.error(`Error logging message: ${error}`);
            }
        }
    }
}