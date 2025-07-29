import { Command } from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction, ContainerBuilder,
    EmbedBuilder,
    MessageFlags,
    InteractionContextType, type MessageActionRowComponentBuilder, MessageFlagsBitField,
    SlashCommandBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, type ButtonInteraction
} from "discord.js";

import { getSongOnPreferredProvider, kyzaify, lobotomizedSongButton, musicCache, nowPlayingView, type Song } from "../music.ts"
import { type Config } from "../config.ts";
import { hash } from "crypto"

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        await interaction.deferReply()
        const user = interaction.options.getString("user") ?? config.listenbrainzAccount;
        const lobotomized = interaction.options.getBoolean("lobotomized") ?? config.commandDefaults.nowplaying.lobotomized;
        const usesonglink = interaction.options.getBoolean("usesonglink") ?? config.commandDefaults.nowplaying.useSonglink
        const useitunes = interaction.options.getBoolean("useitunes") ?? config.commandDefaults.nowplaying.useItunes
        const meow = await fetch(`https://api.listenbrainz.org/1/user/${user}/playing-now`).then((res) => res.json());
        if (!meow) {
            await interaction.followUp("something shat itself!");
            return;
        }
        if (meow.payload.count === 0) {
            await interaction.followUp(user + " isnt listening to music");
        } else {
            const track_metadata = meow.payload.listens[0].track_metadata
            const paramsObj = { entity: "song", term: track_metadata.artist_name + " " + track_metadata.track_name };
            const searchParams = new URLSearchParams(paramsObj);
            let link = track_metadata.additional_info.origin_url
            if (useitunes) {
                const itunesinfo = (await (await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`)).json()).results[0];
                link = itunesinfo.trackViewUrl
            }
            
            let preferredApi, songlink, isCached = false
            if (musicCache[link]) {
                preferredApi = musicCache[link].preferredApi
                songlink = musicCache[link].songlink
                isCached = true
            } else {
                songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
                preferredApi = getSongOnPreferredProvider(songlink, link)
            }

            if (preferredApi && usesonglink) {
                if (!isCached) musicCache[link] ??= {
                    preferredApi,
                    songlink
                }

                if (lobotomized) {
                    const emoji = await interaction.client.application.emojis.create({
                        attachment: preferredApi.thumbnailUrl,
                        name: hash("md5", preferredApi.thumbnailUrl),
                    });

                    const components = [
                        new ActionRowBuilder<MessageActionRowComponentBuilder>()
                            .addComponents(
                                new ButtonBuilder()
                                    .setStyle(ButtonStyle.Secondary)
                                    .setLabel("expand")
                                    .setCustomId(link),
                            ),
                    ];
                    await interaction.followUp({
                        content: `### ${preferredApi.title.replace(/([#*_~`|])/g, "\\$1")} ${emoji}\n-# by ${preferredApi.artist}`,
                        components: components,
                    })
                    // we dont have infinite emoji slots
                    await emoji.delete()
                    return
                }
                const components = nowPlayingView(songlink, preferredApi)
                await interaction.followUp({
                    components,
                    flags: [MessageFlags.IsComponentsV2],
                })
            } else {
                const embedfallback = new EmbedBuilder()
                    .setAuthor({
                        name: meow.payload.listens[0].track_metadata.artist_name
                    })
                    .setTitle(meow.payload.listens[0].track_metadata.track_name)
                    .setFooter({
                        text: "song.link proxying was turned off or failed - amy jr",
                    });

                await interaction.followUp({ embeds: [embedfallback] })
            }
        }

    }

    button = lobotomizedSongButton

    slashCommand = new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("balls").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addBooleanOption(option => {
            return option.setName("lobotomized").setDescription("smol").setRequired(false);
        })
        .addBooleanOption(option => {
            return option.setName("usesonglink").setDescription("use songlink or not").setRequired(false)
        })
        .addBooleanOption(option => {
            return option.setName("useitunes").setDescription("use itunes or not").setRequired(false)
        })
        .addStringOption(option => {
            return option.setName("user").setDescription("listenbrainz username").setRequired(false)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
