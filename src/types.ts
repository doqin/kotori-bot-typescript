export type ktrMessage = {
    username: string;
    display_name: string;
    content: string;
    timestamp: string;
    mime_type?: string | null;
    data?: Buffer | null;
};

export type UserProfile = {
    personality: string,
    summary: string,
    facts: string[]
};