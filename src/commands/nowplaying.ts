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

import {getSongOnPreferredProvider} from "../helper.ts"
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
        console.log(`https://api.listenbrainz.org/1/user/${user}/playing-now`);
        const meow = await fetch(`https://api.listenbrainz.org/1/user/${user}/playing-now`).then((res) => res.json());
        if (!meow) {
            await interaction.followUp("something shat itself!");
            return;
        }
        if (meow.payload.count === 0) {
            await interaction.followUp("user isnt listening to music");
        } else {
            const track_metadata = meow.payload.listens[0].track_metadata
            if (track_metadata.additional_info.origin_url) {
                const link = keepV(track_metadata.additional_info.origin_url)

                const preferredApi = getSongOnPreferredProvider(await fetch(`https://api.song.link/v1-alpha.1/links?url=${link}`).then(a => a.json()), link)
                if (preferredApi) {
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
                    return
                }

            }
            let hasURL = false;
            if (track_metadata.additional_info.release_mbid) {
                const thing = await fetch(`https://coverartarchive.org/release/${track_metadata.additional_info.release_mbid}/front`, {
                    method: "HEAD",
                    redirect: "manual",
                })
                hasURL = thing.status === 307;
            }
            let embed = new EmbedBuilder()
                .setAuthor({
                    name: track_metadata.artist_name,
                })
                .setTitle(track_metadata.track_name)
                .setDescription("could not get additional info")
                .setFooter({
                    text: "amy jr",
                });
            if (hasURL) {
                embed.setThumbnail(`https://aart.yellows.ink/release/${track_metadata.additional_info.release_mbid}.webp`);
            }
            await interaction.followUp({
                embeds: [embed],
            })
        }

    }

    slashCommand = new SlashCommandBuilder()
        .setName("nowplaying")
        .setDescription("balls").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
            return option.setName("user").setDescription("listenbrainz username").setRequired(false)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
