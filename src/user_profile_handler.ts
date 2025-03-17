import { GoogleGenerativeAI, SchemaType, ObjectSchema } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs"
import { UserProfile, ChatHistory } from "./interfaces"
import { userProfiles, userHistories } from "./generate_message";

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

const PROFILES_FILE = "user_profiles.json"

const MAX_LENGTH = 4;

async function summarizeUserHistory(userId: string): Promise<{ personality: string; summary: string; facts: string[] }> {
    const userHistory = userHistories[userId]?.messages || [];
    if (userHistory.length < MAX_LENGTH) {
        return {
            personality: userProfiles[userId]?.personality || "unknown",
            summary: userProfiles[userId]?.summary || "",
            facts: userProfiles[userId]?.facts || []
        };
    }

    const messagesToSummarize = userHistory.slice(0, userHistory.length - MAX_LENGTH / 2);

    const existingProfile = userProfiles[userId] || { personality: "unknown", summary: "", facts: [] };

    const summaryPrompt = `
        Analyze the following conversation and extract structured information about the user.
        Identify their personality traits, summarize their interactions, and extract key facts they have explicitly mentioned.

        Existing User Profile:
        - Personality: ${existingProfile.personality}
        - Summary: ${existingProfile.summary}
        - Important Facts: ${existingProfile.facts.join(", ")}

        Messages:
        ${messagesToSummarize.map(m => `${m.role}: ${m.parts.map(p => p.text).join(" ")}`).join("\n")}
        
        Update the user profile with a refined personality description, a concise summary of recent interactions, 
        and any new important facts mentioned.
    `;

    try {
        const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: summaryPrompt }] }] });
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("Error summarizing user history:", error);
        return {
            personality: userProfiles[userId]?.personality || "unknown",
            summary: userProfiles[userId]?.summary || "",
            facts: userProfiles[userId]?.facts || []
        };
    }
}

export function loadUserProfiles(): Record<string, UserProfile> {
    try {
        if (!fs.existsSync(PROFILES_FILE)) return {};
        const data = fs.readFileSync(PROFILES_FILE, "utf-8").trim();
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error("Error loading user profiles:", error);
        return {};
    }
}

function saveUserProfiles() {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(userProfiles, null, 2));
}

export async function updateUserProfile(userId: string) {
    if (!userProfiles[userId]) {
        userProfiles[userId] = { personality: "unknown", summary: "", facts: [] };
    }

    if (!userHistories[userId]) {
        userHistories[userId] = { messages: [] };
    }

    if (userHistories[userId].messages.length > MAX_LENGTH) {
        const summaryData = await summarizeUserHistory(userId);

        userProfiles[userId].personality = summaryData.personality;
        userProfiles[userId].summary = summaryData.summary;
        userProfiles[userId].facts = [...new Set([...userProfiles[userId].facts, ...summaryData.facts])];

        userHistories[userId].messages = userHistories[userId].messages.slice(-MAX_LENGTH / 2);
    }

    saveUserProfiles();
}
