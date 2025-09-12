export type ktrMessage = {
    username: string;
    display_name: string;
    role: "user" | "assistant";
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
    summary: string
};

export type OpenRouterMessage = {
    role: "user" | "assistant";
    content: string
}