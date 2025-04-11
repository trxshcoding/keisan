import {Command} from "../command.ts";
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

import {getSongOnPreferredProvider, kyzaify} from "../helper.ts"
import {Config} from "../config.ts";

function keepV(url: string): string {
    const urlObj = new URL(url);
    const vParam = urlObj.searchParams.get("v");

    urlObj.search = "";

    if (vParam) {
        urlObj.searchParams.set("v", vParam);
    }

    return urlObj.toString();
}

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply()
        const user = interaction.options.getString("user") ?? config.listenbrainzAccount;
        const usesonglink = interaction.options.getBoolean("usesonglink") ?? true
        const useitunes = interaction.options.getBoolean("useitunes") ?? true

        const meow = await fetch(`https://api.listenbrainz.org/1/user/${user}/playing-now`).then((res) => res.json());
        if (!meow) {
            await interaction.followUp("something shat itself!");
            return;
        }
        if (meow.payload.count === 0) {
            await interaction.followUp(user + " isnt listening to music");
        } else {
            const track_metadata = meow.payload.listens[0].track_metadata
            const paramsObj = {entity: "song", term: track_metadata.artist_name + " " + track_metadata.track_name};
            const searchParams = new URLSearchParams(paramsObj);
            const itunesinfo = (await (await fetch(`https://itunes.apple.com/search?${searchParams.toString()}`)).json()).results[0];
            let link = track_metadata.additional_info.origin_url
            if (useitunes) {
                link = itunesinfo.trackViewUrl
            }
            const songlink = await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json())
            const preferredApi = getSongOnPreferredProvider(songlink, link)
            
            if (preferredApi && usesonglink) {
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
            } else {
                const embedfallback = new EmbedBuilder()
                    .setAuthor({
                        name: meow.payload.listens[0].track_metadata.artist_name
                    })
                    .setTitle(meow.payload.listens[0].track_metadata.track_name)
                    .setFooter({
                        text: "song.link proxying was turned off or failed - amy jr",
                    });
                
                await interaction.followUp({embeds:[embedfallback]})
            }
        }

    }

    slashCommand = new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("balls").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addBooleanOption(option => {
            return option.setName("usesonglink").setDescription("use songlink or not").setRequired(false)
        })
        .addBooleanOption(option => {
            return option.setName("useitunes").setDescription("use itunes or not").setRequired(false)
        })
        .addStringOption(option => {
            return option.setName("user").setDescription("listenbrainz username").setRequired(false)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
