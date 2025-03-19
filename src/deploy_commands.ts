import { REST, Routes, SlashCommandBuilder, InteractionContextType, PermissionFlagsBits } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const contexts = [
    InteractionContextType.Guild,
    InteractionContextType.BotDM,
    InteractionContextType.PrivateChannel
];

const commands = [
    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!")
        .setContexts(contexts),
    new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear a user's data from the bot's memory")
        .addStringOption(option =>
            option.setName("target")
                .setDescription("What do you want to clear?")
                .setRequired(true)
                .addChoices(
                    { name: "Profile", value: "profile" },
                    { name: "History", value: "history" }
                )
        )
        .setContexts(contexts),
    new SlashCommandBuilder()
        .setName("modclear")
        .setDescription("Clear a user's data from the bot's memory")
        .addStringOption(option =>
            option.setName("target")
                .setDescription("What do you want to clear?")
                .setRequired(true)
                .addChoices(
                    { name: "Profile", value: "profile" },
                    { name: "History", value: "history" }
                )
        )
        .addUserOption(option =>
            option.setName("user")
                .setDescription("Select a user")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setContexts(contexts)
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