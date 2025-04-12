import {Command} from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction, EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { type Config } from "../config.ts";
import {getSongOnPreferredProvider, kyzaify} from "../helper.ts";

export default class MusicInfoCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply()
        const link = interaction.options.getString("link")!
        const info = await fetch("https://api.song.link/v1-alpha.1/links?url=" + link).then((res) => res.json());

        //const meow = [...new Set(Object.values(info.linksByPlatform).map((i:any) => i.entityUniqueId))]
        const meow = Object.keys(info.linksByPlatform)

        const nya: ActionRowBuilder<ButtonBuilder>[] = [];
        let currentRow = new ActionRowBuilder<ButtonBuilder>();

        for (const meowi of meow) {
            if (currentRow.components.length >= 5) {
                nya.push(currentRow);
                currentRow = new ActionRowBuilder<ButtonBuilder>();
            }
            currentRow.addComponents(
                new ButtonBuilder()
                    .setURL(info.linksByPlatform[meowi].url)
                    .setLabel(kyzaify(meowi))
                    .setStyle(ButtonStyle.Link)
            );
        }
        if (currentRow.components.length > 0) {
            nya.push(currentRow);
        }

        const infoPreferred = getSongOnPreferredProvider(info, link)!
        const mrrrr = new EmbedBuilder()
            .setAuthor({
                name: infoPreferred.artist,
            })
            .setTitle(infoPreferred.title)
            .setThumbnail(infoPreferred.thumbnailUrl)
            .setFooter({
                text: "amy jr",
            });
        await interaction.followUp({
            embeds: [mrrrr],
            components: nya
        });

    }

    slashCommand = new SlashCommandBuilder()
        .setName("musicinfo")
        .addStringOption(option =>{
            return option.setName("link").setDescription("link").setRequired(true);
        })
        .setDescription("meow")
        .setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
