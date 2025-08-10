import { declareCommand } from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.reply({
            content: 'Pong!',
        });
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Pong!").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
