import fs from "fs"
import { ChatHistory } from "./interfaces";
import { addLog } from ".";

type ChatHistories = Record<string, ChatHistory>;

export function loadHistory(file: string): ChatHistories {
    try {
        if (!fs.existsSync(file)) return {};

        const data = fs.readFileSync(file, "utf-8").trim();
        return data ? JSON.parse(data) as ChatHistories : {};
    } catch (error) {
        // console.error("Error loading history:", error);
        addLog(`Error loading history: ${error}`);
        return {};
    }
}

export function saveHistory(histories: ChatHistories, file: string): void {
    try {
        fs.writeFileSync(file, JSON.stringify(histories, null, 2));
    } catch (error) {
        // console.error("Error saving history:", error);
        addLog(`Error saving history: ${error}`);
    }
}
