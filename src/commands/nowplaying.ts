import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  InteractionContextType,
  type MessageActionRowComponentBuilder,
  SlashCommandBuilder,
  type ApplicationEmoji,
  AttachmentBuilder,
  MessageFlags,
} from "discord.js";

import {
  generateNowplayingImage,
  getSongOnPreferredProvider,
  type HistoryItem,
  lobotomizedSongButton,
  musicCache,
  type SongLink,
  resolveMusicUser,
  searchMusicPlatforms,
} from "../music.ts";
import { createResizedEmoji } from "../utils/discord.ts";
import { escapeMarkdown, tryCatch } from "../utils/general.ts";
import { mbApi } from "../music.ts";
import { declareCommand } from "../command.ts";
import { z } from "zod";
import { http, httpJson } from "../lib/http.ts";

const slashCommand = new SlashCommandBuilder()
  .setName("nowplaying")
  .setDescription("balls")
  .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
  .addBooleanOption((option) => {
    return option
      .setName("imagegen")
      .setDescription("generate an image instead of text")
      .setRequired(false);
  })
  .addStringOption((option) => {
    return option.setName("user").setDescription("username").setRequired(false);
  })
  .addStringOption((option) => {
    return option
      .setName("platform")
      .setDescription("scrobble platform")
      .addChoices(
        { name: "Last.fm", value: "lastfm" },
        { name: "ListenBrainz", value: "listenbrainz" },
      )
      .setRequired(false);
  })
  .addUserOption((option) => {
    return option
      .setName("discord_user")
      .setDescription(
        "a user with their music account saved by the bot. has priority over other options",
      )
      .setRequired(false);
  })
  .setContexts([
    InteractionContextType.BotDM,
    InteractionContextType.Guild,
    InteractionContextType.PrivateChannel,
  ]);
import type { IRelease } from "musicbrainz-api";

