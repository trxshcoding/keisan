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

import { getSongOnPreferredProvider, itunesResponseShape, lobotomizedSongButton, musicCache, songView } from "../music.ts"
import { type Config } from "../config.ts";
import { hash } from "crypto"
import { escapeMarkdown } from "../util.ts";

async function getNowPlaying(username: string, lastFMApiKey?: string): Promise<{
    songName: string, artistName: string, albumName?: string, link?: string
} | false | undefined> {
    if (!lastFMApiKey) {
        const res = await fetch(`https://api.listenbrainz.org/1/user/${username}/playing-now`).then((res) => res.json());
        if (!res?.payload) return
        else if (res.payload.count === 0) return false
        else {
            const trackMetadata = res.payload.listens[0].track_metadata
            return {
                songName: trackMetadata.track_name,
                artistName: trackMetadata.artist_name,
                albumName: trackMetadata.release_name,
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
            return {
                songName: track.name,
                artistName: track.artist["#text"],
                albumName: track.album["#text"]
            }
        }
    }
}

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config): Promise<void> {
        await interaction.deferReply()
        const user = interaction.options.getString("user") ?? config.musicAccount!;
        const lobotomized = interaction.options.getBoolean("lobotomized") ?? config.commandDefaults.nowplaying.lobotomized;
        const useLastFM = interaction.options.getBoolean("uselastfm") ?? config.commandDefaults.nowplaying.useLastFM
        let useSonglink = interaction.options.getBoolean("usesonglink") ?? config.commandDefaults.nowplaying.useSonglink
        const useiTunes = interaction.options.getBoolean("useitunes") ?? config.commandDefaults.nowplaying.useItunes

        const nowPlaying = await getNowPlaying(user, useLastFM ? config.lastFMApiKey : undefined)
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
            if (!link || useiTunes) {
                const iTunesInfo = itunesResponseShape.safeParse(
                    await (await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`)).json()
                ).data?.results

                if (Array.isArray(iTunesInfo) && iTunesInfo[0]) {
                    const track = (iTunesInfo.find((res) => res.trackName === nowPlaying.songName)
                        || iTunesInfo.find((res) => res.trackName.toLowerCase() === nowPlaying.songName.toLowerCase())
                        || iTunesInfo[0])
                    link = track.trackViewUrl
                    nowPlaying.albumName ??= track.collectionName
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
                preferredApi = getSongOnPreferredProvider(songlink, link!)
            }

            if (preferredApi && useSonglink && link) {
                if (!isCached) musicCache[link] ??= {
                    preferredApi,
                    songlink
                }
                if (link.length > 100)
                    musicCache[link].hash = hash("md5", link)

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
                                    .setCustomId(musicCache[link].hash || link),
                            ),
                    ];
                    await interaction.followUp({
                        content: `### ${escapeMarkdown(preferredApi.title)} ${emoji}
-# by ${escapeMarkdown(preferredApi.artist)}${nowPlaying.albumName ? ` - from ${escapeMarkdown(nowPlaying.albumName)}` : ""}`,
                        components,
                    })
                    // we don't have infinite emoji slots
                    await emoji.delete()
                    return
                }
                const components = songView(songlink, preferredApi, nowPlaying.albumName)
                await interaction.followUp({
                    components,
                    flags: [MessageFlags.IsComponentsV2],
                })
            } else {
                const embedFallback = new EmbedBuilder()
                    .setAuthor({
                        name: escapeMarkdown(nowPlaying.artistName)
                    })
                    .setTitle(escapeMarkdown(nowPlaying.songName))
                    .setFooter({
                        text: "song.link proxying was turned off or failed - amy jr",
                    });
                if (nowPlaying.albumName) embedFallback.setDescription(`from ${nowPlaying.albumName}`)

                await interaction.followUp({ embeds: [embedFallback] })
            }
        }

    }

    button = lobotomizedSongButton
    dependsOn = ['musicAccount', 'lastFMApiKey']
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
