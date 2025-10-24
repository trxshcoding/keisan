import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    MessageFlags,
    InteractionContextType, type MessageActionRowComponentBuilder,
    SlashCommandBuilder
} from "discord.js";

import { getSongOnPreferredProvider, itunesResponseShape, lobotomizedSongButton, musicCache, songView } from "../music.ts"
import { hash, randomUUID } from "crypto"
import {escapeMarkdown, mbApi} from "../util.ts";
import sharp from "sharp";
import { declareCommand } from "../command.ts";
import { z } from "zod";

const slashCommand = new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("balls").setIntegrationTypes([
        ApplicationIntegrationType.UserInstall
    ])
    .addStringOption(option => {
        return option.setName("user").setDescription("username").setRequired(false)
    })
    .addBooleanOption(option => {
        return option.setName("uselastfm").setDescription("use last.fm or listenbrainz").setRequired(false)
    })
    .addUserOption(option => {
        return option.setName("discord_user").setDescription("a user with their music account saved by the bot. has priority over other options").setRequired(false)
    })
    .setContexts([
        InteractionContextType.BotDM,
        InteractionContextType.Guild,
        InteractionContextType.PrivateChannel
    ])
import type { IRelease } from "musicbrainz-api";

type HistoryItem = {
    songName: string, artistName: string, albumName?: string, link?: string, mbid?: string
}
async function getNowPlaying(username: string, lastFMApiKey?: string): Promise<HistoryItem | false | undefined> {
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
                link: trackMetadata.additional_info.origin_url,
                mbid: trackMetadata.additional_info.release_mbid
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
                albumName: track.album["#text"],
                mbid: track.mbid
            }
        }
    }
}

async function getMusicBrainzInfo(release: IRelease, songTitle: string): Promise<{
    songname: string,
    albumname: string,
    albumartlink: string
} | null> {
    const albumname = release.title;
    const track = release.media?.flatMap(m => m.tracks).find(t => t.title.toLowerCase() === songTitle.toLowerCase())
        ?? release.media?.[0]?.tracks?.[0];

    const songname = track?.title ?? songTitle;

    const coverArtUrl = `https://coverartarchive.org/release/${release.id}/front`;
    try {
        const response = await fetch(coverArtUrl, { method: 'HEAD' });
        if (!response.ok) {
            return null;
        }
        return { songname, albumname, albumartlink: response.url };
    } catch (error) {
        console.error("Failed to fetch cover art:", error);
        return null;
    }
}

