export type ktrMessage = {
    username: string;
    display_name: string;
    role: "user" | "model";
    content: string;
    timestamp: string;
    mime_type?: string | null;
    data?: string | null;
};

export type ktrChatHistory = {
    isDM: boolean;
    serverId: string | null;
    messages: ktrMessage[];
};

export type UserProfile = {
    personality: string,
    summary: string,
    facts: string[]
};