async function getNowPlaying(
  username: string,
  lastFMApiKey?: string,
): Promise<HistoryItem | false | undefined> {
  if (!lastFMApiKey) {
    const res = await httpJson<{
      payload?: { count: number; listens: Array<{ track_metadata: any }> };
    }>(`https://api.listenbrainz.org/1/user/${username}/playing-now`);
    if (!res?.payload) return;
    else if (res.payload.count === 0) return false;

    let {
      track_name: songName,
      artist_name: artistName,
      release_name: albumName,
      additional_info: additionalInfo,
    } = res.payload.listens[0].track_metadata;
    let albumArt: string | undefined = undefined;

    if (additionalInfo.release_mbid) {
      const [musicBrainzInfo] = await tryCatch(
        mbApi
          .lookup("release", additionalInfo.release_mbid, [
            "recordings",
            "artists",
            "labels",
            "url-rels",
            "release-groups",
          ])
          .then((release) => getMusicBrainzInfo(release, songName)),
      );

      if (musicBrainzInfo) {
        songName = musicBrainzInfo.songname;
        if (
          musicBrainzInfo.albumname &&
          musicBrainzInfo.albumname.replace(/ - (?:Single|EP)$/, "") !== musicBrainzInfo.songname
        )
          albumName = musicBrainzInfo.albumname;
        if (musicBrainzInfo.albumartlink) albumArt = musicBrainzInfo.albumartlink;
      }
    }

    return {
      songName,
      artistName,
      albumName,
      albumArt,
      link: additionalInfo.origin_url,
      mbid: additionalInfo.release_mbid,
    };
  } else {
    const res = await httpJson<any>(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${lastFMApiKey}&limit=1&format=json`,
    );
    if (!res?.recenttracks) return;
    else if (!res.recenttracks?.track?.[0]) return false;
    else {
      const track = res.recenttracks.track[0];
      // yes its a string, horror
      if (track["@attr"]?.nowplaying !== "true") return false;

      const coverArt = track.image?.at(-1)["#text"];
      return {
        songName: track.name,
        artistName: track.artist["#text"],
        albumName: track.album["#text"],
        albumArt:
          coverArt && !coverArt.includes("2a96cbd8b46e442fc41c2b86b821562f") ? coverArt : undefined,
      };
    }
  }
}

async function getMusicBrainzInfo(
  release: IRelease,
  songTitle: string,
): Promise<{
  songname: string;
  albumname: string;
  albumartlink: string;
} | null> {
  if (!release.id) return null;
  const albumname = release.title;
  const track =
    release.media
      ?.flatMap((m) => m.tracks)
      .find((t) => t.title.toLowerCase() === songTitle.toLowerCase()) ??
    release.media?.[0]?.tracks?.[0];

  const songname = track?.title ?? songTitle;

  const coverArtUrl = `https://coverartarchive.org/release/${release.id}/front`;
  try {
    const response = await http.raw(coverArtUrl, { method: "HEAD" });
    if (!response.ok) {
      return null;
    }
    return { songname, albumname, albumartlink: response.url };
  } catch (error) {
    console.error("Failed to fetch cover art:", error);
    return null;
  }
}

async function fetchSongLink(link: string): Promise<SongLink | null> {
  try {
    const songlink = await httpJson<SongLink>(
      `https://api.song.link/v1-alpha.1/links?url=${link}`,
      { timeout: 30_000 },
    );
    return songlink;
  } catch (error) {
    console.error("Failed to fetch song.link:", error);
    return null;
  }
}

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config): Promise<void> {
    await interaction.deferReply();
    const shouldImageGen = interaction.options.getBoolean("imagegen") ?? false;

    const musicUser = await resolveMusicUser(interaction, config.prisma).catch(
      (e: Error) =>
        void interaction.followUp({
          content: e.message,
          flags: [MessageFlags.Ephemeral],
        }),
    );
    if (!musicUser) return;

    const nowPlaying = await getNowPlaying(
      musicUser.username,
      musicUser.useLastFM ? config.lastFMApiKey : undefined,
    );

    if (typeof nowPlaying === "undefined") {
      await interaction.followUp("unexpected error; please try again shortly");
      return;
    } else if (!nowPlaying) {
      await interaction.followUp(musicUser.username + " isn't listening to music");
      return;
    }

    let { link, albumArt } = nowPlaying;
    let highQualityCoverLink: string | undefined = albumArt || undefined;
    let lowQualityCoverLink: string | undefined = undefined;

    if (nowPlaying.albumName?.replace(/ - (?:Single|EP)$/, "") === nowPlaying.songName)
      nowPlaying.albumName = "";

    if (!link) {
      const searchResult = await searchMusicPlatforms(nowPlaying.songName, nowPlaying.artistName);
      if (searchResult) {
        link = searchResult.link;
        if (!nowPlaying.albumName && searchResult.albumName)
          nowPlaying.albumName = searchResult.albumName;
        if (searchResult.artworkUrl) {
          if (searchResult.artworkIsLowQuality) lowQualityCoverLink = searchResult.artworkUrl;
          else highQualityCoverLink = searchResult.artworkUrl;
        }
      }
    }

    const nowPlayingContent = (np: HistoryItem, emoji: ApplicationEmoji | null) => {
      return `### ${escapeMarkdown(np.songName)} ${emoji?.toString() || ""}
-# by ${escapeMarkdown(np.artistName)}\
${np.albumName ? ` - from ${escapeMarkdown(np.albumName)}` : ""}`;
    };
    const loadingButton = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Secondary)
        .setLabel("loading streaming links...")
        .setCustomId("loading-placeholder")
        .setDisabled(true),
    );

    if (!link) {
      if (shouldImageGen) {
        const image = await generateNowplayingImage(
          nowPlaying,
          highQualityCoverLink || lowQualityCoverLink,
        );
        await interaction.followUp({
          files: [new AttachmentBuilder(image).setName("nowplaying.png")],
        });
        return;
      }

      let emoji: ApplicationEmoji | null = null;
      if (highQualityCoverLink || lowQualityCoverLink)
        emoji = await createResizedEmoji(interaction, highQualityCoverLink || lowQualityCoverLink!);

      await interaction.followUp({
        content: `${nowPlayingContent(nowPlaying, emoji)}
-# couldn't get more info about this song`,
      });
      if (emoji) await emoji.delete();
      return;
    }

    const coverLink = highQualityCoverLink || lowQualityCoverLink;
    let emoji: ApplicationEmoji | null = null;
    let initialContent;

    if (shouldImageGen) {
      const img = await generateNowplayingImage(nowPlaying, coverLink);
      initialContent = {
        files: [new AttachmentBuilder(img).setName("nowplaying.png")],
      };
    } else {
      if (coverLink) {
        emoji = await createResizedEmoji(interaction, coverLink);
      }
      initialContent = { content: nowPlayingContent(nowPlaying, emoji) };
    }

    await interaction.followUp({
      ...initialContent,
      components: [loadingButton],
    });
    const sendSonglinkFallback = async () =>
      shouldImageGen
        ? await interaction.editReply({
            ...initialContent,
            content: `-# couldn't find streaming links`,
            components: [],
          })
        : await interaction.editReply({
            content: `${initialContent.content}
-# couldn't find streaming links`,
            components: [],
          });

    fetchSongLink(link)
      .then(async (songlink) => {
        if (!songlink || !songlink.pageUrl) {
          await sendSonglinkFallback();
          return;
        }
        const preferredApi = getSongOnPreferredProvider(songlink, link);
        if (!preferredApi) {
          await sendSonglinkFallback();
          return;
        }

        const finalNowPlaying = {
          ...nowPlaying,
          songName: preferredApi.title,
          artistName: preferredApi.artist,
        };
        let finalContent;
        if (shouldImageGen) {
          if (!highQualityCoverLink) {
            const img = await generateNowplayingImage(nowPlaying, preferredApi.thumbnailUrl);
            finalContent = {
              files: [new AttachmentBuilder(img).setName("nowplaying.png")],
            };
          } else finalContent = initialContent;
        } else {
          if (!highQualityCoverLink) {
            if (emoji) await emoji.delete();
            emoji = await createResizedEmoji(interaction, preferredApi.thumbnailUrl);
          }
          finalContent = { content: nowPlayingContent(finalNowPlaying, emoji) };
        }

        const finalComponents = [
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Secondary)
              .setLabel("expand")
              .setCustomId(songlink.pageUrl),
          ),
        ];

        musicCache[songlink.pageUrl] = {
          preferredApi,
          songlink,
        };

        await interaction.editReply({
          ...finalContent,
          components: finalComponents,
        });
      })
      .catch(async (error) => {
        console.error("Error in song.link fetch:", error);
        await sendSonglinkFallback();
      })
      .finally(async () => {
        if (emoji) await emoji.delete();
      });
  },
  button: lobotomizedSongButton,
  dependsOn: z.object({
    lastFMApiKey: z.string(),
  }),
  slashCommand,
  aliases: ["np", "nowplaying"],
});
