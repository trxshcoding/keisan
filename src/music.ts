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
import { z } from "zod";
import type { Config } from "./config";
import { escapeMarkdown } from "./util.ts";
import { createCanvas, loadImage, type CanvasRenderingContext2D } from "canvas";
import sharp from "sharp";

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

const coverArtPlaceholder = await loadImage("https://files.catbox.moe/piynyy.jpg")

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, colors: { left: string, mid1: string, mid2: string, right: string }): CanvasRenderingContext2D {
    const glowConfig = {
        amount: 20,
        color: 'rgba(0, 0, 0, 0.5)',
        offsetX: 10,
        offsetY: 0
    };
    const waves = [
        {
            color: colors.mid2,
            baseX: 0.72,
            intensity: 120,
            shiftTop: -20, shiftMid: 50, shiftBot: -10
        },
        {
            color: colors.mid1,
            baseX: 0.48,
            intensity: 160,
            shiftTop: 30, shiftMid: -40, shiftBot: 80
        },
        {
            color: colors.left,
            baseX: 0.28,
            intensity: 110,
            shiftTop: -10, shiftMid: 20, shiftBot: 20
        }
    ];

    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.right;
    ctx.fillRect(0, 0, w, h);

    waves.forEach(wave => {
        ctx.beginPath();

        ctx.moveTo(0, 0);

        const topX = (w * wave.baseX) + wave.shiftTop;
        const startX = topX; const startY = 0;
        const midX = (w * wave.baseX) + wave.shiftMid; const midY = h * 0.5;
        const endX = (w * wave.baseX) + wave.shiftBot; const endY = h;

        ctx.lineTo(topX, 0);
        ctx.bezierCurveTo(
            startX + wave.intensity, startY + (h * 0.2),
            midX - wave.intensity, midY - (h * 0.2),
            midX, midY
        );
        ctx.bezierCurveTo(
            midX + wave.intensity, midY + (h * 0.2),
            endX - wave.intensity, endY - (h * 0.2),
            endX, endY
        );
        ctx.lineTo(0, h);
        ctx.closePath();

        ctx.shadowBlur = glowConfig.amount;
        ctx.shadowColor = glowConfig.color;
        ctx.shadowOffsetX = glowConfig.offsetX;
        ctx.shadowOffsetY = glowConfig.offsetY;

        ctx.fillStyle = wave.color;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    });

    return ctx
}

function hexToRgb(hex: string): { r: number, g: number, b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function interpolateColor(color1: string, color2: string, factor: number): string {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const r = Math.round(c1.r + factor * (c2.r - c1.r));
    const g = Math.round(c1.g + factor * (c2.g - c1.g));
    const b = Math.round(c1.b + factor * (c2.b - c1.b));
    return rgbToHex(r, g, b);
}

const baseColors = {
    left: '#2B2B30', // dark charcoal gray
    mid1: '#4B2E6D', // deep muted purple
    mid2: '#8A4A7C', // dusty purple-pink
    right: '#C46A9A'  // soft pink (not too light)
}

async function extractPalette(buffer: Buffer): Promise<{ primary: string, base: string }> {
    try {
        const { data, info } = await sharp(buffer)
            .resize(32, 32, { fit: 'cover' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        let r = 0, g = 0, b = 0, count = 0;
        let mutedLuminanceSum = 0, mutedCount = 0;
        const pixelCount = info.width * info.height;
        const channels = info.channels;

        for (let i = 0; i < pixelCount; i++) {
            const offset = i * channels;
            const pr = data[offset];
            const pg = data[offset + 1];
            const pb = data[offset + 2];

            // Simple saturation/luminance calculation
            const max = Math.max(pr, pg, pb);
            const min = Math.min(pr, pg, pb);
            const l = (max + min) / 2;
            const s = (max === min) ? 0 : (l > 127) ? (max - min) / (255 - (max - min)) : (max - min) / (max + min);

            // Accumulate vibrant pixels for Primary Color
            if (s > 0.3 && l > 40 && l < 215) {
                r += pr;
                g += pg;
                b += pb;
                count++;
            }

            // Accumulate muted pixels for Base Color (low saturation)
            if (s < 0.15) {
                mutedLuminanceSum += l;
                mutedCount++;
            }
        }

        // Determine Primary Color
        let primary = baseColors.right;
        if (count > 0) {
            primary = rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count));
        }

        // Determine Base Gray based on muted brightness
        let base = baseColors.left;
        if (mutedCount > 0) {
            const avgLuminance = mutedLuminanceSum / mutedCount;
            // Map 0-255 luminance to approx 15-80 range for background
            // Formula: (avgLuminance / 255) * (max - min) + min
            const targetLuminance = Math.round((avgLuminance / 255) * (80 - 15) + 15);
            base = rgbToHex(targetLuminance, targetLuminance, targetLuminance);
        }

        return { primary, base };
    } catch (e) {
        return { primary: baseColors.right, base: baseColors.left };
    }
}

export async function generateNowplayingImage(historyItem: HistoryItem, imageLink: string | undefined): Promise<Buffer<ArrayBufferLike>> {
    const width = 1200, height = 480, padding = 60, imgSize = height - padding * 2, textPad = padding / 2;

    let colors = { ...baseColors };
    let textColor = interpolateColor(colors.right, "#FFFFFF", 0.85);
    let imageBuffer: Buffer | undefined;

    if (imageLink) {
        try {
            const response = await fetch(imageLink);
            const arrayBuffer = await response.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
            const { primary, base } = await extractPalette(imageBuffer);

            colors = {
                left: base,
                mid1: interpolateColor(base, primary, 0.33),
                mid2: interpolateColor(base, primary, 0.66),
                right: primary
            };
            textColor = interpolateColor(primary, "#FFFFFF", 0.85);
        } catch { }
    }

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')
    drawBackground(ctx, width, height, colors)

    ctx.fillStyle = textColor

    const image = imageBuffer ? await loadImage(imageBuffer) : coverArtPlaceholder
    ctx.drawImage(image, padding, padding, imgSize, imgSize)

    ctx.font = "bold 40px sans-serif";
    const titleY = padding + calculateTextHeight(historyItem.songName, ctx) + 10;
    const songName = truncateText(historyItem.songName, width - padding - imgSize - textPad, ctx);
    ctx.fillText(songName, padding + imgSize + textPad, titleY);

    ctx.font = "30px sans-serif";
    const artistY = titleY + 45;
    const artist = truncateText("by " + historyItem.artistName, width - padding - imgSize - textPad, ctx);
    ctx.fillText(artist, padding + imgSize + textPad, artistY);

    ctx.fillStyle = colors.right;
    ctx.fillRect(padding + imgSize + textPad, artistY + 20, 100, 4);

    if (historyItem.albumName) {
        ctx.fillStyle = textColor;
        ctx.font = "italic 24px sans-serif";
        ctx.globalAlpha = 0.8;
        const albumText = "from " + historyItem.albumName;
        const albumWidth = ctx.measureText(albumText).width;
        const albumX = width - padding - albumWidth;
        const albumY = height - padding;

        if (albumX > padding + imgSize + textPad) {
            ctx.fillText(albumText, albumX, albumY);
        } else {
            // If it's too long, left align it near the image bottom
            const truncatedAlbum = truncateText(albumText, width - padding - imgSize - padding - textPad, ctx);
            ctx.fillText(truncatedAlbum, padding + imgSize + textPad, albumY);
        }
        ctx.globalAlpha = 1.0;
    }

    return canvas.toBuffer()
}
