import { Command } from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ContainerBuilder,
    InteractionContextType,
    MessageFlags,
    SectionBuilder,
    SlashCommandBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    type MessageActionRowComponentBuilder
} from "discord.js";
import { type Config } from "../config.ts";

export default class RadioCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
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
    }
    dependsOn = ["radioURL", "radioName"]
    slashCommand = new SlashCommandBuilder()
        .setName("radio")
        .setDescription("see whats playing on the radio").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
