import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, type ButtonInteraction, ButtonStyle,
    ChatInputCommandInteraction,
    InteractionContextType,
    type MessageActionRowComponentBuilder, MessageFlags,
    type ModalActionRowComponentBuilder,
    ModalBuilder,
    type ModalSubmitInteraction,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import { AmyodalBuilder } from "../util.ts";
import { declareCommand } from "../command.ts";
const slashCommand = new SlashCommandBuilder()
        .setName("modaltest")
        .setDescription("test yo modal").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config) {
        await interaction.reply({
            content: "arent you curious about yo paws????",
            components: [
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel("calculate your paw size!")
                            .setCustomId("balls idk"),
                    ),
            ],
        })
    },
    async button(interaction: ButtonInteraction, config: Config) {
        await interaction.showModal(
            new AmyodalBuilder(slashCommand)
                .setCustomId("balls")
                .setTitle('meowing calculator')
                .addComponents(
                    new ActionRowBuilder<ModalActionRowComponentBuilder>()
                        .addComponents(
                            new TextInputBuilder()
                                .setCustomId('pawSize')
                                .setLabel("how big is yo paws")
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder("really big")
                        )
                )
        )
    },
    async modal(interaction: ModalSubmitInteraction, config: Config) {
        console.log(interaction);
        await interaction.reply({
            content: `${interaction.user.username}'s paw size is ${interaction.fields.fields.get("pawSize")!.value ?? "nothing"}`,
        })
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand,
})
