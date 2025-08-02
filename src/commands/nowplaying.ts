import { Command } from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    InteractionContextType, type MessageActionRowComponentBuilder,
    SlashCommandBuilder
} from "discord.js";

import { getSongOnPreferredProvider, lobotomizedSongButton, musicCache, nowPlayingView } from "../music.ts"
import { type Config } from "../config.ts";
import { hash } from "crypto"

async function getNowPlaying(username: string, lastFMApiKey?: string, lastFMFetchLink?: boolean): Promise<{
    songName: string, artistName: string, link: string
} | false | undefined> {
    if (!lastFMApiKey) {
        const res = await fetch(`https://api.listenbrainz.org/1/user/${username}/playing-now`).then((res) => res.json());
        if (!res?.payload) return
        else if (res.payload.count === 0) return false
        else {
            const trackMetadata = res.payload.listens[0].track_metadata
            return {
                songName: trackMetadata.artist_name,
                artistName: trackMetadata.track_name,
                link: trackMetadata.additional_info.origin_url
            }
        }
    } else {
        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${lastFMApiKey}&limit=1&format=json`)
            .then((res) => res.json());
        if (!res?.recenttracks) return
        else if (!res.recenttracks?.track?.[0]) return false
        else {
            const track = res.recenttracks.track[0]
            // yes its a string, horror
            if (track["@attr"]?.nowplaying !== "true") return false
            // it also doesnt provide a streaming platform url, im sorry i have to do this
            let link = ""
            if (lastFMFetchLink) {
                const page = await (await fetch(track.url)).text()
                const match = page.match(/class="header-new-playlink"\s+href="(.+?)"/m)
                if (match) link = match[1]
            }
            return {
                songName: track.name,
                artistName: track.artist["#text"],
                link
            }
        }
    }
}

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        await interaction.deferReply()
        const user = interaction.options.getString("user") ?? config.listenbrainzAccount!;
        const lobotomized = interaction.options.getBoolean("lobotomized") ?? config.commandDefaults.nowplaying.lobotomized;
        const useLastFM = interaction.options.getBoolean("uselastfm") ?? config.commandDefaults.nowplaying.useLastFM
        let useSonglink = interaction.options.getBoolean("usesonglink") ?? config.commandDefaults.nowplaying.useSonglink
        const useiTunes = interaction.options.getBoolean("useitunes") ?? config.commandDefaults.nowplaying.useItunes

        const nowPlaying = await getNowPlaying(user, useLastFM ? config.lastFMApiKey : undefined, !useiTunes)
        if (typeof nowPlaying === "undefined") {
            await interaction.followUp("something shat itself!");
            return;
        } else if (!nowPlaying) {
            await interaction.followUp(user + " isn't listening to music");
            return
        } else {
            const paramsObj = { entity: "song", term: `${nowPlaying.artistName} ${nowPlaying.songName}` };
            const searchParams = new URLSearchParams(paramsObj);
            let { link } = nowPlaying
            if (useiTunes) {
                const itunesinfo = (await (await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`)).json()).results[0];
                link = itunesinfo?.trackViewUrl
                if (!link) {
                    await interaction.followUp("something shat itself!");
                    return;
                }
            }

            if (!link) useSonglink = false
            let preferredApi, songlink, isCached = false
            if (link && musicCache[link]) {
                preferredApi = musicCache[link].preferredApi
                songlink = musicCache[link].songlink
                isCached = true
            } else if (useSonglink) {
                songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
                preferredApi = getSongOnPreferredProvider(songlink, link)
            }

            if (preferredApi && useSonglink) {
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
                        components,
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
                        name: nowPlaying.artistName
                    })
                    .setTitle(nowPlaying.songName)
                    .setFooter({
                        text: "song.link proxying was turned off or failed - amy jr",
                    });

                await interaction.followUp({ embeds: [embedfallback] })
            }
        }

    }

    button = lobotomizedSongButton
    dependsOn = ['listenbrainzAccount', 'lastFMApiKey']
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
            return option.setName("uselastfm").setDescription("use last.fm or not").setRequired(false)
        })
        .addBooleanOption(option => {
            return option.setName("useitunes").setDescription("use itunes or not").setRequired(false)
        })
        .addStringOption(option => {
            return option.setName("user").setDescription("username").setRequired(false)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
