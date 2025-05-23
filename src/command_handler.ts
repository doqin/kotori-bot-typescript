
import { ChatInputCommandInteraction, PermissionFlagsBits, Interaction, ChannelType } from "discord.js";

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
        await interaction.reply(`Profile cleared for **${user.username}**.`);
    } else if (target === "history") {
        await interaction.reply(`Chat history cleared for **${user.username}**.`)
    } else {
        await interaction.reply("Invalid option.");
    }
}

async function modclearCommand(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getString("target");
    const channel = interaction.channel;
    const channelId = interaction.channelId;
    let channelName: string;

    if (!channel) {
        channelName = "Unknown Channel";
    } else if (channel.type === ChannelType.DM) {
        channelName = "Direct Message";
    } else if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
        channelName = channel.name;
    } else {
        channelName = "Unknown";
    }

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
        await interaction.reply(`Profile cleared for **${user.username}**.`);
    } else if (target === "history") {
        await interaction.reply(`Chat history cleared for **${user.username}**.`)
    } else if (target === "chat") {
        await interaction.reply(`Chat cleared for **${channelName}**.`)
    } else {
        await interaction.reply("Invalid option.");
    }
}