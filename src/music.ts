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
import { calculateTextHeight, escapeMarkdown, numberFaggtory, wrapText } from "./util.ts";
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

export const deezerResponseShape = z.object({
    data: z.array(z.object({
        title: z.string(),
        link: z.string(),
        artist: z.object({
            name: z.string()
        }),
        album: z.object({
            title: z.string(),
            cover_big: z.string().optional(),
        })
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

const coverArtPlaceholder = await loadImage("https://keisan.fuckyou.amy.rip/placeholder.png")

const minWaveOffset = 15;
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, colors: { left: string, mid1: string, mid2: string, right: string }, trackName?: string, waveMultiplier: number = 1): CanvasRenderingContext2D {
    const glowConfig = {
        amount: 20,
        color: 'rgba(0, 0, 0, 0.5)',
        offsetX: 10,
        offsetY: 0
    };
    const waveOffsetScale = 75 * waveMultiplier;

    const randomNumber = trackName ? numberFaggtory(trackName) : () => 0
    const randomOffset = () => {
        const sign = randomNumber() > 0.5 ? 1 : -1;
        const mid = (waveOffsetScale + minWaveOffset) / 2;
        const spread = (waveOffsetScale - minWaveOffset) / 2;
        const triangle = (randomNumber() - 0.5) * spread;

        return Math.floor((mid + triangle) * sign);
    };
    const waves = [
        {
            color: colors.mid2,
            baseX: 0.72,
            intensity: 90 * (randomNumber() + 0.5) * waveMultiplier,
            shiftTop: randomOffset(), shiftMid: randomOffset(), shiftBot: randomOffset()
        },
        {
            color: colors.mid1,
            baseX: 0.48,
            intensity: 120 * (randomNumber() + 0.5) * waveMultiplier,
            shiftTop: randomOffset(), shiftMid: randomOffset(), shiftBot: randomOffset()
        },
        {
            color: colors.left,
            baseX: 0.28,
            intensity: 85 * (randomNumber() + 0.5) * waveMultiplier,
            shiftTop: randomOffset(), shiftMid: randomOffset(), shiftBot: randomOffset()
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

function getSaturation(hex: string): number {
    const { r, g, b } = hexToRgb(hex);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === 0) return 0;
    return (max - min) / max;
}

function getLuminance(hex: string): number {
    const { r, g, b } = hexToRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
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

function generateGradient({ base, primary }: { base: string, primary: string }) {
    return {
        left: base,
        mid1: interpolateColor(base, primary, 0.33),
        mid2: interpolateColor(base, primary, 0.66),
        right: primary
    }
}
const baseColors = generateGradient({
    base: '#2B2B2B',
    primary: '#C46A9A'
})

async function extractPalette(buffer: Buffer): Promise<{ primary: string, base: string }> {
    try {
        const { data, info } = await sharp(buffer)
            .resize(32, 32, { fit: 'cover' })
            .raw()
            .toBuffer({ resolveWithObject: true });

        let r = 0, g = 0, b = 0, count = 0;
        let lr = 0, lg = 0, lb = 0, lCount = 0;
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

            // Accumulate light pixels for fallback Primary Color (for B&W images)
            if (l > 100) {
                lr += pr;
                lg += pg;
                lb += pb;
                lCount++;
            }

            // Accumulate muted pixels for Base Color (low saturation)
            if (s < 0.15) {
                mutedLuminanceSum += l;
                mutedCount++;
            }
        }

        // Determine Primary Color
        let primary = baseColors.right;
        if (count >= 5) {
            primary = rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count));
        } else if (lCount > 0) {
            primary = rgbToHex(Math.round(lr / lCount), Math.round(lg / lCount), Math.round(lb / lCount));
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
    const width = 1200, height = 480, padding = 60, imgSize = height - padding * 2;

    let colors = { ...baseColors };
    let textColor = interpolateColor(colors.right, "#FFFFFF", 0.85);
    let imageBuffer: Buffer | undefined;

    if (imageLink) {
        try {
            const response = await fetch(imageLink);
            const arrayBuffer = await response.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
            const { primary, base } = await extractPalette(imageBuffer);

            colors = generateGradient({ base, primary });
            textColor = interpolateColor(primary, "#FFFFFF", 0.85);
        } catch { }
    }

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    const minSaturation = 0.3, maxSaturation = 0.8; // dont change, needed to keep an equal range 0.75-1.25
    const saturation = getSaturation(colors.right)
    const clampedSaturation = Math.min(maxSaturation, Math.max(minSaturation, saturation))
    const waveMultiplier = 0.75 + (clampedSaturation - minSaturation)

    drawBackground(ctx, width, height, colors, historyItem.songName, waveMultiplier)

    ctx.fillStyle = textColor

    const image = imageBuffer ? await loadImage(imageBuffer) : coverArtPlaceholder
    ctx.save()
    ctx.beginPath()
    const radius = 8
    ctx.moveTo(padding + radius, padding)
    ctx.arcTo(padding + imgSize, padding, padding + imgSize, padding + imgSize, radius)
    ctx.arcTo(padding + imgSize, padding + imgSize, padding, padding + imgSize, radius)
    ctx.arcTo(padding, padding + imgSize, padding, padding, radius)
    ctx.arcTo(padding, padding, padding + imgSize, padding, radius)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(image, padding, padding, imgSize, imgSize)
    ctx.restore()

    ctx.font = "bold 40px sans-serif";
    const textMaxWidth = width - padding - imgSize - padding, textX = padding + imgSize + (padding / 2);
    let heightCursor = padding + calculateTextHeight(historyItem.songName, ctx) + 10;
    const songName = wrapText(historyItem.songName, textMaxWidth, ctx, 3);
    for (const line of songName) {
        ctx.fillText(line, textX, heightCursor);
        heightCursor += 45;
    }

    ctx.font = "30px sans-serif";
    const artist = wrapText("by " + historyItem.artistName, textMaxWidth, ctx, 2);
    for (const line of artist) {
        ctx.fillText(line, textX, heightCursor);
        heightCursor += 35;
    }

    ctx.fillStyle = colors.right;
    heightCursor -= 15;
    ctx.fillRect(textX, heightCursor, 100, 4);

    if (historyItem.albumName) {
        const darkTextColor = interpolateColor(colors.left, "#000000", 0.85)
        const albumTextColor = getLuminance(colors.right) > 0.65 ? darkTextColor : textColor;
        ctx.fillStyle = albumTextColor;
        ctx.font = "italic 24px sans-serif";
        ctx.globalAlpha = 0.8;

        const albumText = "from " + historyItem.albumName;
        const albumWidth = ctx.measureText(albumText).width;
        const albumX = width - padding - albumWidth;
        const albumY = height - padding;

        if (albumX > textX) {
            ctx.fillText(albumText, albumX, albumY);
        } else {
            // If it's too long, left align it near the image bottom
            const truncatedAlbum = wrapText(albumText, textMaxWidth - padding, ctx);
            ctx.fillText(truncatedAlbum, textX, albumY);
        }
        ctx.globalAlpha = 1.0;
    }

    return canvas.toBuffer()
}
