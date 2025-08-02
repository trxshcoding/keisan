import {Command} from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { type Config } from "../config.ts";

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        const upperbound = interaction.options.getInteger("upperbound")!;
        const comment = interaction.options.getString("comment");

        if (comment === null){
            await interaction.reply({
                content: "random number is: " + `${Math.floor(Math.random() * upperbound)}`,
            });
            return
        }
        await interaction.reply({
            content: `chances of ${comment} out of ${upperbound} is ${Math.floor(Math.random() * upperbound)}`,
        });

    }
    dependsOn = []
    slashCommand = new SlashCommandBuilder()
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
        ]);
}
