import { REST, Routes, SlashCommandBuilder, InteractionContextType } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!")
        .setContexts([
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ]),
].map(command => command.toJSON());

const rest = new REST({ version: "10"}).setToken(TOKEN || "");

(async () => {
    try {
        console.log("Refreshing slash commands...");
        await rest.put(
            Routes.applicationCommands(CLIENT_ID || ""),
            { body: commands }
        )
        console.log("Slash commands registered!");
    } catch (error) {
        console.error("Failed to refresh slash commands:" , error);
    }
})();