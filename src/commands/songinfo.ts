import {Command} from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction, ContainerBuilder, EmbedBuilder,
    InteractionContextType, MessageFlags, SectionBuilder,
    SlashCommandBuilder, TextDisplayBuilder, ThumbnailBuilder
} from "discord.js";
import { type Config } from "../config.ts";
import {getSongOnPreferredProvider, kyzaify} from "../music.ts";

export default class MusicInfoCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply()
        const link = interaction.options.getString("link")!
        const info = await fetch("https://api.song.link/v1-alpha.1/links?url=" + link).then((res) => res.json());

        const meow = Object.keys(info.linksByPlatform)

        const nya: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();
        const infoPreferred = getSongOnPreferredProvider(info, link)!
        const components = [
            new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .setThumbnailAccessory(
                            new ThumbnailBuilder()
                                .setURL(infoPreferred.thumbnailUrl)
                        )
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`# ${infoPreferred.artist} - ${infoPreferred.title}`),
                        ),
                )
        ];
        for (const meowi of meow) {
            if (currentRow.components.length >= 4) {
                nya.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
            }
            currentRow.addComponents(
                new ButtonBuilder()
                    .setURL(info.linksByPlatform[meowi].url)
                    .setLabel(kyzaify(meowi))
                    .setStyle(ButtonStyle.Link)
            );
        }
        if (currentRow.components.length > 0) {
            nya.push(currentRow);
        }
        components[0].addActionRowComponents(nya)

        await interaction.followUp({
            components,
            flags: [MessageFlags.IsComponentsV2],
        });

    }
    dependsOn = []
    slashCommand = new SlashCommandBuilder()
        .setName("musicinfo")
        .addStringOption(option =>{
            return option.setName("link").setDescription("link").setRequired(true);
        })
        .setDescription("meow")
        .setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
