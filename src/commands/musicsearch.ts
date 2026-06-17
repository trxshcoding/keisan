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
  SlashCommandBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import {
  generateNowplayingImage,
  getSongOnPreferredProvider,
  lobotomizedSongButton,
  musicCache,
  type SongLink,
  searchMusicPlatforms,
} from "../music.ts";
import { NO_EXTRA_CONFIG } from "../config.ts";
import { declareCommand } from "../command.ts";
import { httpJson } from "../lib/http.ts";

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, _config) {
    await interaction.deferReply();
    const search = interaction.options.getString("search", true).trim();
    const shouldImageGen = interaction.options.getBoolean("imagegen") ?? false;
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

    let preferredApi, songlink;
    songlink = await httpJson<SongLink>(`https://api.song.link/v1-alpha.1/links?url=${link}`, {
      timeout: 30_000,
    });
    preferredApi = getSongOnPreferredProvider(songlink, link)!;

    const cacheKey = songlink.pageUrl ?? link;
    if (cacheKey) {
      musicCache[cacheKey] ??= {
        preferredApi,
        songlink,
      };
    }

    const emoji = await createResizedEmoji(interaction, preferredApi.thumbnailUrl);

    const components = [
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel("expand")
          .setCustomId(songlink.pageUrl ?? link),
      ),
    ];

    if (shouldImageGen) {
      const image = await generateNowplayingImage(
        {
          songName: preferredApi.title,
          artistName: preferredApi.artist,
          albumName,
        },
        preferredApi.thumbnailUrl,
      );

      await interaction.followUp({
        files: [new AttachmentBuilder(image).setName("nowplaying.png")],
        components,
      });
      return;
    }

    await interaction.followUp({
      content: `### ${escapeMarkdown(preferredApi.title)} ${emoji ? String(emoji) : ""}
-# by ${escapeMarkdown(preferredApi.artist)}${albumName ? ` - from ${escapeMarkdown(albumName)}` : ""}`,
      components,
    });

    await emoji?.delete();
    return;
  },
  button: lobotomizedSongButton,
  dependsOn: NO_EXTRA_CONFIG,
  slashCommand: new SlashCommandBuilder()
    .setName("musicinfo")
    .setDescription("search yo music")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addStringOption((option) => {
      return option.setName("search").setDescription("smth you wanna search").setRequired(true);
    })
    .addBooleanOption((option) => {
      return option.setName("imagegen").setDescription("show result as an image");
    })
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ]),
});
