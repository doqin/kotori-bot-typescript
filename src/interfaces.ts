import { Part } from "@google/generative-ai";

export interface UserProfile {
    personality: string,
    summary: string,
    facts: string[],
}

export interface ChatMessage {
    role: "user" | "model";
    userId: string;
    parts: ({ text: string } | Part)[];
    timestamp: number;
}

export interface ChatHistory {
    messages: ChatMessage[];
}