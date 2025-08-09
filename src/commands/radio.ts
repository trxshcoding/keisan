import { declareCommand } from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    InteractionContextType,
    MessageFlags,
    SectionBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    type MessageActionRowComponentBuilder
} from "discord.js";
import { z } from "zod";

export default declareCommand({
    async run(interaction, config) {
        await interaction.deferReply()
        const nowplaying = (await (await fetch(`${config.radioURL}/api/nowplaying/${config.radioName}`)).json()).now_playing.song
        const components = [
            new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .setThumbnailAccessory(
                            new ThumbnailBuilder()
                                .setURL(nowplaying.art)
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent("# " + nowplaying.title),
                        ),
                )
                .addActionRowComponents(
                    new ActionRowBuilder<MessageActionRowComponentBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Link)
                                .setLabel("join the radio")
                                .setURL(`${config.radioURL}/public/${config.radioName}`),
                        ),
                ),
        ];

        await interaction.followUp({
            components: components,
            flags: [MessageFlags.IsComponentsV2],
        })
    },
    dependsOn: z.object({
        radioURL: z.string(),
        radioName: z.string(),
    }),
    slashCommand: new SlashCommandBuilder()
        .setName("radio")
        .setDescription("see whats playing on the radio").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})