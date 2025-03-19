
import { ChatInputCommandInteraction, PermissionFlagsBits, Interaction } from "discord.js";
import { saveHistory } from "./chat_history_handler";
import { updateUserProfile } from "./user_profile_handler";
import { userHistories, userProfiles, USER_HISTORY_FILE } from "./generate_message";

export async function commandHandler(interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "ping") {
        await interaction.reply("Pong! 🏓");
    }

    if (interaction.commandName === "clear") {
        await clearCommand(interaction);
    }

    if (interaction.commandName === "modclear") {
        await modclearCommand(interaction);
    }
}

async function clearCommand(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getString("target");
    const user = interaction.user;
    const userId = user.id;
    if (target === "profile") {
        delete userProfiles[userId];
        await interaction.reply(`Profile cleared for **${user.username}**.`);
        await updateUserProfile(userId);
    } else if (target === "history") {
        delete userHistories[userId];
        await interaction.reply(`Chat history cleared for **${user.username}**.`)
        await saveHistory(userHistories, USER_HISTORY_FILE);
    } else {
        await interaction.reply("Invalid option.");
    }
}

async function modclearCommand(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getString("target");
    const user = interaction.options.getUser("user") || interaction.user;
    const userId = user.id;

    const isSelf = interaction.user.id === userId;
    const isMod = interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
    const isOwner = interaction.guild?.ownerId === interaction.user.id;

    if (!isSelf && !isMod && !isOwner) {
        return await interaction.reply({
          content: "You don't have permission to clear another user's data!",
          ephemeral: true,
        });
    }

    if (target === "profile") {
        delete userProfiles[userId];
        await interaction.reply(`Profile cleared for **${user.username}**.`);
        await updateUserProfile(userId);
    } else if (target === "history") {
        delete userHistories[userId];
        await interaction.reply(`Chat history cleared for **${user.username}**.`)
        await saveHistory(userHistories, USER_HISTORY_FILE);
    } else {
        await interaction.reply("Invalid option.");
    }
}