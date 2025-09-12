import { GoogleGenerativeAI, SchemaType, ObjectSchema } from "@google/generative-ai";
import dotenv from "dotenv";
import fs from "fs"
import { characters, currentCharacter } from "./message_handler";
import configurations from "./common/configurations";

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
    model: "gemini-2.5-flash-image-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: userSchema,
    },
});

const CHARACTERS_FILE = "characters.json"


export function saveCharacterProfiles() {
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(characters, null, 2));
}
