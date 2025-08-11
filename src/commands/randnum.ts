import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { declareCommand } from "../command.ts";
import { NO_EXTRA_CONFIG } from "../config.ts";

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config) {
        const upperbound = interaction.options.getInteger("upperbound")!;
        const comment = interaction.options.getString("comment");

        if (comment === null) {
            await interaction.reply({
                content: "random number is: " + `${Math.floor(Math.random() * upperbound)}`,
            });
            return
        }
        await interaction.reply({
            content: `chances of ${comment} out of ${upperbound} is ${Math.floor(Math.random() * upperbound)}`,
        });

    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("randnum")
        .setDescription("random number").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addIntegerOption(option => {
            return option.setName("upperbound").setRequired(true).setDescription("idk nea told me")
        }).addStringOption(option => {
            return option.setName("comment").setRequired(false).setDescription("comment")
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})