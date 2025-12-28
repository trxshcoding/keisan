import {
    ContainerBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    TextDisplayBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
    MessageFlags, type ChatInputCommandInteraction
} from "discord.js";
import {z} from "zod";
import type {Config} from "./config";
import {escapeMarkdown} from "./util.ts";
import {createCanvas, loadImage, type CanvasRenderingContext2D} from "canvas";

export interface Song {
    title: string;
    artist: string;
    apiProvider: string;
    thumbnailUrl: string;
    link: string;
}

export type HistoryItem = {
    songName: string, artistName: string, albumName?: string, link?: string, mbid?: string
}

const songLinkShape = z.object({
    userCountry: z.string(),
    entitiesByUniqueId: z.record(
        z.string(),
        z.object({
            id: z.string(),
            type: z.string(),
            title: z.string(),
            thumbnailUrl: z.string().optional(),
            apiProvider: z.string(),
            artistName: z.string(),
        })
    ),
    linksByPlatform: z.record(
        z.string(),
        z.object({
            country: z.string(),
            url: z.string().url(),
            entityUniqueId: z.string(),
        }))
});
//i hate this
export const preferredProviders = [
    "spotify",
    "deezer",
    "youtubeMusic",
    "tidal",
    "itunes"
];

export function getSongOnPreferredProvider(json: unknown, link: string): Song | null {
    const maybesong = songLinkShape.safeParse(json);
    if (!maybesong.success) {
        return null;
    }
    const song = maybesong.data;
    for (const platform of preferredProviders) {
        if (!song.linksByPlatform[platform]) {
            console.log(`couldnt find song on ${platform}`)
            continue
        }
        const entityId = song.linksByPlatform[platform].entityUniqueId;
        const songInfo = song.entitiesByUniqueId[entityId]

        return {
            title: songInfo.title,
            artist: songInfo.artistName,
            apiProvider: songInfo.apiProvider,
            thumbnailUrl: songInfo.thumbnailUrl!,
            link: song.linksByPlatform[platform].url,
        }
    }
    return null
}

export const itunesResponseShape = z.object({
    results: z.array(z.object({
        artistId: z.number(),
        artistName: z.string(),
        trackViewUrl: z.string(),
        trackName: z.string(),
        collectionName: z.string(),
        collectionCensoredName: z.string().optional(),
        artworkUrl100: z.string().optional(),
        censoredTrackName: z.string().optional(),
    }))
})

export function songView(songlink: z.infer<typeof songLinkShape>, preferredApi: Song, albumName?: string) {
    const components = [
        new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .setThumbnailAccessory(
                        new ThumbnailBuilder()
                            .setURL(preferredApi.thumbnailUrl)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `# ${escapeMarkdown(preferredApi.artist)} - ${escapeMarkdown(preferredApi.title)}
${albumName ? `from ${albumName}` : ""}`
                        ),
                    ),
            )
    ];
    const links = Object.keys(songlink.linksByPlatform)

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();

    for (const link of links) {
        if (currentRow.components.length >= 4) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder<ButtonBuilder>();
        }
        currentRow.addComponents(
            new ButtonBuilder()
                .setURL(songlink.linksByPlatform[link].url)
                .setLabel(kyzaify(link))
                .setStyle(ButtonStyle.Link)
        );
    }
    if (currentRow.components.length > 0) {
        rows.push(currentRow);
    }
    components[0].addActionRowComponents(rows)
    return components
}

export const musicCache: Record<string, {
    preferredApi: Song,
    songlink: z.infer<typeof songLinkShape>,
}> = {}

export async function lobotomizedSongButton(interaction: ButtonInteraction, config: Config): Promise<void> {
    let link = interaction.customId
    if (!link) {
        interaction.reply({
            content: "something sharted itself",
            flags: [MessageFlags.Ephemeral]
        })
        return
    }

    let songlink, preferredApi
    if (musicCache[link]) {
        preferredApi = musicCache[link].preferredApi
        songlink = musicCache[link].songlink
    } else {
        songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
        preferredApi = getSongOnPreferredProvider(songlink, link)
    }

    if (preferredApi) {
        const components = songView(songlink, preferredApi)
        await interaction.reply({
            components,
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
        })
    } else {
        await interaction.reply({
            content: "how",
            flags: [MessageFlags.Ephemeral]
        })
    }
}


export function kyzaify(input: string): string {
    //im gonna write this as shittily as possible just because.
    if (input === "youtube") {
        return "YouTube";
    } else if (input === "youtubeMusic") {
        return "YouTube Music";
    } else if (input === "itunes") {
        return "iTunes";
    } else if (input === "soundcloud") {
        return "SoundCloud";
    }
    if (input.length === 0) return input;

    let result = input.charAt(0).toUpperCase();

    for (let i = 1; i < input.length; i++) {
        const char = input.charAt(i);

        if (char === char.toUpperCase()) {
            result += ' ' + char;
        } else {
            result += char;
        }
    }

    return result;
}


export function calculateTextHeight(text: string, ctx: CanvasRenderingContext2D): number {
    const size = ctx.measureText(text)
    return size.actualBoundingBoxAscent + size.actualBoundingBoxDescent
}

export const truncateText = (text: string, maxWidth: number, ctx: CanvasRenderingContext2D) => {
    const ellipsisWidth = ctx.measureText("...").width;
    let width = ctx.measureText(text).width;
    if (width <= maxWidth) {
        return text;
    }
    let truncatedText = text;
    let i = text.length;
    while (width >= maxWidth - ellipsisWidth && i > 0) {
        truncatedText = text.substring(0, i);
        width = ctx.measureText(truncatedText).width;
        i--;
    }
    return truncatedText + "...";
};

export async function generateNowplayingImage(interaction: ChatInputCommandInteraction, historyItem: HistoryItem, imageLink: string | null): Promise<Buffer<ArrayBufferLike>> {
    const canvas = createCanvas(737, 286) // pulled these numbers out of my ass
    const ctx = canvas.getContext('2d')
    const IMAGESIZE = 180
    const gradient = ctx.createLinearGradient(0, canvas.height, canvas.width, 0)
    gradient.addColorStop(0, "#F2A0B2")
    gradient.addColorStop(1, "#BF00BF")


    ctx.font = "25px sans-serif"
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)


    if (imageLink) {
        const image = await loadImage(imageLink)
        ctx.drawImage(image, 40, 40, IMAGESIZE, IMAGESIZE)
    }
    const songName = truncateText(historyItem.songName, canvas.width - 40 - IMAGESIZE - 40 - 20, ctx);
    const artist = truncateText("by " + historyItem.artistName, canvas.width - 40 - IMAGESIZE - 40 - 20, ctx);
    ctx.fillStyle = "black"

    ctx.fillText(songName, 40 + IMAGESIZE + 20, 40 + calculateTextHeight(songName, ctx))
    ctx.fillText(artist, 40 + IMAGESIZE + 20, 60 + calculateTextHeight(artist, ctx))
    return canvas.toBuffer()
}
