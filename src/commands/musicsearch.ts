import { Command } from "../command.ts";
import { chunkArray } from '../util.ts';
import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction, EmbedBuilder,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder,
    type MessageActionRowComponentBuilder
} from "discord.js";
import { type Config } from "../config.ts";
import { getSongOnPreferredProvider, kyzaify, lobotomizedSongButton, musicCache, nowPlayingView } from "../music.ts";
import * as z from 'zod';

const itunesResponseShape = z.object({
    results: z.array(z.object({
        artistId: z.number(),
        artistName: z.string(),
        trackViewUrl: z.string(),
        trackName: z.string(),
        collectionName: z.string(),
        collectionCensoredName: z.string().optional(),
        censoredTrackName: z.string().optional(),
    }))
})

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply()
        const search = interaction.options.getString("search")!
        const lobotomized = interaction.options.getBoolean("lobotomized") ?? true
        const paramsObj = { entity: "song", term: search };
        const searchParams = new URLSearchParams(paramsObj);

        const itunesResponse = await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`);
        const itunesJson = await itunesResponse.json();
        const itunesinfo = itunesResponseShape.parse(itunesJson);
        const itunesSong = itunesinfo.results[0];

        const link = itunesSong.trackViewUrl
        let preferredApi, songlink, isCached = false
        if (musicCache[link]) {
            preferredApi = musicCache[link].preferredApi
            songlink = musicCache[link].songlink
            isCached = true
        } else {
            songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
            preferredApi = getSongOnPreferredProvider(songlink, link)!
        }

        if (lobotomized) {
            const components = [
                new ActionRowBuilder<MessageActionRowComponentBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel("expand")
                            .setCustomId(link),
                    ),
            ];
            await interaction.followUp({
                content: `### ${preferredApi.title}\n-# by ${preferredApi.artist}`,
                components,
            })
            return
        }

        const components = nowPlayingView(songlink, preferredApi)
        await interaction.followUp({
            components,
            flags: [MessageFlags.IsComponentsV2],
        })
    }

    button = lobotomizedSongButton
    dependsOn = []
    slashCommand = new SlashCommandBuilder()
        .setName("musicsearch")
        .setDescription("search yo music")
        .setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addStringOption(option => {
            return option.setName("search").setDescription("shit you wanna search").setRequired(true);
        })
        .addBooleanOption(option => {
            return option.setName("lobotomized").setDescription("smol").setRequired(false);
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
