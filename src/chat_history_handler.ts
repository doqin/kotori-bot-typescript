import fs from "fs"

const HISTORY_FILE = "chat_history.json";

export function loadHistory(): Record<string, { role: "user" | "model"; parts: { text: string }[] }[]> {
    try {
        if (!fs.existsSync(HISTORY_FILE)) {
            return {};
        }

        const data = fs.readFileSync(HISTORY_FILE, "utf-8").trim();
        
        if (!data) {
            return {};
        }

        return JSON.parse(data);
    } catch (error) {
        console.error("Error loading history:", error);
        return {};
    }
}

export function saveHistory(chatHistories: Record<string, { role: "user" | "model"; parts: { text: string }[] }[]>) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistories, null, 2));
}