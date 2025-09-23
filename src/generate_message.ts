import { Message } from "discord.js";
import dotenv from "dotenv";
import { HarmCategory, HarmBlockThreshold, Part } from "@google/generative-ai";
import { updateUserProfile } from "./user_profile_handler";
import { OpenRouterMessage, UserProfile } from "./common/types";
import { imageUrlToBase64 } from "./helpers/imageUrlToBase64";
import { getUserProfile, getChannelMessages } from "./chat_logger";
import configurations from "./common/configurations";
import { callOpenRouter } from "./helpers/callOpenRouter";
import { saveCharacterProfiles } from "./character_profile_handler";
import { callAIHorde } from "./helpers/callAIHorde";
import { getAIHordeModels } from "./helpers/getAIHordeModel";

const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

// const aihorde_model = "koboldcpp/Fimbulvetr-11B-v2"

//#region Helpers

function getActivityText(message: Message): string {
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

    return activityText;
}

async function summarizeHistory(
    channelId: string,
    messages: string[]
): Promise<string> {
    if (messages.length === 0) return "No messages to summarize.";

    try {
        const prompt = `Summarize the following conversation briefly while keeping key details:\n\n${messages.join("\n")}`;

        if (process.env.BOT == "GEMINI") {
            const result = await model.generateContent(prompt);
            return result.response.text() || "Summary not available.";
            // Use OpenRouter for summarizing history
        } else if (process.env.BOT == "OPENROUTER") {
            const result = await callOpenRouter(
                process.env.OPENROUTER_API_KEY,
                "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
                undefined,
                [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            );
            return result || "Summary not available.";
        } else {
            let models = await getAIHordeModels();
            if (models === null) {
                console.log(`AIHorde API Error:\n Couldn't get any models`);
                throw new Error("Could not fetch AIHorde models");
            }
            for (const model of models) {
                try {
                    const result = await callAIHorde(
                        process.env.AIHORDE_API_KEY,
                        model.id,
                        undefined,
                        [
                            {
                                role: "user",
                                content: prompt
                            }
                        ]
                    );
                    return result;
                } catch (e) {
                    console.error(`AIHorde API Error:\n${e}`);
                }
            }
            return "Failed to summarize history.";
        }
    } catch (error) {
        console.log(`Error summarizing history for ${channelId}: ${error}`);
        return "Failed to summarize history.";
    }
}

//#endregion

//#region GEMINI

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
        model: "gemini-2.5-flash-image-preview",
        generationConfig: {
            responseModalities: ["Text", "Image"],
        },
    },
);

// Generate a response using the Gemini model
export async function generateGeminiResponse(
    message: Message,
    character: any
): Promise<{ text: string; images: Buffer[] }> {
    const channelId = message.channel.id;

    let activityText = getActivityText(message);

    const messagesToSummarize = getChannelMessages(message.channel, configurations.summary_size, configurations.message_limit)?.messages;
    let summary: string = "";
    if (messagesToSummarize) {
        summary = await summarizeHistory(channelId, messagesToSummarize.map(msg => `${msg.role}: ${msg.content}`));
    }

    const userProfile: UserProfile = getUserProfile(message.author) || { summary: "" };

    const systemMessage = [{
        role: "user",
        parts: [
            {
                text: `From now on, you are ${character.name}, ${character.description}. Your personality: ${character.personality}. Your lore: ${character.lore}.\nThis user has talked to you before. Here is what you know about them: \n- Summary: ${userProfile.summary} \n- Discord Activity: ${activityText} \nKeep responses short and casual, don't talk about your personal info unless it's relevant. Don't use emojis.\nYou can generate both text and images. If the user asks for a drawing, respond with an image.\n`
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

    // Build the message history
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

    try {
        const chat = model.startChat({ history });

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
                        console.log(`Error converting image to Base64: ${error}`);
                    }
                }
            }
        }
        const result = await chat.sendMessage(messageParts, safetySettings);
        const response = await result.response;

        // Check if we have valid candidates
        if (!response.candidates || response.candidates.length === 0) {
            console.log("No response candidates received from Gemini");
            return { text: "Sorry, I couldn't generate a response.", images: [] };
        }

        if (response.candidates[0]?.finishReason === "IMAGE_SAFETY") {
            console.log("Failed to generate image for reason: IMAGE_SAFETY");
            return { text: "Couldn't generate image for reason: \"IMAGE_SAFETY\"", images: [] };
        }

        const responseCandidates = response.candidates[0]?.content;

        const aiTextResponse: string = responseCandidates?.parts?.find((p: Part) => p.text)?.text || "";

        const imageParts: Part[] = response.candidates[0]?.content?.parts
            ?.filter((part: Part) => part.inlineData && part.inlineData.mimeType?.startsWith("image/")) || [];

        const images: Buffer[] = imageParts.map((part: Part) => {
            return part.inlineData ? Buffer.from(part.inlineData.data, "base64") : Buffer.alloc(0);
        });

        // Store messages in history

        const aiResponseParts: Part[] = [{ text: aiTextResponse }];

        character.messages.push({
            role: "model",
            userId: "system",
            parts: aiResponseParts,
            timestamp: Date.now()
        })

        await updateUserProfile(message.author);
        saveCharacterProfiles()

        return { text: aiTextResponse.replace("Kako: ", "").replace("Kotori: ", "").replace("Kotori (Kako): ", ""), images: images };
    } catch (error) {
        console.log(`Gemini API Error:\n ${error}`);
        return { text: "Sorry, I'm having trouble thinking right now!", images: [] };
    }
}

