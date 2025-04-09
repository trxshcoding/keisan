import {Command} from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction, EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { Config } from "../config.ts";
import {getSongOnPreferredProvider, kyzaify} from "../helper.ts";

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply()
        const search = interaction.options.getString("search")!
        const paramsObj = {entity: "song", term: search};
        const searchParams = new URLSearchParams(paramsObj);
        const itunesinfo = (await (await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`)).json()).results[0];
        const link = itunesinfo.trackViewUrl
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
        const meow = Object.keys(songlink.linksByPlatform)
        let message = ""

        const nya: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();

        for (const meowi of meow) {
            if (currentRow.components.length >= 5) {
                nya.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
            }
            currentRow.addComponents(
                new ButtonBuilder()
                    .setURL(songlink.linksByPlatform[meowi].url)
                    .setLabel(kyzaify(meowi))
                    .setStyle(ButtonStyle.Link)
            );
        }
        if (currentRow.components.length > 0) {
            nya.push(currentRow);
        }

        await interaction.followUp({
            components: nya,
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
