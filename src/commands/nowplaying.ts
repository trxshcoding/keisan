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
  ComponentType,
  ThumbnailBuilder,
  type APIComponentInContainer,
} from "discord.js";

import {
  generateNowplayingImage,
  type HistoryItem,
  resolveMusicUser,
  searchMusicPlatforms,
  resolveTrackFromLink,
  songLinkLabel,
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

type Status = "OK" | "NOTLISTENING" | "USERNOTFOUND" | "UNKNOWNERROR";

type MusicBrainzInfo = {
  songname: string;
  albumname: string;
  albumartlink: string;
};

const lastfmScrapeCache = {} as Record<string, { link?: string }>;
const lastfmScrapeCacheTTL = 60 * 60 * 1000;
const mbCache = {} as Record<string, { data: MusicBrainzInfo | null }>;
const mbCacheTTL = 60 * 60 * 1000;

async function getMBInfo(mbid: string, songTitle: string): Promise<MusicBrainzInfo | null> {
  const cached = mbCache[mbid];
  if (cached) return cached.data;

  const [info] = await tryCatch(
    mbApi
      .lookup("release", mbid, ["recordings", "artists", "labels", "url-rels", "release-groups"])
      .then((release) => getMusicBrainzInfo(release, songTitle)),
  );
  mbCache[mbid] = { data: info };
  setTimeout(() => delete mbCache[mbid], mbCacheTTL);
  return info ?? null;
}

async function getNowPlayingLastFM(
  username: string,
  token: string,
): Promise<{ status: Status; data?: any }> {
  let response: any;
  try {
    response = await httpJson(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${token}&limit=1&format=json`,
    );
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return { status: "USERNOTFOUND" };
    } else {
      return { status: "UNKNOWNERROR" };
    }
  }
  const balls = response?.recenttracks?.track[0];
  if (balls["@attr"]?.nowplaying === "true") {
    return { status: "OK", data: response };
  } else {
    return { status: "NOTLISTENING" };
  }
}

async function getNowPlayingListenbrainz(
  username: string,
): Promise<{ status: Status; data?: any }> {
  let response: any;
  try {
    response = await httpJson(`https://api.listenbrainz.org/1/user/${username}/playing-now`);
  } catch (error: any) {
    if (error.response && error.response.status === 404) {
      return { status: "USERNOTFOUND" };
    } else {
      return { status: "UNKNOWNERROR" };
    }
  }
  if (response && response.payload && response.payload.count !== 0) {
    return { status: "OK", data: response.payload };
  } else {
    return { status: "NOTLISTENING" };
  }
}

async function getNowPlaying(
  username: string,
  lastFMApiKey?: string,
): Promise<{ status: "ok"; item: HistoryItem } | { status: "error"; err: Status }> {
  if (!lastFMApiKey) {
    const res = await getNowPlayingListenbrainz(username);
    if (!res.data) {
      return { status: "error", err: res.status };
    }
    let {
      track_name: songName,
      artist_name: artistName,
      release_name: albumName,
      additional_info: additionalInfo,
    } = res.data.listens[0].track_metadata;
    let albumArt: string | undefined = undefined;

    if (additionalInfo.release_mbid) {
      const musicBrainzInfo = await getMBInfo(additionalInfo.release_mbid, songName);
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
      status: "ok",
      item: {
        songName,
        artistName,
        albumName,
        albumArt,
        link: additionalInfo.origin_url,
        mbid: additionalInfo.release_mbid,
      },
    };
  } else {
    const res = await getNowPlayingLastFM(username, lastFMApiKey);
    if (!res.data) {
      return { status: "error", err: res.status };
    } else {
      const track = res.data.recenttracks.track[0];

      let coverArt = track.image?.at(-1)["#text"];
      if (coverArt && coverArt.includes("2a96cbd8b46e442fc41c2b86b821562f")) coverArt = undefined;

      const cacheKey = track.url;
      const page = lastfmScrapeCache[cacheKey];
      const scrapePromise = page
        ? Promise.resolve(page.link)
        : (async () => {
            const content = await (await fetch(track.url)).text();
            const spotify = content.match(
              /play-this-track-playlink--spotify(?:.{0,500})href="(.+?)"/s,
            )?.[1];

            lastfmScrapeCache[cacheKey] = { link: spotify };
            setTimeout(() => delete lastfmScrapeCache[cacheKey], lastfmScrapeCacheTTL);
            return spotify;
          })();

      const [spotifyLink, coverArtRes] = await Promise.all([
        scrapePromise,
        coverArt ? fetch(coverArt, { method: "HEAD" }) : Promise.resolve({ ok: false } as const),
      ]);

      const historyItem: HistoryItem = {
        songName: track.name,
        artistName: track.artist["#text"],
        albumName: track.album["#text"],
        albumArt: coverArt && coverArtRes.ok ? coverArt : undefined,
      };
      if (spotifyLink) historyItem.link = spotifyLink;

      return {
        status: "ok",
        item: historyItem,
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

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config): Promise<void> {
    await interaction.deferReply();
    const responseType = (interaction.options.getString("view") || "emoji") as
      | "emoji"
      | "normal"
      | "imagegen";

    const musicUser = await resolveMusicUser(interaction, config.prisma).catch(
      (e: Error) =>
        void interaction.followUp({
          content: e.message,
          flags: [MessageFlags.Ephemeral],
        }),
    );
    if (!musicUser) return;

    const nowPlayingRes = await getNowPlaying(
      musicUser.username,
      musicUser.useLastFM ? config.lastFMApiKey : undefined,
    );
    if (nowPlayingRes.status === "error") {
      switch (nowPlayingRes.err) {
        case "NOTLISTENING":
          await interaction.followUp(`${musicUser.username} is not listening to music`);
          return;
        case "UNKNOWNERROR":
          await interaction.followUp("unexpected error; please try again shortly");
          return;
        case "USERNOTFOUND":
          await interaction.followUp(`user ${musicUser.username} not found`);
          return;
        default:
          await interaction.followUp("unexpected error; please try again shortly");
          return;
      }
    }
    const nowPlaying = nowPlayingRes.item;
    let { link, albumArt } = nowPlaying;
    let highQualityCoverLink: string | undefined = albumArt || undefined;
    let lowQualityCoverLink: string | undefined = undefined;

    if (nowPlaying.albumName?.replace(/ - (?:Single|EP)$/, "") === nowPlaying.songName)
      nowPlaying.albumName = "";

    if (link) {
      const resolved = await resolveTrackFromLink(link);
      if (resolved) {
        if (resolved.title) nowPlaying.songName = resolved.title;
        if (resolved.artist) nowPlaying.artistName = resolved.artist;
        if (resolved.album && !nowPlaying.albumName) nowPlaying.albumName = resolved.album;
        if (resolved.coverUrl) {
          if (resolved.coverIsHighQuality) highQualityCoverLink = resolved.coverUrl;
          else lowQualityCoverLink = resolved.coverUrl;
        }
      }
    }
    if (!link || (!highQualityCoverLink && !lowQualityCoverLink)) {
      const searchResult = await searchMusicPlatforms(nowPlaying.songName, nowPlaying.artistName);
      if (!link && searchResult) link = searchResult.link;
      if (!highQualityCoverLink && searchResult?.artworkUrl) {
        if (searchResult.artworkIsLowQuality) lowQualityCoverLink = searchResult.artworkUrl;
        else highQualityCoverLink = searchResult.artworkUrl;
      }
    }

    const coverLink = highQualityCoverLink || lowQualityCoverLink;

    switch (responseType) {
      case "emoji": {
        let emoji: ApplicationEmoji | null = null;
        if (coverLink) emoji = await createResizedEmoji(interaction, coverLink);
        let content = `### ${escapeMarkdown(nowPlaying.songName)} ${emoji?.toString() || ""}
-# by ${escapeMarkdown(nowPlaying.artistName)}\
${nowPlaying.albumName ? ` - from ${escapeMarkdown(nowPlaying.albumName)}` : ""}`;

        const components = [] as ActionRowBuilder<MessageActionRowComponentBuilder>[];
        if (link)
          components.push(
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(link)
                .setLabel(songLinkLabel(link)),
            ),
          );
        else content += "\n-# couldn't find a streaming link";

        await interaction.followUp({
          content,
          components,
        });
        if (emoji) void emoji.delete();
        return;
      }
      case "normal": {
        const components = [] as APIComponentInContainer[];
        if (coverLink)
          components.push({
            type: ComponentType.Section,
            accessory: new ThumbnailBuilder().setURL(coverLink).toJSON(),
            components: [
              {
                type: ComponentType.TextDisplay,
                content: `# ${escapeMarkdown(nowPlaying.songName)}`,
              },
              {
                type: ComponentType.TextDisplay,
                content: `${escapeMarkdown(nowPlaying.artistName)}${nowPlaying.albumName ? ` · *${escapeMarkdown(nowPlaying.albumName)}*` : ``}`,
              },
            ],
          });
        else
          components.push(
            {
              type: ComponentType.TextDisplay,
              content: `# ${escapeMarkdown(nowPlaying.songName)}`,
            },
            {
              type: ComponentType.TextDisplay,
              content: `${escapeMarkdown(nowPlaying.artistName)}${nowPlaying.albumName ? ` · *${escapeMarkdown(nowPlaying.albumName)}*` : ``}`,
            },
          );

        if (link)
          components.push({
            type: ComponentType.ActionRow,
            components: [
              {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                url: link,
                label: songLinkLabel(link),
              },
            ],
          });
        else
          components.push({
            type: ComponentType.TextDisplay,
            content: "-# couldn't find a streaming link",
          });

        await interaction.followUp({
          components: [
            {
              type: ComponentType.Container,
              components,
            },
          ],
          flags: [MessageFlags.IsComponentsV2],
        });
        return;
      }
      case "imagegen": {
        const image = await generateNowplayingImage(
          nowPlaying,
          highQualityCoverLink || lowQualityCoverLink,
        );
        const components = [] as ActionRowBuilder<MessageActionRowComponentBuilder>[];
        if (link)
          components.push(
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
              new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(link)
                .setLabel(songLinkLabel(link)),
            ),
          );

        await interaction.followUp({
          files: [new AttachmentBuilder(image).setName("nowplaying.png")],
          components,
        });
        return;
      }
    }
  },
  dependsOn: z.object({
    lastFMApiKey: z.string(),
  }),
  slashCommand,
  aliases: ["np", "nowplaying"],
});