async function createResizedEmoji(interaction: ChatInputCommandInteraction, imageUrl: string) {
    try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            console.error(`Failed to fetch image for emoji: ${imageResponse.statusText}`);
            return null;
        }
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

        const resizedImageBuffer = await sharp(imageBuffer)
            .resize(128, 128)
            .toBuffer();

        return await interaction.client.application.emojis.create({
            attachment: resizedImageBuffer,
            name: hash("md5", imageUrl),
        });
    } catch (error) {
        console.error("Failed to create resized emoji:", error);
        return null;
    }
}

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config): Promise<void> {
        await interaction.deferReply()
        const otherUser = interaction.options.getUser("discord_user")
        let user: string | null;
        let useLastFM: boolean | null;

        if (otherUser) {
            const entry = await config.prisma.user.findFirst({
                where: { id: otherUser.id }
            });
            if (!entry?.musicUsername) {
                await interaction.followUp({
                    content: `${otherUser.username} doesn't have a music account saved`,
                    flags: [MessageFlags.Ephemeral]
                });
                return;
            }
            user = entry.musicUsername;
            useLastFM = !entry.musicUsesListenbrainz;
        } else {
            const entry = await config.prisma.user.findFirst({
                where: { id: interaction.user.id }
            })
            user = interaction.options.getString("user");
            useLastFM = interaction.options.getBoolean("uselastfm");

            if (entry?.musicUsername) {
                user ??= entry.musicUsername;
                useLastFM ??= !entry.musicUsesListenbrainz;
            }
        }

        if (user === null || useLastFM === null) {
            await interaction.followUp({
                content: "you don't have a music account saved. use the `/config nowplaying` command to save them, or specify them as arguments to only use once",
                flags: [MessageFlags.Ephemeral]
            })
            return
        }



        const nowPlaying = await getNowPlaying(user, useLastFM ? config.lastFMApiKey : undefined)

        if (typeof nowPlaying === "undefined") {
            await interaction.followUp("something shat itself!");
            return;
        } else if (!nowPlaying) {
            await interaction.followUp(user + " isn't listening to music");
            return
        }
        let { link, mbid } = nowPlaying

        const albumName = nowPlaying.albumName?.replace(/ - (?:Single|EP)$/, "") === nowPlaying.songName
            ? ""
            : nowPlaying.albumName?.replace(/ - (?:Single|EP)$/, "")
        function sendFallback(nowPlaying: HistoryItem) {
            return interaction.followUp({
                content: `### ${escapeMarkdown(nowPlaying.songName)}
-# by ${escapeMarkdown(nowPlaying.artistName)}${albumName ? ` - from ${escapeMarkdown(albumName)}` : ""}
-# couldn't get more info about this song`
            })
        }

        if (!mbid) {
            await sendFallback(nowPlaying)
            return
        }
        const release = await mbApi.lookup('release', mbid, [
            'recordings', 'artists', 'labels', 'url-rels', 'release-groups'
        ]);
        const musicBrainzInfo = await getMusicBrainzInfo(release, nowPlaying.songName);
        const paramsObj = { entity: "song", term: `${nowPlaying.artistName} ${nowPlaying.songName}` };
        const searchParams = new URLSearchParams(paramsObj);
        if (!link) {
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

        if (musicBrainzInfo) {
            if (link) {
                const songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
                const components = [
                    new ActionRowBuilder<MessageActionRowComponentBuilder>()
                        .addComponents(
                            new ButtonBuilder()
                                .setStyle(ButtonStyle.Secondary)
                                .setLabel("expand")
                                .setCustomId(songlink.pageUrl),
                        ),
                ];
                const emoji = await createResizedEmoji(interaction, musicBrainzInfo.albumartlink);
                await interaction.followUp({
                    content: `### ${escapeMarkdown(musicBrainzInfo.songname)} ${emoji ?? ""}\n-# by ${escapeMarkdown(nowPlaying.artistName)} - from ${escapeMarkdown(musicBrainzInfo.albumname)}`,
                    components
                });
                if (emoji) {
                    await emoji.delete();
                }
                return;
            }
            const emoji = await createResizedEmoji(interaction, musicBrainzInfo.albumartlink);
            await interaction.followUp({
                content: `### ${escapeMarkdown(musicBrainzInfo.songname)} ${emoji ?? ""}\n-# by ${escapeMarkdown(nowPlaying.artistName)} - from ${escapeMarkdown(musicBrainzInfo.albumname)}`,
            });
            if (emoji) {
                await emoji.delete();
            }
            return;
        }
        if (!link) {
            await sendFallback(nowPlaying)
            return
        }
        const songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
        const preferredApi = getSongOnPreferredProvider(songlink, link!)
        if (!preferredApi) {
            await sendFallback(nowPlaying)
            return
        }

        musicCache[songlink.pageUrl] ??= {
            preferredApi,
            songlink
        }

        const emoji = await createResizedEmoji(interaction, preferredApi.thumbnailUrl);
        if (!emoji) {
            await sendFallback(nowPlaying);
            return;
        }
        const components = [
            new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("expand")
                        .setCustomId(songlink.pageUrl),
                ),
        ];
        await interaction.followUp({
            content: `### ${escapeMarkdown(preferredApi.title)} ${emoji}
-# by ${escapeMarkdown(preferredApi.artist)}${albumName ? ` - from ${escapeMarkdown(albumName)}` : ""}`,
            components,
        })
        // we don't have infinite emoji slots
        await emoji.delete()

    },
    button: lobotomizedSongButton,
    dependsOn: z.object({
        lastFMApiKey: z.string()
    }),
    slashCommand
})
