import {Command} from "../command.ts";
import {chunkArray} from '../util.ts';
import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction, EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { type Config } from "../config.ts";
import {getSongOnPreferredProvider, kyzaify} from "../helper.ts";
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
        const paramsObj = {entity: "song", term: search};
        const searchParams = new URLSearchParams(paramsObj);
        const itunesResponse = await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`);
        const itunesJson = await itunesResponse.json();
        const itunesinfo = itunesResponseShape.parse(itunesJson);
        const itunesSong = itunesinfo.results[0];
        const link = itunesSong.trackViewUrl
        const songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
        const preferredApi = getSongOnPreferredProvider(songlink, link)!

        const embed = new EmbedBuilder()
            .setAuthor({
                name: preferredApi.artist,
            })
            .setTitle(preferredApi.title)
            .setThumbnail(preferredApi.thumbnailUrl)
            .setFooter({
                text: "amy jr",
            });
        const platforms = Object.keys(songlink.linksByPlatform)
        const buttons = platforms.map(platform =>
            new ButtonBuilder()
                .setURL(songlink.linksByPlatform[platform].url)
                .setLabel(kyzaify(platform))
                .setStyle(ButtonStyle.Link));
        const chunkedButtons = chunkArray(buttons, 5);
        const rows = chunkedButtons.map(rowButtons =>
            new ActionRowBuilder<ButtonBuilder>().addComponents(...rowButtons));

        await interaction.followUp({
            components: rows,
            embeds: [embed]
        });
    }

    slashCommand = new SlashCommandBuilder()
        .setName("musicsearch")
        .setDescription("search yo music").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option =>{
            return option.setName("search").setDescription("shit you wanna search").setRequired(true);
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
