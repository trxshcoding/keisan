import { Command } from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType,
    ButtonBuilder,
    ButtonStyle,
    ChatInputCommandInteraction,
    EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";

import { getSongOnPreferredProvider } from "../helper.ts"

function keepV(url) {
    const urlObj = new URL(url);
    const vParam = urlObj.searchParams.get("v");

    urlObj.search = "";

    if (vParam) {
        urlObj.searchParams.set("v", vParam);
    }

    return urlObj.toString();
}

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config) {
        await interaction.deferReply()


        const meow = await fetch(`https://api.listenbrainz.org/1/user/${config.listenbrainzAccount}/playing-now`).then((res) => res.json());
        if (!meow) {
            await interaction.followUp("something shat itself!");
            return;
        }
        if (meow.payload.count === 0) {
            await interaction.followUp("user isnt listening to music");
        } else {
            const track_metadata = meow.payload.listens[0].track_metadata
            const link = keepV(track_metadata.additional_info.origin_url)

            const preferredApi = getSongOnPreferredProvider(await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json()), link)
            if (!preferredApi) {
                await interaction.followUp("song not found")
                return
            }
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: preferredApi.artist,
                })
                .setTitle(preferredApi.title)
                .setThumbnail(preferredApi.thumbnailUrl)
                .setFooter({
                    text: "amy jr",
                });
            const nya = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setURL(preferredApi.link).setLabel("link").setStyle(ButtonStyle.Link))
            await interaction.followUp({
                components: [
                    nya
                ],
                embeds: [embed]
            });
        }

    }

    slashCommand = new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("balls").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}