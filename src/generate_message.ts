import { Message } from "discord.js"
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv"
import { loadHistory, saveHistory } from "./chat_history_handler";
import { loadUserProfiles, updateUserProfile } from "./user_profile_handler";
import { UserProfile, ChatHistory} from "./interfaces";

const CHAT_HISTORY_FILE = "chat_history.json";
const USER_HISTORY_FILE = "user_history.json";

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAX_LENGTH = 50;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const chatHistories: Record<string, ChatHistory> = loadHistory(CHAT_HISTORY_FILE);
export const userHistories: Record<string, ChatHistory> = loadHistory(USER_HISTORY_FILE);
export const userProfiles: Record<string, UserProfile> = loadUserProfiles();

export async function generateGeminiResponse(
    message: Message,
    messageContent: string,
    character: any
): Promise<string> {
    const channelId = message.channel.id;

    await summarizeAndTrimHistory(channelId);

    if (!chatHistories[channelId]) {
        chatHistories[channelId] = { messages: [] };
    }

    if (!userHistories[message.author.id]) {
        userHistories[message.author.id] = { messages: [] };
    }

    const userProfile = userProfiles[message.author.id] || { personality: "unknown", summary: "", facts: [] };

    const systemMessage = {
        role: "user",
        parts: [
            {
                text: `From now on, you are ${character.name}, ${character.description}. Your personality: ${character.personality}.\n
                    This user has talked to you before. Here is what you know about them: \n
                    - Personality: ${userProfile.personality} \n
                    - Summary: ${userProfile.summary} \n
                    - Facts: ${userProfile.facts.join(", ")}\n
                    Keep responses short and casual. Don't use emojis.`
            }
        ]
    };

    try {
        const chat = model.startChat({
            history: [systemMessage, ...(chatHistories[channelId]?.messages.map(({ role, parts }) => ({ role, parts })) || [])]
        });

        const userMessage = `${message.author.displayName} (${message.author.username}): ${messageContent}`;
        const result = await chat.sendMessage(userMessage);
        const aiResponse = result.response.text()?.trim() || "I couldn't generate a response.";

        // Store messages in history
        addMessageToHistory(chatHistories[channelId], message.author.id, [{ text: userMessage }], "user");
        addMessageToHistory(userHistories[message.author.id], message.author.id, [{ text: userMessage }], "user");
        addMessageToHistory(chatHistories[channelId], "system", [{ text: aiResponse }], "model");

        await updateUserProfile(message.author.id);

        saveHistory(chatHistories, CHAT_HISTORY_FILE);
        saveHistory(userHistories, USER_HISTORY_FILE);

        return aiResponse.replace("Kako: ", "");
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Sorry, I'm having trouble thinking right now!";
    }
}


async function summarizeHistory(channelId: string, messages: string[]): Promise<string> {
    if (messages.length === 0) return "No messages to summarize.";

    try {
        const prompt = `Summarize the following conversation briefly while keeping key details and user personalities:\n\n${messages.join("\n")}`;
    
        const result = await model.generateContent(prompt);
    
        return result.response.text() || "Summary not available.";
      } catch (error) {
        console.error(`Error summarizing history for ${channelId}:`, error);
        return "Failed to summarize history.";
      }
}

async function summarizeAndTrimHistory(channelId: string) {
    let history = chatHistories[channelId];
    if (!history || history.messages.length < MAX_LENGTH) return;
  
    const messagesToSummarize = history.messages.slice(0, history.messages.length - MAX_LENGTH / 2);

    const summary = await summarizeHistory(
      channelId,
      messagesToSummarize.map(m => `${m.role}: ${m.parts[0].text}`)
    );
  
    chatHistories[channelId].messages = [
      { role: "model", userId: "system", parts: [{ text: `Summary: ${summary}` }], timestamp: Date.now() },
      ...history.messages.slice(-MAX_LENGTH / 2)
    ];
  }
  

function addMessageToHistory(history: ChatHistory, userId: string, parts: { text: string }[], role: "user" | "model") {
    if (!history) {
      history = { messages: [] };
    }
  
    history.messages.push({
      role,
      userId,
      parts,
      timestamp: Date.now(),
    });
  }
  