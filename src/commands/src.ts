import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction, EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { declareCommand } from "../command";
import { z } from "zod";

export default declareCommand({
    async run(interaction, config) {
        const repo = interaction.options.getString("repo")
        const meow = await fetch(config.gitapi! + repo).then(res => res.json());
        const embed = new EmbedBuilder()
            .setAuthor({
                name: meow.name,
            })
            .setTitle(meow.description)
            .setImage(meow.owner.avatar_url);
        const nya = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setURL(meow.html_url).setLabel("link").setStyle(ButtonStyle.Link))
        await interaction.reply({
            components: [
                nya
            ],
            embeds: [embed],
        });
    },
    dependsOn: z.object({
        gitapi: z.string(),
    }),
    slashCommand: new SlashCommandBuilder()
        .setName("src")
        .setDescription("get src of shit").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
            return option.setName("repo").setDescription("name").setRequired(true);
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ])
})