import { declareCommand } from "../command.ts";
import {
  ApplicationIntegrationType,
  type AutocompleteFocusedOption,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { z } from "zod";
import { httpJson } from "../lib/http.ts";
import { URL } from "node:url";
import { createResizedEmoji } from "../util.ts";

async function getSharkeyEmojis(config: { sharkeyInstance: string }) {
  const base = config.sharkeyInstance.startsWith("http")
    ? config.sharkeyInstance
    : `https://${config.sharkeyInstance}`;
  const emojis = await httpJson<{ emojis: Array<{ name: string; url: string }> }>(
    new URL("/api/emojis", base).toString(),
  );
  const typedEmojis: Array<{ name: string; url: string }> = emojis.emojis;
  return typedEmojis;
}

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "fedi") {
      await interaction.deferReply();
      const emojiname = interaction.options.getString("emoji");
      const shit = await interaction.client.application.emojis.fetch();
      const theEmojiInApplicationEmojis = shit.find((item) => item.name === emojiname);
      if (!theEmojiInApplicationEmojis) {
        const theEmojiWeWannaUpload = (await getSharkeyEmojis(config)).find(
          (emoji) => emoji.name === emojiname,
        )!;
        console.log(theEmojiWeWannaUpload);
        const emoji = await interaction.client.application.emojis.create({
          attachment: theEmojiWeWannaUpload.url,
          name: theEmojiWeWannaUpload.name,
        });
        await interaction.followUp(`${String(emoji)}`);
        await emoji.delete();
      } else {
        await interaction.followUp(
          `<${theEmojiInApplicationEmojis.animated ? "a" : ""}:${theEmojiInApplicationEmojis.name}:${theEmojiInApplicationEmojis.id}>`,
        );
      }
    } else if (subcommand === "user") {
      await interaction.deferReply();
      const user = interaction.options.getUser("user", true);
      const balls = user.avatarURL({
        size: 2048,
      });
      if (!balls) {
        await interaction.followUp("user has no avatar");
        return;
      }
      const pussy = await createResizedEmoji(interaction, balls);
      if (!pussy) {
        await interaction.followUp("no pussy");
        return;
      }
      await interaction.followUp(`${pussy}`);
      await pussy.delete();
    }
  },

  async autoComplete(
    interaction: AutocompleteInteraction,
    config,
    option: AutocompleteFocusedOption,
  ): Promise<void> {
    if (option.name === "emoji") {
      const search = option.value;
      const emojiArray = (await getSharkeyEmojis(config)).map((i) => i.name);
      const matches = emojiArray
        .filter((item: string) => item && item.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 25);

      await interaction.respond(
        matches.map((emoji) => ({
          name: emoji!,
          value: emoji!,
        })),
      );
    }
  },
  dependsOn: z.object({
    sharkeyInstance: z.string(),
  }),
  slashCommand: new SlashCommandBuilder()
    .setName("emoji")
    .setDescription("emoji related commands")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addSubcommand((subcommand) =>
      subcommand
        .setName("fedi")
        .setDescription("use an emoji from a fediverse instance")
        .addStringOption((option) => {
          return option
            .setName("emoji")
            .setRequired(true)
            .setDescription("the emojis name")
            .setAutocomplete(true);
        }),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("user")
        .setDescription("use an emoji from a user")
        .addUserOption((option) =>
          option.setName("user").setRequired(true).setDescription("the user to get the emoji from"),
        ),
    )
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ]),
});
