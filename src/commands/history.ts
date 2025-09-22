import { declareCommand } from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    ContainerBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder,
    TextDisplayBuilder,
    type MessageActionRowComponentBuilder
} from "discord.js";
import { z } from "zod";
import { getSongOnPreferredProvider, itunesResponseShape, musicCache, songView } from "../music.ts";
import { escapeMarkdown } from "../util.ts";


type HistoryItem = {
    songName: string, artistName: string, albumName?: string, link?: string
}
async function getHistory(username: string, lastFMApiKey?: string): Promise<HistoryItem[] | undefined> {
    if (!lastFMApiKey) {
        const res = await fetch(`https://api.listenbrainz.org/1/user/${username}/listens`).then((res) => res.json());
        if (!res?.payload) return
        else {
            return res.payload.listens.map((l: any) => ({
                songName: l.track_metadata.track_name,
                artistName: l.track_metadata.artist_name,
                albumName: l.track_metadata.release_name,
                link: l.track_metadata.additional_info?.origin_url
            }))
        }
    } else {
        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${lastFMApiKey}&format=json`)
            .then((res) => res.json());
        if (!res?.recenttracks) return
        else {
            const tracks = res.recenttracks.track
            if (!tracks) return
            return tracks.filter((t: any) => !t["@attr"]?.nowplaying).map((t: any) => ({
                songName: t.name,
                artistName: t.artist["#text"],
                albumName: t.album["#text"]
            }))
        }
    }
}

const songEmbed = (h: HistoryItem[], pos: number, username: string, useLastFM: boolean) =>
    new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`### ${escapeMarkdown(h[pos].songName)}
-# by ${escapeMarkdown(h[pos].artistName)}${h[pos].albumName ? ` - from ${escapeMarkdown(h[pos].albumName)}` : ""}`),
        )
        .addActionRowComponents(
            new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji({
                            name: "⬅️",
                        })
                        .setCustomId(`back-${pos - 1}-${username}-${useLastFM ? "f" : "l"}`)
                        .setDisabled(pos === 0),
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("expand")
                        .setCustomId(`expand-${pos}-${username}-${useLastFM ? "f" : "l"}`),
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji({
                            name: "➡️",
                        })
                        .setCustomId(`forward-${pos + 1}-${username}-${useLastFM ? "f" : "l"}`)
                        .setDisabled(pos === h.length - 1),
                ),
        )

const historyCache = {
    listenbrainz: {} as { [k: string]: HistoryItem[] },
    lastfm: {} as { [k: string]: HistoryItem[] }
}

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config) {
        await interaction.deferReply()
        const entry = await config.prisma.user.findFirst({
            where: { id: interaction.user.id }
        })
        let user = interaction.options.getString("user");
        let useLastFM = interaction.options.getBoolean("uselastfm");

        if (entry?.musicUsername) {
            user ??= entry.musicUsername;
            useLastFM ??= !entry.musicUsesListenbrainz;
        }

        if (user === null || useLastFM === null) {
            await interaction.followUp({
                content: "you don't have a music account saved. use the `/config nowplaying` command to save them, or specify them as arguments to only use once",
                flags: [MessageFlags.Ephemeral]
            })
            return
        }

        const history = await getHistory(user, useLastFM ? config.lastFMApiKey : undefined)
        if (!history || history.length === 0) {
            await interaction.followUp({
                content: "that user hasn't listened to anything lately",
                flags: [MessageFlags.Ephemeral]
            })
            return
        }
        historyCache[useLastFM ? "lastfm" : "listenbrainz"][user] = history

        await interaction.followUp({
            components: [
                songEmbed(history, 0, user, useLastFM)
            ],
            flags: [MessageFlags.IsComponentsV2]
        })
    },
    async button(interaction, config) {
        const [customId, posStr, username, platformLetter] = interaction.customId.split("-")
        const pos = Number(posStr)
        const platform = platformLetter === "f" ? "lastfm" : "listenbrainz"

        const history = historyCache[platform][username]
        if (!history || !history[pos]) {
            await interaction.followUp({
                content: "how",
                flags: [MessageFlags.Ephemeral]
            })
            return
        }

        switch (customId) {
            case "back":
            case "forward": {
                if (interaction.user.id !== interaction.message.interactionMetadata?.user.id) {
                    await interaction.deferUpdate()
                    return
                }
                await interaction.update({
                    components: [
                        songEmbed(history, pos, username, platform === "lastfm")
                    ],
                    flags: [MessageFlags.IsComponentsV2]
                })
                break
            }
            case "expand": {
                await interaction.deferReply({
                    flags: [MessageFlags.Ephemeral]
                })
                const item = history[pos]
                let link = history[pos].link
                if (!link && platform === "lastfm") {
                    const paramsObj = { entity: "song", term: `${item.artistName} ${item.songName}` };
                    const searchParams = new URLSearchParams(paramsObj);
                    const iTunesInfo = itunesResponseShape.safeParse(
                        await (await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`)).json()
                    ).data?.results

                    if (Array.isArray(iTunesInfo) && iTunesInfo[0]) {
                        const track = (iTunesInfo.find((res) => res.trackName === item.songName)
                            || iTunesInfo.find((res) => res.trackName.toLowerCase() === item.songName.toLowerCase())
                            || iTunesInfo[0])
                        link = track.trackViewUrl
                        item.albumName ??= track.collectionName
                    }
                }
                if (!link) {
                    await interaction.followUp({
                        content: "couldn't find a link for that song, sorry",
                        flags: [MessageFlags.Ephemeral]
                    })
                    return
                }

                const songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
                const preferredApi = getSongOnPreferredProvider(songlink, link!)!
                musicCache[songlink.pageUrl] ??= {
                    preferredApi,
                    songlink
                }

                const components = songView(songlink, preferredApi, item.albumName)
                await interaction.followUp({
                    components,
                    flags: [MessageFlags.IsComponentsV2],
                })
            }
        }
    },

    dependsOn: z.object({
        lastFMApiKey: z.string()
    }),
    slashCommand: new SlashCommandBuilder()
        .setName("history")
        .setDescription("get the song history of a user").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addStringOption(option => {
            return option.setName("user").setDescription("username").setRequired(false)
        })
        .addBooleanOption(option => {
            return option.setName("uselastfm").setDescription("use last.fm or not").setRequired(false)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
