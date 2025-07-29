import {Command} from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, type ButtonInteraction, ButtonStyle,
    ChatInputCommandInteraction, ContainerBuilder,
    InteractionContextType, type MessageActionRowComponentBuilder, MessageFlags,
    SlashCommandBuilder
} from "discord.js";
import { type Config } from "../config.ts";

export default class LossCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
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
    }
    async button(interaction:ButtonInteraction, config:Config){
        await interaction.reply({
            content: "its loss, why are you clicking the buttons",
            flags: [MessageFlags.Ephemeral]
        })
    }
    slashCommand = new SlashCommandBuilder()
        .setName("loss")
        .setDescription("why").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
