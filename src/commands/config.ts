import { declareCommand } from "../command.ts";
import {
  ApplicationIntegrationType,
  ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  SlashCommandBooleanOption,
  SlashCommandBuilder,
  SlashCommandStringOption,
  SlashCommandSubcommandBuilder,
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config: Config) {
    const command = interaction.options.getSubcommand(true);
    switch (command) {
      case "nowplaying": {
        const user = interaction.options.getString("user");
        const useLastFM = interaction.options.getBoolean("uselastfm");
        const view = interaction.options.getString("view");

        if (user === null && useLastFM === null && view === null) {
          await interaction.reply({
            content: "nothing to change",
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        const existing = await config.prisma.user.findUnique({
          where: { id: interaction.user.id },
        });
        if (!existing?.musicUsername && (user === null || useLastFM === null)) {
          await interaction.reply({
            content:
              "you don't have a music account saved yet; provide both `user` and `uselastfm` to set it up",
            flags: [MessageFlags.Ephemeral],
          });
          return;
        }

        await config.prisma.user.upsert({
          where: { id: interaction.user.id },
          create: {
            id: interaction.user.id,
            musicUsername: user!,
            musicUsesListenbrainz: !useLastFM!,
            nowplayingView: view,
            shitposts: {},
          },
          update: {
            ...(user !== null && { musicUsername: user }),
            ...(useLastFM !== null && { musicUsesListenbrainz: !useLastFM }),
            ...(view !== null && { nowplayingView: view }),
          },
        });

        await interaction.reply({
          content: "updated your info",
          flags: [MessageFlags.Ephemeral],
        });
        break;
      }
      default: {
        await interaction.reply({
          content: "what",
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }
    }
  },
  dependsOn: NO_EXTRA_CONFIG,
  slashCommand: new SlashCommandBuilder()
    .setName("config")
    .setDescription("change some settings")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addSubcommand(
      new SlashCommandSubcommandBuilder()
        .setName("nowplaying")
        .setDescription("for nowplaying")
        .addStringOption(new SlashCommandStringOption().setName("user").setDescription("username"))
        .addBooleanOption(
          new SlashCommandBooleanOption()
            .setName("uselastfm")
            .setDescription("on last.fm or listenbrainz"),
        )
        .addStringOption(
          new SlashCommandStringOption()
            .setName("view")
            .setDescription("the way the nowplaying response looks")
            .setChoices([
              { name: "Small", value: "emoji" },
              { name: "Large", value: "normal" },
              { name: "Image", value: "imagegen" },
            ]),
        ),
    )
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ]),
});
