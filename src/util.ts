import { type ChatInputCommandInteraction, type Client, ModalBuilder, SlashCommandBuilder } from "discord.js";
import type { Results } from "linguist-js/dist/types";
import { number } from "zod";
import { Canvas } from "canvas";
import { MusicBrainzApi } from "musicbrainz-api";
import { hash } from "crypto";
import sharp from "sharp";

export function chunkArray<T>(
    array: T[],
    chunkSize: number
): T[][] {
    const b: T[][] = []
    array.forEach(element =>
        b && b[b.length - 1] && b[b.length - 1].length < chunkSize
            ? b[b.length - 1].push(element)
            : b.push([element])
    )
    return b
}


export function trimWhitespace(input: string): string;
export function trimWhitespace(input: string[]): string[];

export function trimWhitespace(input: string | string[]) {
    return Array.isArray(input) ? input.map(s => s.trim()) : input.trim();
}

export class AmyodalBuilder extends ModalBuilder {
    private command: SlashCommandBuilder

    constructor(command: SlashCommandBuilder) {
        super()
        this.command = command
    }

    setCustomId(customId: string): this {
        this.data.custom_id = `${this.command.name}|${customId}`
        return this
    }
}

export class ContextyalBuilder extends ModalBuilder {
    private command: string

    constructor(command: string) {
        super()
        this.command = command
    }

    setCustomId(customId: string): this {
        this.data.custom_id = `CC:${this.command}|${customId}`
        return this
    }
}

export function getTop3Languages(result: Results) {
    let maxBytes = 0;
    Object.keys(result.languages.results).forEach(language => {
        maxBytes += result.languages.results[language].bytes
    })
    const newArray = Object.entries(result.languages.results).map(([k, v]) => ({
        ...v,
        language: k,
        percentage: Number((v.bytes / maxBytes * 100).toFixed(2)),
    })).filter(lang => lang.type === "programming")
    newArray.sort((a, b) => b.bytes - a.bytes)
    newArray.length = 3;
    return newArray
}

export function escapeMarkdown(content: string) {
    return content.replace(/([#*_~`|])/g, "\\$1")
}

export const mbApi = new MusicBrainzApi({
    appName: 'YourAppName',
    appVersion: '1.0.0',
});

export function imageBullshittery(username: string) {
    const p = 2;
    const canvas = new Canvas(p * 7, p * 7);
    const context = canvas.getContext("2d");


    const xorshift32 = (n: number) => {
        n ^= n << 13;
        n ^= n >>> 17;
        n ^= n << 5;
        return n;
    };

    const seedSteps = 28;

    let seed = 1;
    for (let i = seedSteps + username.length - 1; i >= seedSteps; i--) {
        seed = xorshift32(seed);
        seed += username.charCodeAt(i - seedSteps);
    }

    context.fillStyle =
        "#" + ((seed >> 8) & 0xffffff).toString(16).padStart(0, "6");

    for (let i = seedSteps - 1; i > 0; i--) {
        // continue the seed
        seed = xorshift32(seed);

        const X = i & 3;
        const Y = i >> 2;

        if (seed >>> (seedSteps + 1) > (X * X) / 3 + Y / 2) {
            context.fillRect(p * 3 + p * X, p * Y, p, p);
            context.fillRect(p * 3 - p * X, p * Y, p, p);
        }
    }
    return canvas.toBuffer("image/png");
}
function getRandomArrayMember(arr: any[]) {
    if (arr.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * arr.length);

    return arr[randomIndex];
}
function createRandomBullshit(length: number) {
    let bullshit = ""
    const bullshitChars = 'qwertyuiopasdfghjklzxcvbnm1234567890'.split("")
    for (let i = 0; i <= length; i++) {
        let temp = getRandomArrayMember(bullshitChars)
        if (Math.random() > 0.5) {
            bullshit += temp.toUpperCase()
        } else {
            bullshit += temp
        }
    }
    return bullshit
}

export async function getGithubAvatar(name: string, email: string) {
    let username = ""
    const isGithubEmail = email.match(/^(?:\d+\+)(.+?)@users\.noreply\.github\.com$/)
    if (isGithubEmail) username = isGithubEmail[1]
    else {
        const res = await (await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(name)}`)).json()
        if (res?.items?.[0]) username = res.items[0].login
        // note: there is a "score" property on the user which im assuming is related to how good of a match it is
        // but i've also never seen it not be 1
    }
    if (username)
        return Buffer.from(await (await fetch(`https://github.com/${username}.png`)).arrayBuffer())
    else return imageBullshittery(name)
}

export async function bufferToEmoji(buffer: Buffer, client: Client) {
    return client.application!.emojis.create({
        name: createRandomBullshit(12),
        attachment: buffer,
    })
}

export async function createResizedEmoji(interaction: ChatInputCommandInteraction, imageUrl: string) {
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