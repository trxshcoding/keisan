import { createResizedEmoji, escapeMarkdown } from '../util.ts';
import {
    ActionRowBuilder,
    ApplicationIntegrationType, AttachmentBuilder, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder,
    type MessageActionRowComponentBuilder
} from "discord.js";
import { generateNowplayingImage, getSongOnPreferredProvider, itunesResponseShape, lobotomizedSongButton, musicCache } from "../music.ts";
import { NO_EXTRA_CONFIG } from "../config.ts";
import { declareCommand } from "../command.ts";

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config) {
        await interaction.deferReply()
        const search = interaction.options.getString("search", true).trim()
        const shouldImageGen = interaction.options.getBoolean("imagegen") ?? false
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
            if (!track) {
                await interaction.followUp("couldn't find that")
                return
            }
            link = track.trackViewUrl
            albumName = track.collectionName.replace(/ - (?:Single|EP)$/, "") === track.trackName
                ? ""
                : track.collectionName.replace(/ - (?:Single|EP)$/, "")
        }

        let preferredApi, songlink
        songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
        preferredApi = getSongOnPreferredProvider(songlink, link)!

        musicCache[songlink.pageUrl] ??= {
            preferredApi,
            songlink
        }

        const emoji = await createResizedEmoji(interaction, preferredApi.thumbnailUrl)

        const components = [
            new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Secondary)
                        .setLabel("expand")
                        .setCustomId(songlink.pageUrl),
                ),
        ];

        if (shouldImageGen) {
            const image = await generateNowplayingImage({
                songName: preferredApi.title,
                artistName: preferredApi.artist,
                albumName
            }, preferredApi.thumbnailUrl)

            await interaction.followUp({
                files: [
                    new AttachmentBuilder(image)
                        .setName('nowplaying.png'),
                ],
                components
            });
            return
        }

        await interaction.followUp({
            content: `### ${escapeMarkdown(preferredApi.title)} ${emoji}
-# by ${escapeMarkdown(preferredApi.artist)}${albumName ? ` - from ${escapeMarkdown(albumName)}` : ""}`,
            components,
        })

        await emoji?.delete()
        return
    },
    button: lobotomizedSongButton,
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("musicinfo")
        .setDescription("search yo music")
        .setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addStringOption(option => {
            return option.setName("search").setDescription("smth you wanna search").setRequired(true);
        })
        .addBooleanOption(option => {
            return option.setName("imagegen").setDescription("show result as an image");
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ])
})
