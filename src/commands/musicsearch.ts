import { createResizedEmoji } from "../utils/discord.ts";
import { escapeMarkdown } from "../utils/general.ts";
import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import { NO_EXTRA_CONFIG } from "../config.ts";
import { declareCommand } from "../command.ts";
import { trackContainer } from "../music/components.ts";
import { generateNowplayingImage } from "../music/image.ts";
import { resolveTrackFromLink, songLinkLabel } from "../music/link-resolve.ts";
import { searchMusicPlatforms } from "../music/search.ts";

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, _config) {
    await interaction.deferReply();
    const search = interaction.options.getString("search", true).trim();
    const responseType = (interaction.options.getString("view") ?? "emoji") as
      | "emoji"
      | "normal"
      | "imagegen";
    let link = "",
      albumName = "";

    if (search.match(/^https?:\/\//)) {
      link = search;
    } else {
      const searchResult = await searchMusicPlatforms(search);
      if (searchResult) {
        link = searchResult.link;
        albumName = searchResult.albumName;
      }
    }

    if (!link) {
      await interaction.followUp("couldn't find that");
      return;
    }

    const resolved = await resolveTrackFromLink(link);
    const songName = resolved?.title;
    const artistName = resolved?.artist;

    const components = [
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(link).setLabel(songLinkLabel(link)),
      ),
    ];

    switch (responseType) {
      case "emoji": {
        const emoji = resolved?.coverUrl
          ? await createResizedEmoji(interaction, resolved.coverUrl)
          : null;

        await interaction.followUp({
          content: `${
            songName
              ? `### ${escapeMarkdown(songName)} ${emoji ? String(emoji) : ""}
-# by ${escapeMarkdown(artistName ?? "")}${albumName ? ` - from ${escapeMarkdown(albumName)}` : ""}`
              : "couldn't fetch track info, but here's the link"
          }`,
          components,
        });

        if (emoji) void emoji.delete();
        return;
      }
      case "normal": {
        if (!songName) {
          await interaction.followUp({
            content: "couldn't fetch track info, but here's the link",
            components,
          });
          return;
        }
        await interaction.followUp({
          components: [
            trackContainer({
              songName,
              artistName: artistName ?? "",
              albumName,
              coverUrl: resolved?.coverUrl,
              link,
            }),
          ],
          flags: [MessageFlags.IsComponentsV2],
        });
        return;
      }
      case "imagegen": {
        if (!songName) {
          await interaction.followUp({
            content: "couldn't fetch track info, but here's the link",
            components,
          });
          return;
        }
        const image = await generateNowplayingImage(
          {
            songName,
            artistName: artistName ?? "",
            albumName,
          },
          resolved?.coverUrl,
        );

        await interaction.followUp({
          files: [new AttachmentBuilder(image).setName("nowplaying.png")],
          components,
        });
        return;
      }
    }
  },
  dependsOn: NO_EXTRA_CONFIG,
  slashCommand: new SlashCommandBuilder()
    .setName("musicinfo")
    .setDescription("search yo music")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addStringOption((option) => {
      return option.setName("search").setDescription("smth you wanna search").setRequired(true);
    })
    .addStringOption((option) =>
      option
        .setName("view")
        .setDescription("the way the response looks")
        .setChoices([
          { name: "Small", value: "emoji" },
          { name: "Large", value: "normal" },
          { name: "Image", value: "imagegen" },
        ])
        .setRequired(false),
    )
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ]),
});
