import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  MessageFlags,
  InteractionContextType,
  type MessageActionRowComponentBuilder,
  SlashCommandBuilder,
  type ApplicationEmoji,
  AttachmentBuilder,
} from "discord.js";

import {
  generateNowplayingImage,
  getSongOnPreferredProvider,
  type HistoryItem,
  itunesResponseShape,
  deezerResponseShape,
  lobotomizedSongButton,
  musicCache,
  type SongLink,
} from "../music.ts";
import { createResizedEmoji, escapeMarkdown, mbApi } from "../util.ts";
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
  .addBooleanOption((option) => {
    return option
      .setName("uselastfm")
      .setDescription("use last.fm or listenbrainz")
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
    else {
      const trackMetadata = res.payload.listens[0].track_metadata;
      return {
        songName: trackMetadata.track_name,
        artistName: trackMetadata.artist_name,
        albumName: trackMetadata.release_name,
        link: trackMetadata.additional_info.origin_url,
        mbid: trackMetadata.additional_info.release_mbid,
      };
    }
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
      return {
        songName: track.name,
        artistName: track.artist["#text"],
        albumName: track.album["#text"],
        mbid: track.mbid,
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

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config): Promise<void> {
    await interaction.deferReply();
    const shouldImageGen = interaction.options.getBoolean("imagegen") ?? false;
    const otherUser = interaction.options.getUser("discord_user");
    let user: string | null;
    let useLastFM: boolean | null;

    if (otherUser) {
      const entry = await config.prisma.user.findFirst({
        where: { id: otherUser.id },
      });
      if (!entry?.musicUsername) {
        await interaction.followUp({
          content: `${otherUser.username} doesn't have a music account saved`,
          flags: [MessageFlags.Ephemeral],
        });
        return;
      }
      user = entry.musicUsername;
      useLastFM = !entry.musicUsesListenbrainz;
    } else {
      const entry = await config.prisma.user.findFirst({
        where: { id: interaction.user.id },
      });
      user = interaction.options.getString("user");
      useLastFM = interaction.options.getBoolean("uselastfm");

      if (entry?.musicUsername) {
        user ??= entry.musicUsername;
        useLastFM ??= !entry.musicUsesListenbrainz;
      }
    }

    if (user === null || useLastFM === null) {
      await interaction.followUp({
        content:
          "you don't have a music account saved. use the `/config nowplaying` command to save them, or specify them as arguments to only use once",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const nowPlaying = await getNowPlaying(user, useLastFM ? config.lastFMApiKey : undefined);

    if (typeof nowPlaying === "undefined") {
      await interaction.followUp("unexpected error; please try again shortly");
      return;
    } else if (!nowPlaying) {
      await interaction.followUp(user + " isn't listening to music");
      return;
    }

    let { link, mbid } = nowPlaying;
    let emoji: ApplicationEmoji | null = null;
    let highQualityCoverLink: string | undefined = undefined;
    let lowQualityCoverLink: string | undefined = undefined;

    if (nowPlaying.albumName?.replace(/ - (?:Single|EP)$/, "") === nowPlaying.songName)
      nowPlaying.albumName = "";

    async function sendFallback(nowPlaying: HistoryItem) {
      await interaction.followUp({
        content: `### ${escapeMarkdown(nowPlaying.songName)} ${emoji ? String(emoji) : ""}
-# by ${escapeMarkdown(nowPlaying.artistName)}\
${nowPlaying.albumName ? ` - from ${escapeMarkdown(nowPlaying.albumName)}` : ""}
-# couldn't get more info about this song`,
      });
      if (emoji) await emoji.delete();
      return;
    }

    if (mbid) {
      const release = await mbApi.lookup("release", mbid, [
        "recordings",
        "artists",
        "labels",
        "url-rels",
        "release-groups",
      ]);
      const musicBrainzInfo = await getMusicBrainzInfo(release, nowPlaying.songName).catch(
        () => {},
      );

      if (musicBrainzInfo) {
        nowPlaying.songName = musicBrainzInfo.songname;
        if (
          musicBrainzInfo.albumname &&
          musicBrainzInfo.albumname.replace(/ - (?:Single|EP)$/, "") !== musicBrainzInfo.songname
        )
          nowPlaying.albumName = musicBrainzInfo.albumname;
        if (musicBrainzInfo.albumartlink) highQualityCoverLink = musicBrainzInfo.albumartlink;
      }
    }

    if (!link) {
      const paramsObj = { q: `artist:"${nowPlaying.artistName}" track:"${nowPlaying.songName}"` };
      const searchParams = new URLSearchParams(paramsObj);
      const deezerInfo = deezerResponseShape.safeParse(
        await httpJson(`https://api.deezer.com/search?${searchParams.toString()}`),
      ).data?.data;

      if (Array.isArray(deezerInfo) && deezerInfo[0]) {
        const track =
          deezerInfo.find((res) => res.title === nowPlaying.songName) ||
          deezerInfo.find((res) => res.title.toLowerCase() === nowPlaying.songName.toLowerCase()) ||
          deezerInfo[0];

        link = track.link;
        if (
          !nowPlaying.albumName &&
          track.album.title &&
          track.album.title.replace(/ - (?:Single|EP)$/, "") !== track.title
        )
          nowPlaying.albumName = track.album.title;
        if (!highQualityCoverLink && track.album.cover_big)
          highQualityCoverLink = track.album.cover_big;
      }

      if (!link) {
        const paramsObj = {
          entity: "song",
          term: `${nowPlaying.artistName} ${nowPlaying.songName}`,
        };
        const searchParams = new URLSearchParams(paramsObj);
        const iTunesInfo = itunesResponseShape.safeParse(
          await httpJson(`https://itunes.apple.com/search?${searchParams.toString()}`),
        ).data?.results;

        if (Array.isArray(iTunesInfo) && iTunesInfo[0]) {
          const track =
            iTunesInfo.find((res) => res.trackName === nowPlaying.songName) ||
            iTunesInfo.find(
              (res) => res.trackName.toLowerCase() === nowPlaying.songName.toLowerCase(),
            ) ||
            iTunesInfo[0];

          link = track.trackViewUrl;
          if (
            !nowPlaying.albumName &&
            track.collectionName?.replace(/ - (?:Single|EP)$/, "") !== track.trackName
          )
            nowPlaying.albumName = track.collectionName;
          if (track.artworkUrl100) lowQualityCoverLink = track.artworkUrl100;
        }
      }
    }

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

      if (!emoji && (highQualityCoverLink || lowQualityCoverLink))
        emoji = await createResizedEmoji(interaction, highQualityCoverLink || lowQualityCoverLink!);
      await sendFallback(nowPlaying);
      return;
    }

    const songlink = await httpJson<SongLink>(`https://api.song.link/v1-alpha.1/links?url=${link}`);
    const preferredApi = getSongOnPreferredProvider(songlink, link!);
    if (!preferredApi) {
      if (!emoji && (highQualityCoverLink || lowQualityCoverLink))
        emoji = await createResizedEmoji(interaction, highQualityCoverLink || lowQualityCoverLink!);
      await sendFallback(nowPlaying);
      return;
    }

    const cacheKey = songlink.pageUrl ?? link;
    if (cacheKey) {
      musicCache[cacheKey] ??= {
        preferredApi,
        songlink,
      };
    }
    nowPlaying.songName = preferredApi.title;
    nowPlaying.artistName = preferredApi.artist;

    const components = [
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel("expand")
          .setCustomId(songlink.pageUrl ?? link!),
      ),
    ];

    if (shouldImageGen) {
      const image = await generateNowplayingImage(
        nowPlaying,
        preferredApi.thumbnailUrl || highQualityCoverLink || lowQualityCoverLink,
      );
      await interaction.followUp({
        files: [new AttachmentBuilder(image).setName("nowplaying.png")],
        components,
      });
      return;
    }

    if (!emoji && preferredApi.thumbnailUrl)
      emoji = await createResizedEmoji(interaction, preferredApi.thumbnailUrl);
    else if (highQualityCoverLink || lowQualityCoverLink)
      emoji = await createResizedEmoji(interaction, highQualityCoverLink || lowQualityCoverLink!);

    await interaction.followUp({
      content: `### ${escapeMarkdown(nowPlaying.songName)} ${emoji ? String(emoji) : ""}
-# by ${escapeMarkdown(nowPlaying.artistName)}\
${nowPlaying.albumName ? ` - from ${escapeMarkdown(nowPlaying.albumName)}` : ""}`,
      components,
    });
    // we do not have infinite emoji slots
    if (emoji) await emoji.delete();
  },
  button: lobotomizedSongButton,
  dependsOn: z.object({
    lastFMApiKey: z.string(),
  }),
  slashCommand,
});
