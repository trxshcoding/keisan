import { declareCommand } from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType,
    MessageFlags,
    SlashCommandBooleanOption,
    SlashCommandBuilder,
    SlashCommandStringOption,
    SlashCommandSubcommandBuilder
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        const command = interaction.options.getSubcommand(true)
        switch (command) {
            case "nowplaying": {
                let user = interaction.options.getString("user", true);
                let useLastFM = interaction.options.getBoolean("uselastfm", true);

                await config.prisma.user.upsert({
                    where: { id: interaction.user.id },
                    create: {
                        id: interaction.user.id,
                        musicUsername: user,
                        musicUsesListenbrainz: !useLastFM,
                        shitposts: {}
                    },
                    update: {
                        musicUsername: user,
                        musicUsesListenbrainz: !useLastFM
                    }
                })

                await interaction.reply({
                    content: "Updated your info",
                    flags: [MessageFlags.Ephemeral]
                })
                break
            }
            default: {
                await interaction.reply({
                    content: "what",
                    flags: [MessageFlags.Ephemeral]
                })
                return
            }
        }
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("config")
        .setDescription("change some settings").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("nowplaying")
                .setDescription("for nowplaying")
                .addStringOption(
                    new SlashCommandStringOption()
                        .setName("user")
                        .setDescription("username")
                        .setRequired(true)
                )
                .addBooleanOption(
                    new SlashCommandBooleanOption()
                        .setName("uselastfm")
                        .setDescription("on last.fm or listenbrainz")
                        .setRequired(true)
                )
        )
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
