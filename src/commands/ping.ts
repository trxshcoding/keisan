import {Command} from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { Config } from "../config.ts";

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.reply({
            content: 'Pong!',
        });
    }

    slashCommand = new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Pong!").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
