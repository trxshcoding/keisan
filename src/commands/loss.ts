import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle, ContainerBuilder,
    InteractionContextType, type MessageActionRowComponentBuilder, MessageFlags,
    SlashCommandBuilder
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import { declareCommand } from "../command.ts";

export default declareCommand({
    dependsOn: NO_EXTRA_CONFIG,
    async run(interaction, config) {
        const components = [
            new ContainerBuilder()
                .addActionRowComponents(
                    new ActionRowBuilder<MessageActionRowComponentBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Secondary)
                                .setLabel("|")
                                .setCustomId("a"),
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Secondary)
                                .setLabel("|i")
                                .setCustomId("b"),
                        ),
                )
                .addActionRowComponents(
                    new ActionRowBuilder<MessageActionRowComponentBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Secondary)
                                .setLabel("||")
                                .setCustomId("c"),
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Secondary)
                                .setLabel("|_")
                                .setCustomId("d"),
                        ),
                ),
        ];
        await interaction.reply({
            components: components,
            flags: [MessageFlags.IsComponentsV2],
        });
    },
    async button(interaction, config) {
        await interaction.reply({
            content: "its loss, why are you clicking the buttons",
            flags: [MessageFlags.Ephemeral]
        })
    },
    slashCommand: new SlashCommandBuilder()
        .setName("loss")
        .setDescription("why").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ])
})