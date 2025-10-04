import {declareCommand} from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType, SlashCommandBooleanOption,
    SlashCommandBuilder, SlashCommandStringOption, SlashCommandSubcommandBuilder
} from "discord.js";
import {NO_EXTRA_CONFIG, type Config} from "../config.ts";

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        const command = interaction.options.getSubcommand(true)
        switch (command) {
            case "status": {

            }
        }
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Pong!").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("status")
                .setDescription("get marriage status")
        )
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
