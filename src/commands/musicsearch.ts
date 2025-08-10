import { Command } from "../command.ts";
import { escapeMarkdown } from '../util.ts';
import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction,
    InteractionContextType,
    MessageFlags,
    SlashCommandBuilder,
    type MessageActionRowComponentBuilder
} from "discord.js";
import { type Config } from "../config.ts";
import { getSongOnPreferredProvider, itunesResponseShape, lobotomizedSongButton, musicCache, songView } from "../music.ts";
import { hash } from "crypto";

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply()
        const search = interaction.options.getString("search")!.trim()
        const lobotomized = interaction.options.getBoolean("lobotomized") ?? true
        let link = "", albumName = ""

        if (search.match(/^https?:\/\//)) {
            link = search
        } else {
            const paramsObj = { entity: "song", term: search };
            const searchParams = new URLSearchParams(paramsObj);
            const itunesResponse = await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`);
            const itunesJson = await itunesResponse.json();
            const iTunesInfo = itunesResponseShape.safeParse(itunesJson).data?.results;
            if (!iTunesInfo) {
                await interaction.followUp("couldn't find that")
                return
            }

            const track = (iTunesInfo.find((res: any) => res.trackName === search)
                || iTunesInfo.find((res: any) => res.trackName.toLowerCase() === search.toLowerCase())
                || iTunesInfo[0])
            link = track.trackViewUrl
            albumName = track.collectionName
        }

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
            const emoji = await interaction.client.application.emojis.create({
                attachment: preferredApi.thumbnailUrl,
                name: hash("md5", preferredApi.thumbnailUrl),
            });

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
                content: `### ${escapeMarkdown(preferredApi.title)} ${emoji}
-# by ${escapeMarkdown(preferredApi.artist)}${albumName ? ` - from ${escapeMarkdown(albumName)}` : ""}`,
                components,
            })

            await emoji.delete()
            return
        }

        const components = songView(songlink, preferredApi, albumName)
        await interaction.followUp({
            components,
            flags: [MessageFlags.IsComponentsV2],
        })
    }

    button = lobotomizedSongButton
    dependsOn = []
    slashCommand = new SlashCommandBuilder()
        .setName("musicinfo")
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
