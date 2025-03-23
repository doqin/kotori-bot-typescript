import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

// Function to initialize the database
export default async function connectDB(): Promise<Database> {
    return open({
        filename: "chat.db",
        driver: sqlite3.Database,
    });
}