import { declareCommand } from "../command.ts";
import {
    ApplicationIntegrationType, AttachmentBuilder,
    ChatInputCommandInteraction,
    InteractionContextType, MessageFlags,
    SlashCommandBuilder
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import sharp from "sharp";
import { Canvas, loadImage } from "canvas";
import { z } from "zod";

async function urlToDataURI(url: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    return `data:${blob.type};base64,${buffer.toString('base64')}`;
}

async function assembleLastFmGrid(username: string, gridSize: number, period: string, apiKey?: string) {
    const IMAGE_SIZE = 256;
    const periodMap = {
        week: "7day",
        month: "1month",
        quarter: "3month",
        half_yearly: "6month",
        year: "12month",
        all_time: "overall"
    } as Record<string, string>

    if (!apiKey) return
    const res = await (await fetch(`http://ws.audioscrobbler.com/2.0/?method=user.gettopalbums\
&user=${username}&api_key=${apiKey}&period=${periodMap[period]}&format=json`)).json();
    const imgs = (res.topalbums.album
        .map((a: any) => a.image.at(-1)!["#text"]) as string[])
        .filter(i => i)
        .slice(0, gridSize ** 2);

    const canvas = new Canvas(IMAGE_SIZE * gridSize, IMAGE_SIZE * gridSize);
    const ctx = canvas.getContext("2d");

    const imagePromises = imgs.map(url => loadImage(url).catch(() => {
        // TODO: why are you like this
        console.log(url)
        return loadImage("https://files.catbox.moe/4zscph.jpeg")
    }));
    const loadedImages = await Promise.all(imagePromises);
    loadedImages.forEach((img, i) => {
        const x = (i % gridSize) * IMAGE_SIZE;
        const y = Math.floor(i / gridSize) * IMAGE_SIZE;
        ctx.drawImage(img, x, y, IMAGE_SIZE, IMAGE_SIZE);
    });

    return canvas.toBuffer("image/png");
}

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config) {
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

        const GRID_SIZE = 3, DEFAULT_PERIOD = "week";
        const period = interaction.options.getString("period") ?? DEFAULT_PERIOD
        if (useLastFM) {
            const img = await assembleLastFmGrid(user, GRID_SIZE, period, config.lastFMApiKey)
            if (!img) {
                await interaction.followUp({
                    content: "something sharted itself",
                    flags: [MessageFlags.Ephemeral]
                })
                return
            }
            await interaction.followUp({
                content: `here is yo shit`,
                files: [
                    new AttachmentBuilder(img)
                        .setName('hardcoremusiclistening.png')
                        .setDescription(`${user} is listening so music :fire:`),
                ]
            });
            return
        }
        let svgshit = await fetch(`https://api.listenbrainz.org/1/art/grid-stats/${user}/${period}/${GRID_SIZE}/0/512`).then(res => res.text())
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
    dependsOn: z.object({
        lastFMApiKey: z.string()
    }),
    slashCommand: new SlashCommandBuilder()
        .setName("grid")
        .setDescription("get a cover art grid from the stats of a given user.").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addStringOption(option =>
            option.setName("period").setDescription("timespan of the collage")
                .setChoices([{
                    name: "1 week",
                    value: "week"
                }, {
                    name: "1 month",
                    value: "month"
                }, {
                    name: "3 months",
                    value: "quarter"
                }, {
                    name: "6 months",
                    value: "half_yearly"
                }, {
                    name: "1 year",
                    value: "year"
                }, {
                    name: "All time",
                    value: "all_time"
                }])
                .setRequired(false)
        )
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
