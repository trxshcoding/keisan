import { createResizedEmoji, escapeMarkdown } from "../util.ts";
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
  deezerResponseShape,
  generateNowplayingImage,
  getSongOnPreferredProvider,
  itunesResponseShape,
  lobotomizedSongButton,
  musicCache,
  type SongLink,
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
      const deezerInfo = deezerResponseShape.safeParse(
        await httpJson(`https://api.deezer.com/search/track?q=${encodeURIComponent(search)}`),
      ).data?.data;

      if (Array.isArray(deezerInfo) && deezerInfo[0]) {
        const track =
          deezerInfo.find((res) => res.title === search) ||
          deezerInfo.find((res) => res.title.toLowerCase() === search.toLowerCase()) ||
          deezerInfo[0];

        link = track.link;
        albumName =
          track.album.title.replace(/ - (?:Single|EP)$/, "") === track.album.title
            ? ""
            : track.album.title.replace(/ - (?:Single|EP)$/, "");
      }

      if (!link) {
        const iTunesSearchParams = new URLSearchParams({ entity: "song", term: search });
        const iTunesJson = await httpJson(
          `https://itunes.apple.com/search?${iTunesSearchParams.toString()}`,
        );
        const iTunesInfo = itunesResponseShape.safeParse(iTunesJson).data?.results;
        if (!iTunesInfo) {
          await interaction.followUp("couldn't find that");
          return;
        }

        const track =
          iTunesInfo.find((res) => res.trackName === search) ||
          iTunesInfo.find((res) => res.trackName.toLowerCase() === search.toLowerCase()) ||
          iTunesInfo[0];
        if (!track) {
          await interaction.followUp("couldn't find that");
          return;
        }
        link = track.trackViewUrl;
        albumName =
          track.collectionName.replace(/ - (?:Single|EP)$/, "") === track.trackName
            ? ""
            : track.collectionName.replace(/ - (?:Single|EP)$/, "");
      }
    }

    let preferredApi, songlink;
    songlink = await httpJson<SongLink>(`https://api.song.link/v1-alpha.1/links?url=${link}`, { timeout: 30_000 });
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
