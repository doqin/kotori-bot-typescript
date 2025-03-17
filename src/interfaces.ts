export interface UserProfile {
    personality: string,
    summary: string,
    facts: string[],
}

interface ChatMessage {
    role: "user" | "model";
    userId: string;
    parts: { text: string }[];
    timestamp: number;
}

export interface ChatHistory {
    messages: ChatMessage[];
}