//#endregion

//#region OpenRouter

export async function generateOpenRouterResponse(
    message: Message,
    character: any
): Promise<{ text: string; images: Buffer[] }> {
    const channelId = message.channel.id;

    let activityText = getActivityText(message);

    const messagesToSummarize = getChannelMessages(message.channel, configurations.summary_size, configurations.message_limit)?.messages;
    let summary: string = "";
    if (messagesToSummarize) {
        summary = await summarizeHistory(channelId, messagesToSummarize.map(msg => `${msg.role}: ${msg.content}`))
    }

    const userProfile: UserProfile = getUserProfile(message.author) || { summary: "" };

    let systemMessage = `From now on, you are ${character.name}, ${character.description}. Your personality: ${character.personality}. Your lore: ${character.lore}.\nThis user has talked to you before. Here is what you know about them: \n- Summary: ${userProfile.summary} \n- Discord Activity: ${activityText} \nKeep responses short and casual, don't talk about your personal info unless it's relevant. Don't use emojis.\n`

    if (summary) {
        systemMessage += `Summary: ${summary}\n`
    }

    let messages: OpenRouterMessage[] = [
        // History
        ...(getChannelMessages(message.channel)?.messages?.map(msg => ({
            role: msg.role,
            content: `${msg.display_name} (${msg.username}): ${msg.content}`
        })) || []),
        // Latest message
        {
            "role": "user",
            "content": `${message.author.displayName} (${message.author.username}): ${message.content}`
        }
    ];

    try {
        let response = await callOpenRouter(
            process.env.OPENROUTER_API_KEY,
            "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
            systemMessage,
            messages
        );

        if (!response) {
            console.log("Empty response received from OpenRouter");
            return { text: "Sorry, I couldn't generate a response.", images: [] };
        }

        character.messages.push({
            role: "assistant",
            userId: "system",
            content: response,
            timestamp: Date.now()
        });

        await updateUserProfile(message.author);
        saveCharacterProfiles();

        return { text: response.replace("Kako: ", "").replace("Kotori: ", "").replace("Kotori (Kako): ", "").replace("Kotori (Kotori): ", "").replace("Kako (Kako): ", ""), images: [] }
    } catch (error) {
        console.log(`OpenRouter API Error:\n ${error}`);
        return { text: "Sorry, I'm having trouble thinking right now!", images: [] };
    }
}

//#endregion

//#region AIHorde

export async function generateAIHordeResponse(
    message: Message,
    character: any
): Promise<{ text: string; images: Buffer[] }> {
    const channelId = message.channel.id;

    let activityText = getActivityText(message);

    const messagesToSummarize = getChannelMessages(message.channel, configurations.summary_size, configurations.message_limit)?.messages;
    let summary: string = "";
    if (messagesToSummarize) {
        summary = await summarizeHistory(channelId, messagesToSummarize.map(msg => `${msg.role}: ${msg.content}`))
    }

    const userProfile: UserProfile = getUserProfile(message.author) || { summary: "" };

    let systemMessage = `From now on, you are ${character.name}, ${character.description}. Your personality: ${character.personality}. Your lore: ${character.lore}.\nThis user has talked to you before. Here is what you know about them: \n- Summary: ${userProfile.summary} \n- Discord Activity: ${activityText} \nKeep responses short and casual, don't talk about your personal info unless it's relevant. Don't use emojis.\n`

    if (summary) {
        systemMessage += `Summary: ${summary}\n`
    }

    let messages = [
        // History
        ...(getChannelMessages(message.channel)?.messages?.map(msg => ({
            role: msg.role,
            content: msg.content,
            name: `${msg.display_name} (${msg.username})`
        })) || []),
        // Latest message
        {
            "role": "user",
            "content": message.content,
            "name": `${message.author.displayName} (${message.author.username})`
        }
    ];

    let models = await getAIHordeModels();
    if (models === null) {
        console.log(`AIHorde API Error:\n Couldn't get any models`);
        return { text: "Sorry, I'm having trouble thinking right now!", images: [] };
    }
    for (const model of models) {
        console.debug(`Using ${model.id}`)
        let response: string = "";
        try {
            response = await callAIHorde(
                process.env.AIHORDE_API_KEY,
                model.id,
                systemMessage,
                messages
            );
        } catch (error) {
            console.error(`AIHorde API Error:\n ${error}`);
            if (model != models.at(-1)) console.debug("Trying again...")
        }
        if (response != "") {
            character.messages.push({
                role: "assistant",
                userId: "system",
                content: response,
                timestamp: Date.now()
            });

            await updateUserProfile(message.author);
            saveCharacterProfiles();

            return { text: response, images: [] }
        }
    }
    return { text: "Sorry, I'm having trouble thinking right now!", images: [] };
}

//#endregion