import { declareCommand } from "../command.ts";
import {
  ApplicationIntegrationType,
  ChatInputCommandInteraction,
  ContainerBuilder,
  InteractionContextType,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  SlashCommandUserOption,
  TextDisplayBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import { httpJson } from "../lib/http.ts";
import { URL } from "node:url";

const categories = ["hug", "pat", "bonk", "poke", "handhold", "bite", "slap"]; // as const
const tense: Record<(typeof categories)[number], string> = {
  hug: "$1 hugs $2",
  pat: "$1 pets $2",
  bonk: "$1 bonks $2",
  poke: "$1 pokes $2",
  handhold: "$1 holds $2's hand",
  bite: "$1 bites $2",
  slap: "$1 slaps $2",
};

let slashCommand: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
  .setName("interaction")
  .setDescription("uwaa thats so cute")
  .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
  .setContexts([
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  ]);
for (const cat of categories) {
  slashCommand = slashCommand.addSubcommand(
    new SlashCommandSubcommandBuilder()
      .setName(cat)
      .setDescription(cat)
      .addUserOption(
        new SlashCommandUserOption().setName("user").setDescription("someone").setRequired(true),
      ),
  );
}

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, _config: Config) {
    const subcommand = interaction.options.getSubcommand(true);
    const user = interaction.options.getUser("user", true);
    if (!user) {
      await interaction.reply({
        content: "who",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const res = await httpJson<{ url?: string; code?: number }>(
      new URL(`/sfw/${subcommand}`, "https://api.waifu.pics").toString(),
    );
    if (!res?.url) {
      await interaction.reply({
        content: "unexpected error; please try again shortly",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.reply({
      components: [
        new ContainerBuilder()
          .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
              `### ${tense[subcommand]
                .replace("$1", interaction.user.displayName)
                .replace(
                  "$2",
                  user.id === interaction.user.id ? "themselves" : user.displayName,
                )}\n-# powered by waifu.pics`,
            ),
          )
          .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(res.url)),
          )
          .setAccentColor(0xff80ce),
      ],
      flags: [MessageFlags.IsComponentsV2],
    });
  },
  dependsOn: NO_EXTRA_CONFIG,
  slashCommand,
});
