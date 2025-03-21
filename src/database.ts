import Database from "better-sqlite3";
import fs from "fs";

const db = new Database("chat.db");

const schema = fs.readFileSync("schema.sql", "utf-8");
db.exec(schema);

export default db;