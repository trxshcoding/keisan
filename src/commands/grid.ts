import { declareCommand } from "../command.ts";
import {
    ApplicationIntegrationType, AttachmentBuilder,
    ChatInputCommandInteraction,
    InteractionContextType, MessageFlags,
    SlashCommandBuilder
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import sharp from "sharp";

async function urlToDataURI(url: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    return `data:${blob.type};base64,${buffer.toString('base64')}`;
}

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config: Config) {
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
        if (useLastFM) {
            await interaction.followUp("https://tenor.com/view/last-fm-spotify-wrapped-music-dog-rejection-weirded-out-gif-2852139180125226669\n(this command doesnt support lastfm yet)")
            return
        }
        let svgshit = await fetch(`https://api.listenbrainz.org/1/art/grid-stats/${user}/this_week/3/0/512`).then(res => res.text())
        const imageUrls = [...new Set([...svgshit.matchAll(/<image[^>]*?(?:xlink:)?href="([^"]*)"/g)].map(match => match[1]))];

        const urlToDataUriMap = new Map<string, string>();
        await Promise.all(
            imageUrls.map(async (url) => {
                if (url && !url.startsWith('data:')) {
                    try {
                        const dataUri = await urlToDataURI(`${url}`);
                        urlToDataUriMap.set(url, dataUri);
                    } catch (e) {
                        console.error(`Failed to process image ${url}:`, e);
                    }
                }
            })
        );

        svgshit = svgshit.replace(/(<image[^>]*?(?:xlink:)?href=")([^"]*)(")/g, (match, p1, url, p3) => {
            const dataUri = urlToDataUriMap.get(url);
            if (dataUri) {
                return p1 + dataUri + p3;
            }
            return match; // Keep original if data URI wasn't created
        });



        await interaction.followUp({
            content: `here is yo shit`,
            files: [
                new AttachmentBuilder(sharp(Buffer.from(svgshit)).png())
                    .setName('hardcoremusiclistening.png')
                    .setDescription(`${user} is listening so music :fire:`),
            ]
        });

    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("grid")
        .setDescription("get a cover art grid from the stats of a given user.").setIntegrationTypes([
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
        ]),
})
