import {declareCommand} from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder
} from "discord.js";
import {type Config, NO_EXTRA_CONFIG} from "../config.ts";
import {lFmArtistResponseShape, mBSearchResponseShape} from "../music.ts";
import {z} from "zod";


async function getNowPlayingArtist(username: string, lastFMApiKey: string, shoulduseLastfm: boolean) {
    if (!shoulduseLastfm) {
        const res = await fetch(`https://api.listenbrainz.org/1/user/${username}/playing-now`).then((res) => res.json());
        if (!res?.payload) return
        else if (res.payload.count === 0) return false
        const bwah = await searchMusicBrainzArtist(res.payload.listens[0].track_metadata.artist_name)
        if (!bwah) return
        const thing = await getLastfmArtist(bwah.id, lastFMApiKey)
        if (thing === false) {
            return bwah
        }
        return thing
    } else {
        return
    }
}

async function searchMusicBrainzArtist(artistName: string) {
    const resp = await fetch(`https://musicbrainz.org/ws/2/artist/?query=artist:${artistName}&fmt=json`, {
        headers: {
            'User-Agent': 'keisan/1.0.0 ( amy@amy.rip )'
        }
    }).then(a => a.json())

    const maybeArtist = mBSearchResponseShape.safeParse(resp)
    if (!maybeArtist.success) {
        return
    }
    return maybeArtist.data.artists[0]
}

async function getLastfmArtist(artistMbid: string, lastfmKey: string) {
    const resp = await fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.getInfo&mbid=${artistMbid}&api_key=${lastfmKey}&format=json&limit=1`).then(a => a.json())
    console.log(resp);
    const maybeArtist = lFmArtistResponseShape.safeParse(resp)
    console.log(maybeArtist.data)
    if (!maybeArtist.success) {
        return false
    }
    return maybeArtist.data
}

export default declareCommand({
    run: async function (interaction: ChatInputCommandInteraction, config) {
        await interaction.deferReply()
        const otherUser = interaction.options.getUser("discord_user")
        let user: string | null;
        let useLastFM: boolean | null;

        if (otherUser) {
            const entry = await config.prisma.user.findFirst({
                where: {id: otherUser.id}
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
                where: {id: interaction.user.id}
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

        const nowPlayingArtist = await getNowPlayingArtist(user, config.lastFMApiKey, useLastFM)

        if (!nowPlayingArtist) {
            await interaction.followUp({
                content: "something somehow broke :P",
                flags: [MessageFlags.Ephemeral]
            })
            return
        }

    },
    dependsOn: z.object({
        lastFMApiKey: z.string()
    }),
    slashCommand: new SlashCommandBuilder()
        .setName("nowplayingartist")
        .addStringOption(option => {
            return option.setName("user").setDescription("username").setRequired(false)
        })
        .addBooleanOption(option => {
            return option.setName("uselastfm").setDescription("use last.fm or listenbrainz").setRequired(false)
        })
        .addUserOption(option => {
            return option.setName("discord_user").setDescription("a user with their music account saved by the bot. has priority over other options").setRequired(false)
        })
        .setDescription("get information about the current playing artist").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
