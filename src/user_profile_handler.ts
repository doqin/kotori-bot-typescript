import { GoogleGenerativeAI, SchemaType, ObjectSchema } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs";
import { addLog } from ".";
import { addUserFact, getUserMessages, getUserProfile, saveUserMemory } from "./chat_logger";
import { User } from "discord.js"
import { ktrMessage, UserProfile } from "./types";
import configurations from "./configurations";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const userSchema: ObjectSchema = {
    description: "Structured data about the user's personality, summary, and facts.",
    type: SchemaType.OBJECT,
    properties: {
        personality: {
            type: SchemaType.STRING as const,
            description: "A few words describing the user's personality.",
            nullable: false,
        },
        summary: {
            type: SchemaType.STRING as const,
            description: "A concise summary of their interactions so far.",
            nullable: false,
        },
        facts: {
            type: SchemaType.ARRAY as const,
            description: "List of important facts the user has explicitly mentioned.",
            items: { type: SchemaType.STRING as const },
        },
    },
    required: ["personality", "summary", "facts"],
};
  
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
        responseMimeType: "application/json",
        responseSchema: userSchema,
    },
});

let messageCount: Record<string, number> = {};

async function summarizeUserHistory(user: User, userHistory: ktrMessage[]): Promise<UserProfile> {
    const userProfile: UserProfile = getUserProfile(user) || { personality: "unknown", summary: "", facts: []};
    if (userHistory.length < configurations.messages_before_summary) {
        return userProfile;
    }

    const messagesToSummarize = userHistory;

    const summaryPrompt = `
        Analyze the following conversation and extract structured information about the user.
        Identify their personality traits, summarize their interactions, and extract key facts they have explicitly mentioned.

        Existing User Profile:
        - Personality: ${userProfile.personality}
        - Summary: ${userProfile.summary}
        - Facts: ${userProfile.facts.join(", ")}

        Messages:
        ${messagesToSummarize.map(m => `${user.displayName}: ${m.content}`).join("\n")}
        
        Update the user profile with a refined personality description, a concise summary of recent interactions, 
        and any new important facts mentioned.
    `;

    try {
        const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: summaryPrompt }] }] });
        return JSON.parse(result.response.text());
    } catch (error) {
        // console.error("Error summarizing user history:", error);
        addLog(`Error summarizing user history: ${error}`);
        return {
            personality: userProfile.personality || "unknown",
            summary: userProfile.summary || "",
            facts: userProfile.facts || []
        };
    }
}

export async function updateUserProfile(user: User) {
    messageCount[user.id] = (messageCount[user.id] || 0) + 1;
    /*
    addLog(`${user.displayName}'s message count: ${messageCount[user.id]}`);
    */
    const userHistory: ktrMessage[] = getUserMessages(user);

    if (messageCount[user.id] > configurations.messages_before_summary) {
        messageCount[user.id] = 0;
        const summaryData = await summarizeUserHistory(user, userHistory);

        saveUserMemory(user.id, summaryData.personality, summaryData.summary);
        summaryData.facts.forEach(fact => {
            addUserFact(user.id, fact);
        });
    }
}
