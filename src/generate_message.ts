import { Message } from "discord.js";
import dotenv from "dotenv";
import { HarmCategory, HarmBlockThreshold, Part } from "@google/generative-ai";
import { updateUserProfile } from "./user_profile_handler";
import { UserProfile } from "./types";
import { updateCharacterFacts } from "./character_profile_handler";
import { addLog } from ".";
import { imageUrlToBase64 } from "./imageUrlToBase64";
import { getUserProfile, getChannelMessages } from "./chat_logger";
import configurations from "./configurations";

const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

export async function generateGeminiResponse(
    message: Message,
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

    const messagesToSummarize = getChannelMessages(message.channel, configurations.summary_size, configurations.message_limit)?.messages;
    let summary: string = "";
    if (messagesToSummarize) {
        summary = await summarizeHistory(channelId, messagesToSummarize.map(msg => `${msg.role}: ${msg.content}`));
    }

    const userProfile: UserProfile = getUserProfile(message.author) || { personality: "unknown", summary: "", facts: [] };

    const systemMessage = [{
        role: "user",
        parts: [
            {
                text: `From now on, you are ${character.name}, ${character.description}. Your personality: ${character.personality}. Your lore: ${character.lore}. Facts about yourself: ${character.facts.join(", ")}\nThis user has talked to you before. Here is what you know about them: \n- Personality: ${userProfile.personality}\n- Summary: ${userProfile.summary} \n- Facts: ${userProfile.facts.join(", ")} \n- Discord Activity: ${activityText} \nKeep responses short and casual, don't talk about your personal info unless it's relevant. Don't use emojis.\nYou can generate both text and images. If the user asks for a drawing, respond with an image.\n`
            }
        ]
    }];

    if (summary) {
        systemMessage.push({
            role: "user",
            parts: [
                {
                  text: `Summary: ${summary}`
                }
            ]
        });
    }

    const history = [
        ...systemMessage,
        ...(getChannelMessages(message.channel)?.messages
        .map(msg => {
            let messageData: any;
            if (msg.role === "user") {
                const messageParts: Part[] = [{ text: `${msg.display_name} (${msg.username}): ${msg.content}` }];
                if (msg.mime_type && msg.data) {
                    messageParts.push({
                        inlineData: {
                            mimeType: msg.mime_type,
                            data: msg.data
                        },
                    });
                }
                messageData = {
                    role: msg.role,
                    parts: messageParts,
                };
            } else {
                messageData = {
                    role: msg.role,
                    parts: [
                        {
                            text: msg.content,
                        }
                    ]
                }
            }
            return messageData;
        }) || [])
    ]

    /* uncomment to debug
    addLog(`${message.author.displayName}'s prompt:\n${history.map(message => {
      return message.parts.map((part: { text: any; }) => part.text).join(" ");
    }).join("\n")}`);
    */

    try {
        const chat = model.startChat({history});

        const messageParts: Part[] = [{ text: `${message.author.displayName} (${message.author.username}): ${message.content}` }];

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

        // For debugging
        // console.log("Response parts:", JSON.stringify(responseParts, null, 2));

        const aiTextResponse: string = responseCandidates?.parts.find((p: Part) => p.text)?.text || "";

        const imageParts: Part[] = response.candidates?.[0]?.content?.parts
            ?.filter((part: Part) => part.inlineData && part.inlineData.mimeType?.startsWith("image/")) || [];

        const images: Buffer[] = imageParts.map((part: Part) => {
            return part.inlineData ? Buffer.from(part.inlineData.data, "base64") : Buffer.alloc(0);
        });

        // console.log("Extracted images:", images.length); // Debug: Check if images exist

        // Store messages in history

        const aiResponseParts: Part[] = [{ text: aiTextResponse}];

        character.messages.push({
            role: "model", 
            userId: "system", 
            parts: aiResponseParts, 
            timestamp: Date.now()
        })

        await updateUserProfile(message.author);
        await updateCharacterFacts();

        return {text: aiTextResponse.replace("Kako: ", "").replace("Kotori: ", "").replace("Kotori (Kako): ", ""), images: images};
    } catch (error) {
        // console.error("Gemini API Error:", error);
        addLog(`Gemini API Error:\n ${error}`);
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