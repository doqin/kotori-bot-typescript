import { Message } from "discord.js"
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv"
import { loadHistory, saveHistory } from "./chat_history_handler";

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAX_LENGTH = 50;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const chatHistories: Record<string, { role: "user" | "model"; parts: { text: string }[] }[]> = loadHistory();

export async function generateGeminiResponse(message: Message, messageContent: string, character: any): Promise<string> {
    const channelId = message.channel.id;
    // Ensure channel history exists
    if (!chatHistories[channelId]) {
        chatHistories[channelId] = [];
    }

    chatHistories[channelId].push({ role: "user", parts: [{ text: `${message.author.displayName} (${message.author.username}): ${messageContent}` }] });

    while (chatHistories[channelId].length > MAX_LENGTH) {
        chatHistories[channelId].shift();
    }

    try {
        const chat = model.startChat({
            history: [ 
                {
                    role: "user",
                    parts: [
                        {
                            text: `From now on, you are ${character.name}, ${character.description}. Your personality: ${character.personality}. Keep the response short and concise like a casual conversation.`
                        }
                    ]
                },
                ...(chatHistories[channelId]?.slice(-MAX_LENGTH) || [])
            ]
        });
        const result = await chat.sendMessage(`${message.author.displayName} (${message.author.username}): ${messageContent}`);
        const aiResponse = result.response.text();

        chatHistories[channelId].push({ role: "model", parts: [{ text: aiResponse }]})

        saveHistory(chatHistories);

        return aiResponse || "I couldn't generate a response";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Sorry, I'm having trouble thinking right now!";
    }
}