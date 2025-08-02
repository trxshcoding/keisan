import {Command} from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, type ButtonInteraction, ButtonStyle,
    ChatInputCommandInteraction, ContextMenuCommandInteraction,
    InteractionContextType, type MessageActionRowComponentBuilder, MessageFlags,
    SlashCommandBuilder
} from "discord.js";
import type {Config} from "../config.ts";

export default class ButtonTestCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.reply({
            components: [new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("oh hey look a button that probably wont fucking work because im fucking stupid")
                        .setCustomId("620442791f594d7281b24a608a73e687"),
                )], flags: [MessageFlags.IsComponentsV2]
        });
    }

    async button(interaction: ButtonInteraction, config: Config): Promise<void> {
        console.log(interaction.customId);
        await interaction.reply({
            content: "ur cute",
            flags: [MessageFlags.Ephemeral]
        })
    }
    dependsOn = []
    slashCommand = new SlashCommandBuilder()
        .setName("buttontest")
        .setDescription("test the button").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}