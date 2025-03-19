
import { Interaction } from "discord.js";

export async function commandHandler(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "ping") {
        await interaction.reply("Pong! 🏓");
    }
}