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
        const meow = await fetch(`https://api.listenbrainz.org/1/user/${user}/listens`).then((res) => res.json());
        const zodded = listenBrainzListensShape.parse(meow)
        const object = zodded.payload.listens.slice(0, 3);

        await interaction.followUp({
            content: `the last 3 songs of ${user} was:\n\n- ${object[0].track_metadata.release_name} by ${object[0].track_metadata.artist_name}\n- ${object[1].track_metadata.release_name} by ${object[1].track_metadata.artist_name}\n- ${object[2].track_metadata.release_name} by ${object[2].track_metadata.artist_name}`
        });
    }

    slashCommand = new SlashCommandBuilder()
        .setName("lastlistened")
        .setDescription("get that last listened music of a person").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addStringOption(option => {
            return option.setName("user").setDescription("listenbrainz username").setRequired(false)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
