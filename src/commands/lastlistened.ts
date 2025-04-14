import {Command} from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import * as z from 'zod'
import {type Config} from "../config.ts";
import {inspect} from "node:util";

const listenBrainzListensShape = z.object(
    {
        payload: z.object({
            user_id: z.string(),
            latest_listen_ts: z.number(),
            oldest_listen_ts: z.number(),
            listens: z.array(z.object({
                track_metadata: z.object({
                    release_name: z.string().optional(),
                    track_name: z.string(),
                    artist_name: z.string(),
                }),
                user_name: z.string(),
            })),
        })
    }
)

export default class LastListenedCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply()
        const user = interaction.options.getString("user") ?? config.listenbrainzAccount;
        const historyAmount = interaction.options.getInteger("count") ?? 3;
        const meow = await fetch(`https://api.listenbrainz.org/1/user/${user}/listens`).then((res) => res.json());
        const zodded = listenBrainzListensShape.parse(meow)
        const object = zodded.payload.listens.slice(0, historyAmount);

        const songs = object.slice(0, historyAmount).map((i) => {
            const shit = i.track_metadata;
            const name = shit.track_name;
            return `- ${name} by ${shit.artist_name}`;
        }).join('\n');

        await interaction.followUp({
            content: `The last ${historyAmount} songs of ${user} were:\n\n${songs}`
        });
    }

    slashCommand = new SlashCommandBuilder()
        .setName("lastlistened")
        .setDescription("get that last listened music of a person").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addIntegerOption(option => {
            return option.setName("count").setDescription("amount of history you want").setRequired(false)
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
