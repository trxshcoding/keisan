import {
    ContainerBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    TextDisplayBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ButtonInteraction,
    MessageFlags,
    type SlashCommandBuilder, ModalBuilder
} from "discord.js";
import { z } from "zod";
import type { Config } from "./config";

export interface Song {
    title: string;
    artist: string;
    apiProvider: string;
    thumbnailUrl: string;
    link: string;
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

export function nowPlayingView(songlink: z.infer<typeof songLinkShape>, preferredApi: Song) {
    const components = [
        new ContainerBuilder()
            .addSectionComponents(
                new SectionBuilder()
                    .setThumbnailAccessory(
                        new ThumbnailBuilder()
                            .setURL(preferredApi.thumbnailUrl)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# ${preferredApi.artist} - ${preferredApi.title}`),
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

export async function lobotomizedSongButton(interaction: ButtonInteraction, config: Config): Promise<void> {
    const link = interaction.customId
    const songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
    const preferredApi = getSongOnPreferredProvider(songlink, link)
    if (preferredApi) {
        const components = nowPlayingView(songlink, preferredApi)
        await interaction.reply({
            components,
            flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
        })
    } else {
        /*
        this actually should never reach, since lobotomized
        will only reach if prefferedapi is true at L43,
        so something just went really wrong
        */
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

export function trimWhitespace(input: string): string;
export function trimWhitespace(input: string[]): string[];

export function trimWhitespace(input: string | string[]) {
    return Array.isArray(input) ? input.map(s => s.trim()) : input.trim();
}
