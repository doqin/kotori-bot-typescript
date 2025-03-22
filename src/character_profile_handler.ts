import { GoogleGenerativeAI, SchemaType, ObjectSchema } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs"
import { characters, currentCharacter } from "./message_handler";
import { addLog } from ".";

dotenv.config();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const userSchema: ObjectSchema = {
    description: "Structured data about the character's facts",
    type: SchemaType.OBJECT,
    properties: {
      facts: {
        type: SchemaType.ARRAY as const,
        description: "List of important facts the character has explicitly mentioned.",
        items: { type: SchemaType.STRING as const },
      },
    },
    required: ["facts"],
};
  
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: userSchema,
    },
});

const CHARACTERS_FILE = "characters.json"

const configurations = JSON.parse(fs.readFileSync("configurations.json", "utf-8"));

async function collectCharacterFacts(): Promise<{ facts: string[] }> {
    const characterHistory = currentCharacter.messages || [];
    if (characterHistory.length < configurations.messages_before_summary) {
        return {
            facts: currentCharacter.facts || []
        };
    }

    const messagesToSummarize = characterHistory.slice(0, characterHistory.length - configurations.messages_before_summary / 2);

    const characterProfile = currentCharacter.facts || { facts: [] };

    const summaryPrompt = `
        Analyze the following conversation and extract structured information about the character.
        Extract important key facts about themself that they have explicitly mentioned.

        Existing Character Facts:
        ${characterProfile.join(", ")}

        Messages:
        ${messagesToSummarize.map((m: any) => `${m.parts.map((p: any) => p.text).join(" ")}`).join("\n")}
        
        Update the character facts with any new important facts mentioned.
    `;

    try {
        const result = await model.generateContent({ contents: [{ role: "user", parts: [{ text: summaryPrompt }] }] });
        return JSON.parse(result.response.text());
    } catch (error) {
        // console.error("Error summarizing user history:", error);
        addLog(`Error summarizing user history: ${error}`);
        return {
            facts: currentCharacter.facts || []
        };
    }
}

export async function updateCharacterFacts() {
    if (currentCharacter.messages.length > configurations.messages_before_summary) {
        const summaryData = await collectCharacterFacts();

        currentCharacter.facts = [...new Set([...currentCharacter.facts, ...summaryData.facts])]
        
        if (currentCharacter.facts.length > configurations.max_facts) {
            currentCharacter.facts = [currentCharacter.facts[0], ...currentCharacter.facts.slice(-configurations.max_facts)]
        }
        currentCharacter.messages = currentCharacter.messages.slice(-configurations.messages_before_summary / 2);
    }

    saveCharacterProfiles();
}

function saveCharacterProfiles() {
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(characters, null, 2));
}
