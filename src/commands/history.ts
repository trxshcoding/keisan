import { declareCommand } from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import {z} from "zod";


async function getHistory(username: string, limit: number, lastFMApiKey?: string): Promise<{
    songName: string, artistName: string, albumName?: string, link?: string
}[] | false | undefined> {
    if (!lastFMApiKey) {
        const res = await fetch(`https://api.listenbrainz.org/1/user/${username}/listens`).then((res) => res.json());
        if (!res?.payload) return
        else if (res.payload.count === 0) return false
        else {
            return res.payload.listens.slice(0, limit)
        }
    } else {
        const res = await fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${lastFMApiKey}&limit=1&format=json`)
            .then((res) => res.json());
        if (!res?.recenttracks) return
        else if (!res.recenttracks?.track?.[0]) return false
        else {
            const track = res.recenttracks.track[0]

            return [{
                songName: track.name,
                artistName: track.artist["#text"],
                albumName: track.album["#text"]
            }]
        }
    }
}

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config) {
        const user = interaction.options.getString("user", true); //TODO: get shit from the dfatabase
        const uselastfm = interaction.options.getBoolean("uselastfm", true); //TODO: get shit from the dfatabase
        console.log(await getHistory(user, 5,  uselastfm ? config.lastFMApiKey : undefined))
    },
    dependsOn: z.object({
        musicAccount: z.string(),
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
