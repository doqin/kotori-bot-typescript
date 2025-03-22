import { ActivityType, Message } from "discord.js";
import dotenv from "dotenv";
import { HarmCategory, HarmBlockThreshold, Part } from "@google/generative-ai";
import { loadHistory, saveHistory } from "./chat_history_handler";
import { loadUserProfiles, updateUserProfile } from "./user_profile_handler";
import { UserProfile, ChatHistory} from "./interfaces";
import { updateCharacterFacts } from "./character_profile_handler";
import { addLog } from ".";
import { imageUrlToBase64 } from "./imageUrlToBase64";

const { GoogleGenerativeAI } = require("@google/generative-ai");

export const CHAT_HISTORY_FILE = "chat_history.json";
export const USER_HISTORY_FILE = "user_history.json";

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MAX_LENGTH = 50;

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_UNSPECIFIED,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel(
  {
    model: "gemini-2.0-flash-exp-image-generation",
    generationConfig: {
        responseModalities: ["Text", "Image"],
    },
  },
);

export const chatHistories: Record<string, ChatHistory> = loadHistory(CHAT_HISTORY_FILE);
export const userHistories: Record<string, ChatHistory> = loadHistory(USER_HISTORY_FILE);
export const userProfiles: Record<string, UserProfile> = loadUserProfiles();

export async function generateGeminiResponse(
    message: Message,
    messageContent: string,
    character: any
): Promise<{ text: string; images: Buffer[] }> {
    const channelId = message.channel.id;

    let activityText = "not currently doing anything.";

    for (const [, guild] of message.client.guilds.cache) {
        const member = guild.members.cache.get(message.author.id);
        if (member?.presence?.activities.length) {
            const activities = member.presence.activities.map((act) => {
                if (act.type === 0) return `playing ${act.name}`;
                if (act.type === 1) return `streaming ${act.name}`;
                if (act.type === 2) {
                  if (act.name === "Spotify" && act.details && act.state) {
                    return `listening to "${act.details}" by ${act.state}`;
                  }
                  return `listening to ${act.name}`;
                }
                if (act.type === 3) return `watching ${act.name}`;
                return `doing ${act.name}`;
            });
            activityText = activities.join(", ");
            break; // Stop once we find an active presence
        }
    }

    // console.log("Activity: ", activityText);

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
                text: `From now on, you are ${character.name}, ${character.description}. Your personality: ${character.personality}. Your lore: ${character.lore}. Facts about yourself: ${character.facts.join(", ")}\n
                    This user has talked to you before. Here is what you know about them: \n
                    - Personality: ${userProfile.personality} \n
                    - Summary: ${userProfile.summary} \n
                    - Facts: ${userProfile.facts.join(", ")} \n
                    - Discord Activity: ${activityText} \n
                    Keep responses short and casual, don't talk about your personal info unless it's relevant. Don't use emojis.\n
                    You can generate both text and images. If the user asks for a drawing, respond with an image.\n`
            }
        ]
    };

    try {
        const chat = model.startChat({
            history: [systemMessage, ...(chatHistories[channelId]?.messages.map(({ role, parts }) => ({ role, parts })) || [])]
        });

        const messageParts: Part[] = [{ text: `${message.author.displayName} (${message.author.username}): ${messageContent}` }];

        if (message.attachments.size > 0) {
            for (const attachment of message.attachments.values()) {
                if (attachment.contentType?.startsWith("image/")) {
                    try {
                        const base64Image = await imageUrlToBase64(attachment.url);
                        messageParts.push({
                            inlineData: {
                                mimeType: attachment.contentType,
                                data: base64Image,
                            },
                        });
                    } catch (error) {
                        // console.error("Error converting image to Base64:", error);
                        addLog(`Error converting image to Base64: ${error}`);
                    }
                }
            }
        }
        const result = await chat.sendMessage(messageParts, safetySettings);
        const response = await result.response;

        // For debugging
        // console.log("Full response:", JSON.stringify(response, null, 2));

        if (response.candidates?.[0].finishReason === "IMAGE_SAFETY") {
          addLog("Failed to generate image for reason: IMAGE_SAFETY");
          return { text: "Couldn't generate image for reason: \"IMAGE_SAFETY\"", images: [] };
        }

        const responseCandidates = response.candidates?.[0]?.content;
        const responseParts = responseCandidates?.parts ?? [];

        // For debugging
        // console.log("Response parts:", JSON.stringify(responseParts, null, 2));

        const aiTextResponse: string = responseCandidates?.parts.find((p: Part) => p.text)?.text || "";

        const imageParts: Part[] = response.candidates?.[0]?.content?.parts?.filter(
          (part: Part) => part.inlineData && part.inlineData.mimeType?.startsWith("image/")) || [];

        const images: Buffer[] = imageParts.map((part: Part) => {
          return part.inlineData ? Buffer.from(part.inlineData.data, "base64") : Buffer.alloc(0);
        });

        // console.log("Extracted images:", images.length); // Debug: Check if images exist

        // Store messages in history
        chatHistories[channelId].messages.push({ 
          role: "user", 
          userId: message.author.id, 
          parts: messageParts, 
          timestamp: Date.now() 
        });

        const aiResponseParts: Part[] = [{ text: aiTextResponse}];

        chatHistories[channelId].messages.push({ 
          role: "model", 
          userId: "system", 
          parts: aiResponseParts, 
          timestamp: Date.now() 
        });

        character.messages.push({
          role: "model", 
          userId: "system", 
          parts: aiResponseParts, 
          timestamp: Date.now() 
        })

        userHistories[message.author.id].messages.push({ 
          role: "user", 
          userId: message.author.id, 
          parts: messageParts, 
          timestamp: Date.now() 
        });

        await updateUserProfile(message.author.id);
        await updateCharacterFacts();

        saveHistory(chatHistories, CHAT_HISTORY_FILE);
        saveHistory(userHistories, USER_HISTORY_FILE);

        return {text: aiTextResponse.replace("Kako: ", "").replace("Kotori: ", "").replace("Kotori (Kako): ", ""), images: images};
    } catch (error) {
        // console.error("Gemini API Error:", error);
        addLog(`Gemini API Error: ${error}`);
        return { text: "Sorry, I'm having trouble thinking right now!", images: []};
    }
}


async function summarizeHistory(channelId: string, messages: string[]): Promise<string> {
    if (messages.length === 0) return "No messages to summarize.";

    try {
        const prompt = `Summarize the following conversation briefly while keeping key details and user personalities:\n\n${messages.join("\n")}`;
    
        const result = await model.generateContent(prompt);
    
        return result.response.text() || "Summary not available.";
      } catch (error) {
        // console.error(`Error summarizing history for ${channelId}:`, error);
        addLog(`Error summarizing history for ${channelId}: ${error}`);
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