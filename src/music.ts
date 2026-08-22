import {
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";
import { z } from "zod";
import { PrismaClient } from "./generated/prisma/index.js";
import type { Config } from "./config.ts";
import { escapeMarkdown, numberFaggtory, tryCatch } from "./utils/general.ts";
import { calculateTextHeight, wrapText } from "./utils/canvas.ts";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
  type CanvasRenderingContext2D,
} from "@napi-rs/canvas";
import { http, httpBuffer, httpJson } from "./lib/http.ts";
import sharp from "sharp";
import { fromPublic } from "./lib/paths.ts";
import { MusicBrainzApi } from "musicbrainz-api";

export const mbApi = new MusicBrainzApi({
  appName: "YourAppName",
  appVersion: "1.0.0",
});

export interface Song {
  title: string;
  artist: string;
  apiProvider: string;
  thumbnailUrl: string;
  link: string;
}

export type HistoryItem = {
  songName: string;
  artistName: string;
  albumName?: string;
  albumArt?: string;
  link?: string;
  extraLinks?: { name: string; url: string; uniqueId: string }[];
  mbid?: string;
};

const songLinkShape = z.object({
  userCountry: z.string(),
  pageUrl: z.string().optional(),
  entitiesByUniqueId: z.record(
    z.string(),
    z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      thumbnailUrl: z.string().optional(),
      apiProvider: z.string(),
      artistName: z.string(),
    }),
  ),
  linksByPlatform: z.record(
    z.string(),
    z.object({
      url: z.string().url(),
      entityUniqueId: z.string(),
    }),
  ),
});
export type SongLink = z.infer<typeof songLinkShape>;
//i hate this
export const preferredProviders = ["spotify", "deezer", "youtubeMusic", "tidal", "itunes"];

export function getSongOnPreferredProvider(json: unknown, _link: string): Song | null {
  const maybesong = songLinkShape.safeParse(json);
  if (!maybesong.success) {
    return null;
  }
  const song = maybesong.data;
  for (const platform of preferredProviders) {
    if (!song.linksByPlatform[platform]) continue;

    const entityId = song.linksByPlatform[platform].entityUniqueId;
    const songInfo = song.entitiesByUniqueId[entityId];
    if (!songInfo) continue;

    return {
      title: songInfo.title,
      artist: songInfo.artistName,
      apiProvider: songInfo.apiProvider,
      thumbnailUrl: songInfo.thumbnailUrl!,
      link: song.linksByPlatform[platform].url,
    };
  }
  return null;
}

export function injectSonglinkEntries(songlink: SongLink, extraLinks: HistoryItem["extraLinks"]) {
  if (!extraLinks) return;
  for (const res of extraLinks) {
    if (songlink.linksByPlatform[res.name.toLowerCase()]) continue;
    songlink.linksByPlatform[res.name.toLowerCase()] = {
      url: res.url,
      entityUniqueId: res.uniqueId,
    };
  }
}

export const itunesResponseShape = z.object({
  results: z.array(
    z.object({
      artistId: z.number(),
      artistName: z.string(),
      trackViewUrl: z.string(),
      trackName: z.string(),
      collectionName: z.string(),
      collectionCensoredName: z.string().optional(),
      artworkUrl100: z.string().optional(),
      censoredTrackName: z.string().optional(),
    }),
  ),
});

export const deezerResponseShape = z.object({
  data: z.array(
    z.object({
      title: z.string(),
      link: z.string(),
      artist: z.object({
        name: z.string(),
      }),
      album: z.object({
        title: z.string(),
        cover_big: z.string().optional(),
        cover_xl: z.string().optional(),
      }),
    }),
  ),
});

export const mBSearchResponseShape = z.object({
  created: z.coerce.date(),
  count: z.number(),
  offset: z.number(),
  artists: z.array(
    z.object({
      id: z.string(),
      type: z.string().optional(),
      "type-id": z.string().optional(),
      score: z.number().optional(),
      name: z.string().optional(),
    }),
  ),
});

export const lFmArtistResponseShape = z.object({
  artist: z.object({
    name: z.string(),
    mbid: z.string(),
    url: z.string(),
    image: z.array(z.object({ "#text": z.string(), size: z.string() })),
    streamable: z.string(),
    ontour: z.string(),
    stats: z.object({ listeners: z.string(), playcount: z.string() }),
    similar: z.object({
      artist: z.array(
        z.object({
          name: z.string(),
          url: z.string(),
          image: z.array(z.object({ "#text": z.string(), size: z.string() })),
        }),
      ),
    }),
    tags: z.object({
      tag: z.array(z.object({ name: z.string(), url: z.string() })),
    }),
    bio: z.object({
      links: z.object({
        link: z.object({
          "#text": z.string(),
          rel: z.string(),
          href: z.string(),
        }),
      }),
      published: z.string(),
      summary: z.string(),
      content: z.string(),
    }),
  }),
});

export function songView(songlink: SongLink, preferredApi: Song, albumName?: string) {
  const components = [
    new ContainerBuilder().addSectionComponents(
      new SectionBuilder()
        .setThumbnailAccessory(new ThumbnailBuilder().setURL(preferredApi.thumbnailUrl))
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `# ${escapeMarkdown(preferredApi.artist)} - ${escapeMarkdown(preferredApi.title)}
${albumName ? `from ${albumName}` : ""}`,
          ),
        ),
    ),
  ];
  const links = Object.keys(songlink.linksByPlatform);

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (const link of links) {
    if (currentRow.components.length >= 4) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
    currentRow.addComponents(
      new ButtonBuilder()
        .setURL(songlink.linksByPlatform[link].url)
        .setLabel(kyzaify(link))
        .setStyle(ButtonStyle.Link),
    );
  }
  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }
  components[0].addActionRowComponents(rows);
  return components;
}

export const musicCache: Record<
  string,
  {
    preferredApi: Song;
    songlink: SongLink;
  }
> = {};

export type MusicUser = {
  username: string;
  useLastFM: boolean;
  nowplayingView?: string | null;
};

export async function resolveMusicUser(
  interaction: ChatInputCommandInteraction,
  prisma: PrismaClient,
): Promise<MusicUser | null> {
  const otherUser = interaction.options.getUser("discord_user");

  if (otherUser) {
    const entry = await prisma.user.findFirst({
      where: { id: otherUser.id },
    });
    if (!entry?.musicUsername) {
      throw new Error(`${otherUser.username} doesn't have a music account saved`);
    }
    return {
      username: entry.musicUsername,
      useLastFM: !entry.musicUsesListenbrainz,
      nowplayingView: entry.nowplayingView,
    };
  }

  const entry = await prisma.user.findFirst({
    where: { id: interaction.user.id },
  });
  const user = interaction.options.getString("user");
  const useLastFMOption = interaction.options.getString("platform");

  if (entry?.musicUsername) {
    return {
      username: user ?? entry.musicUsername,
      useLastFM:
        useLastFMOption !== null ? useLastFMOption === "lastfm" : !entry.musicUsesListenbrainz,
      nowplayingView: entry.nowplayingView,
    };
  }

  if (user === null || useLastFMOption === null) {
    throw new Error(
      "you don't have a music account saved. use the `/config nowplaying` command to save them, or specify them as arguments to only use once",
    );
  }

  return { username: user, useLastFM: useLastFMOption === "lastfm" };
}

export type MusicSearchResult = {
  link: string;
  albumName: string;
  artworkUrl?: string;
  artworkIsLowQuality: boolean;
};

const searchPlatformCache = new Map<string, { at: number; data: MusicSearchResult | null }>();
const searchPlatformCacheTtl = 60 * 60 * 1000;

export async function searchMusicPlatforms(
  title: string,
  artist?: string,
): Promise<MusicSearchResult | null> {
  const cacheKey = `${artist ?? ""}::${title}`.toLowerCase();
  const cached = searchPlatformCache.get(cacheKey);
  if (cached && Date.now() - cached.at < searchPlatformCacheTtl) return cached.data;

  const deezerParams = artist
    ? {
        q: `artist:"${artist}" track:"${title}"`,
      }
    : {
        q: title,
      };
  const deezerInfo = deezerResponseShape.safeParse(
    await httpJson(`https://api.deezer.com/search?${new URLSearchParams(deezerParams).toString()}`),
  ).data?.data;

  let result: MusicSearchResult | null = null;

  if (Array.isArray(deezerInfo) && deezerInfo[0]) {
    const track =
      deezerInfo.find((res) => res.title === title) ||
      deezerInfo.find((res) => res.title.toLowerCase() === title.toLowerCase()) ||
      deezerInfo[0];

    const cleanedAlbum = track.album.title.replace(/ - (?:Single|EP)$/, "");
    result = {
      link: track.link,
      albumName: cleanedAlbum !== title ? cleanedAlbum : "",
      artworkUrl: track.album.cover_xl || track.album.cover_big,
      artworkIsLowQuality: false,
    };
  } else {
    const iTunesInfo = itunesResponseShape.safeParse(
      await httpJson(
        `https://itunes.apple.com/search?${new URLSearchParams({ entity: "song", term: `${artist || ""} ${title}`.trim() }).toString()}`,
      ),
    ).data?.results;

    if (Array.isArray(iTunesInfo) && iTunesInfo[0]) {
      const track =
        iTunesInfo.find((res) => res.trackName === title) ||
        iTunesInfo.find((res) => res.trackName.toLowerCase() === title.toLowerCase()) ||
        iTunesInfo[0];

      const cleanedAlbum = track.collectionName.replace(/ - (?:Single|EP)$/, "");
      result = {
        link: track.trackViewUrl,
        albumName: cleanedAlbum !== title ? cleanedAlbum : "",
        artworkUrl: track.artworkUrl100?.replace(/100x100bb\.jpg$/, "1200x1200bb.jpg"),
        artworkIsLowQuality: false,
      };
    }
  }

  searchPlatformCache.set(cacheKey, { at: Date.now(), data: result });
  return result;
}

export async function lobotomizedSongButton(
  interaction: ButtonInteraction,
  _config: Config,
): Promise<void> {
  let link = interaction.customId;
  if (!link) {
    await interaction.reply({
      content: "unexpected error; please try again shortly",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  let songlink, preferredApi;
  if (musicCache[link]) {
    preferredApi = musicCache[link].preferredApi;
    songlink = musicCache[link].songlink;
  } else {
    songlink = await httpJson(`https://api.song.link/v1-alpha.1/links?url=${link}`);
    preferredApi = getSongOnPreferredProvider(songlink, link);
  }

  if (preferredApi) {
    const components = songView(songlink, preferredApi);
    await interaction.reply({
      components,
      flags: [MessageFlags.IsComponentsV2, MessageFlags.Ephemeral],
    });
  } else {
    await interaction.reply({
      content: "how",
      flags: [MessageFlags.Ephemeral],
    });
  }
}

export function kyzaify(input: string): string {
  //im gonna write this as shittily as possible just because.
  if (input === "youtube") {
    return "YouTube";
  } else if (input === "youtubeMusic") {
    return "YouTube Music";
  } else if (input === "itunes") {
    return "iTunes";
  } else if (input === "soundcloud") {
    return "SoundCloud";
  }
  if (input.length === 0) return input;

  let result = input.charAt(0).toUpperCase();

  for (let i = 1; i < input.length; i++) {
    const char = input.charAt(i);

    if (char === char.toUpperCase()) {
      result += " " + char;
    } else {
      result += char;
    }
  }

  return result;
}

export type ResolvedTrack = {
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  coverIsHighQuality: boolean;
};

const resolvedTrackCache = {} as Record<string, ResolvedTrack>;
const resolvedTrackCacheTTL = 60 * 60 * 1000;

function linkProvider(link: string): string | null {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "open.spotify.com") return "spotify";
    if (host === "music.youtube.com") return "youtubeMusic";
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") return "youtube";
    if (host === "music.apple.com" || host === "itunes.apple.com") return "appleMusic";
    if (host === "deezer.com" || host === "deezer.page.link") return "deezer";
    if (host === "soundcloud.com" || host === "snd.sc") return "soundcloud";
    return null;
  } catch {
    return null;
  }
}

export function songLinkLabel(link: string): string {
  switch (linkProvider(link)) {
    case "spotify":
      return "Spotify";
    case "youtubeMusic":
      return "YouTube Music";
    case "youtube":
      return "YouTube";
    case "appleMusic":
      return "Apple Music";
    case "deezer":
      return "Deezer";
    case "soundcloud":
      return "SoundCloud";
    default:
      return "link";
  }
}

async function followRedirects(link: string): Promise<string> {
  const host = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "deezer.page.link" && host !== "snd.sc") return link;
  try {
    const res = await http.raw(link, { method: "HEAD", timeout: 5_000 });
    if (res.url && res.url !== link) return res.url;
  } catch {}
  return link;
}

async function resolveSpotify(link: string): Promise<ResolvedTrack | null> {
  const id = new URL(link).pathname.match(/\/track\/([A-Za-z0-9]+)/)?.[1];
  if (!id) return null;
  const [oembed] = await tryCatch(
    httpJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`),
  );
  if (!oembed?.thumbnail_url) return null;
  const coverUrl = oembed.thumbnail_url.includes("/ab67616d00001e02")
    ? oembed.thumbnail_url.replace("/ab67616d00001e02", "/ab67616d0000b273")
    : oembed.thumbnail_url;
  return { title: oembed.title, coverUrl, coverIsHighQuality: true };
}

function extractYouTubeId(link: string): string | null {
  const url = new URL(link);
  if (url.hostname.replace(/^www\./, "").toLowerCase() === "youtu.be") {
    return url.pathname.slice(1) || null;
  }
  return url.searchParams.get("v");
}

async function resolveYouTube(link: string): Promise<ResolvedTrack | null> {
  const id = extractYouTubeId(link);
  if (!id) return null;
  const maxresExists = await http
    .raw(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, { method: "HEAD" })
    .then((res) => res.ok)
    .catch(() => false);
  const [oembed] = await tryCatch(
    httpJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(link)}&format=json`),
  );
  return {
    title: oembed?.title,
    artist: oembed?.author_name,
    coverUrl: maxresExists
      ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
      : oembed?.thumbnail_url,
    coverIsHighQuality: maxresExists,
  };
}

async function resolveAppleMusic(link: string): Promise<ResolvedTrack | null> {
  const url = new URL(link);
  const trackId = url.searchParams.get("i") ?? url.pathname.split("/").pop();
  if (!trackId || !/^\d+$/.test(trackId)) return null;
  const [lookup] = await tryCatch(httpJson(`https://itunes.apple.com/lookup?id=${trackId}`));
  const track = lookup?.results?.[0];
  if (!track || track.kind !== "song") return null;
  const coverUrl = track.artworkUrl100?.replace(/100x100bb\.jpg$/, "1200x1200bb.jpg");
  return {
    title: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    coverUrl,
    coverIsHighQuality: !!coverUrl,
  };
}

async function resolveDeezer(link: string): Promise<ResolvedTrack | null> {
  const url = new URL(await followRedirects(link));
  const id = url.pathname.match(/\/track\/(\d+)/)?.[1];
  if (!id) return null;
  const [track] = await tryCatch(httpJson(`https://api.deezer.com/track/${id}`));
  if (!track?.id) return null;
  return {
    title: track.title,
    artist: track.artist?.name,
    album: track.album?.title,
    coverUrl: track.album?.cover_xl,
    coverIsHighQuality: true,
  };
}

async function resolveSoundCloud(link: string): Promise<ResolvedTrack | null> {
  const url = await followRedirects(link);
  if (!/soundcloud\.com/.test(url)) return null;
  const [oembed] = await tryCatch(
    httpJson(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`),
  );
  if (!oembed?.thumbnail_url) return null;
  const artist = oembed.author_name;
  const title =
    artist && oembed.title?.endsWith(` by ${artist}`)
      ? oembed.title.slice(0, -` by ${artist}`.length)
      : oembed.title;
  return {
    title,
    artist,
    coverUrl: oembed.thumbnail_url,
    coverIsHighQuality: oembed.thumbnail_url.includes("t500x500"),
  };
}

async function resolveTrackFromLinkUncached(link: string): Promise<ResolvedTrack | null> {
  switch (linkProvider(link)) {
    case "spotify":
      return resolveSpotify(link);
    case "youtube":
    case "youtubeMusic":
      return resolveYouTube(link);
    case "appleMusic":
      return resolveAppleMusic(link);
    case "deezer":
      return resolveDeezer(link);
    case "soundcloud":
      return resolveSoundCloud(link);
    default:
      return null;
  }
}

export async function resolveTrackFromLink(link: string): Promise<ResolvedTrack | null> {
  const cached = resolvedTrackCache[link];
  if (cached) return cached;
  const resolved = await resolveTrackFromLinkUncached(link);

  if (resolved) resolvedTrackCache[link] = resolved;
  setTimeout(() => delete resolvedTrackCache[link], resolvedTrackCacheTTL);
  return resolved;
}

const coverArtPlaceholder = await loadImage("https://files.keisan.trashcod.ing/placeholder.png");

const minWaveOffset = 15;
function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  colors: { left: string; mid1: string; mid2: string; right: string },
  trackName?: string,
  waveMultiplier: number = 1,
): CanvasRenderingContext2D {
  const glowConfig = {
    amount: 20,
    color: "rgba(0, 0, 0, 0.7)",
    offsetX: 10,
    offsetY: 0,
  };
  const waveOffsetScale = 75 * waveMultiplier;

  const randomNumber = trackName ? numberFaggtory(trackName) : () => 0;
  const randomOffset = () => {
    const sign = randomNumber() > 0.5 ? 1 : -1;
    const mid = (waveOffsetScale + minWaveOffset) / 2;
    const spread = (waveOffsetScale - minWaveOffset) / 2;
    const triangle = (randomNumber() - 0.5) * spread;

    return Math.floor((mid + triangle) * sign);
  };
  const waves = [
    {
      color: colors.mid2,
      baseX: 0.72,
      intensity: 90 * (randomNumber() + 0.5) * waveMultiplier,
      shiftTop: randomOffset(),
      shiftMid: randomOffset(),
      shiftBot: randomOffset(),
    },
    {
      color: colors.mid1,
      baseX: 0.48,
      intensity: 120 * (randomNumber() + 0.5) * waveMultiplier,
      shiftTop: randomOffset(),
      shiftMid: randomOffset(),
      shiftBot: randomOffset(),
    },
    {
      color: colors.left,
      baseX: 0.28,
      intensity: 85 * (randomNumber() + 0.5) * waveMultiplier,
      shiftTop: randomOffset(),
      shiftMid: randomOffset(),
      shiftBot: randomOffset(),
    },
  ];

  ctx.shadowBlur = 0;
  ctx.fillStyle = colors.right;
  ctx.fillRect(0, 0, w, h);

  waves.forEach((wave) => {
    ctx.beginPath();

    ctx.moveTo(0, 0);

    const topX = w * wave.baseX + wave.shiftTop;
    const startX = topX;
    const startY = 0;
    const midX = w * wave.baseX + wave.shiftMid;
    const midY = h * 0.5;
    const endX = w * wave.baseX + wave.shiftBot;
    const endY = h;

    ctx.lineTo(topX, 0);
    ctx.bezierCurveTo(
      startX + wave.intensity,
      startY + h * 0.2,
      midX - wave.intensity,
      midY - h * 0.2,
      midX,
      midY,
    );
    ctx.bezierCurveTo(
      midX + wave.intensity,
      midY + h * 0.2,
      endX - wave.intensity,
      endY - h * 0.2,
      endX,
      endY,
    );
    ctx.lineTo(0, h);
    ctx.closePath();

    ctx.shadowBlur = glowConfig.amount;
    ctx.shadowColor = glowConfig.color;
    ctx.shadowOffsetX = glowConfig.offsetX;
    ctx.shadowOffsetY = glowConfig.offsetY;

    ctx.fillStyle = wave.color;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  });

  return ctx;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
}

function getSaturation(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

function getLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));
  return rgbToHex(r, g, b);
}

function generateGradient({ base, primary }: { base: string; primary: string }) {
  return {
    left: base,
    mid1: interpolateColor(base, primary, 0.33),
    mid2: interpolateColor(base, primary, 0.66),
    right: primary,
  };
}

const baseColors = generateGradient({
  base: "#2B2B2B",
  primary: "#C46A9A",
});

async function extractPalette(buffer: Buffer): Promise<{ primary: string; base: string }> {
  try {
    const { data, info } = await sharp(buffer)
      .resize(32, 32, { fit: "cover" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let r = 0,
      g = 0,
      b = 0,
      count = 0;
    let lr = 0,
      lg = 0,
      lb = 0,
      lCount = 0;
    let mutedLuminanceSum = 0,
      mutedCount = 0;
    const pixelCount = info.width * info.height;
    const channels = info.channels;

    for (let i = 0; i < pixelCount; i++) {
      const offset = i * channels;
      const pr = data[offset];
      const pg = data[offset + 1];
      const pb = data[offset + 2];

      // Simple saturation/luminance calculation
      const max = Math.max(pr, pg, pb);
      const min = Math.min(pr, pg, pb);
      const l = (max + min) / 2;
      const s =
        max === min ? 0 : l > 127 ? (max - min) / (255 - (max - min)) : (max - min) / (max + min);

      // Accumulate vibrant pixels for Primary Color
      if (s > 0.3 && l > 40 && l < 215) {
        r += pr;
        g += pg;
        b += pb;
        count++;
      }

      // Accumulate light pixels for fallback Primary Color (for B&W images)
      if (l > 100) {
        lr += pr;
        lg += pg;
        lb += pb;
        lCount++;
      }

      // Accumulate muted pixels for Base Color (low saturation)
      if (s < 0.15) {
        mutedLuminanceSum += l;
        mutedCount++;
      }
    }

    // Determine Primary Color
    let primary = baseColors.right;
    if (count >= 5) {
      primary = rgbToHex(Math.round(r / count), Math.round(g / count), Math.round(b / count));
    } else if (lCount > 0) {
      primary = rgbToHex(Math.round(lr / lCount), Math.round(lg / lCount), Math.round(lb / lCount));
    }

    // Determine Base Gray based on muted brightness
    let base = baseColors.left;
    if (mutedCount > 0) {
      const avgLuminance = mutedLuminanceSum / mutedCount;
      // Map 0-255 luminance to approx 15-80 range for background
      // Formula: (avgLuminance / 255) * (max - min) + min
      const targetLuminance = Math.round((avgLuminance / 255) * (80 - 15) + 15);
      base = rgbToHex(targetLuminance, targetLuminance, targetLuminance);
    }

    return { primary, base };
  } catch {
    return { primary: baseColors.right, base: baseColors.left };
  }
}

export async function generateNowplayingImage(
  historyItem: HistoryItem,
  imageLink: string | undefined,
): Promise<Buffer<ArrayBufferLike>> {
  const fontsPath = fromPublic("fonts", "Nunito");
  if (!GlobalFonts.has("Nunito")) {
    GlobalFonts.loadFontsFromDir(fontsPath);
  }
  const jpFontPath = fromPublic("fonts", "ZenMaruGothic.ttf");
  if (!GlobalFonts.has("ZenMaruGothic")) {
    GlobalFonts.registerFromPath(jpFontPath, "ZenMaruGothic");
  }

  const width = 1200,
    height = 480,
    padding = 60,
    imgSize = height - padding * 2;

  let colors = { ...baseColors };
  let textColor = interpolateColor(colors.right, "#FFFFFF", 0.85);
  let imageBuffer: Buffer | undefined;

  if (imageLink) {
    try {
      imageBuffer = await httpBuffer(imageLink);
      const { primary, base } = await extractPalette(imageBuffer);

      colors = generateGradient({ base, primary });
      textColor = interpolateColor(primary, "#FFFFFF", 0.85);
    } catch {}
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const minSaturation = 0.3,
    maxSaturation = 0.8; // dont change, needed to keep an equal range 0.75-1.25
  const saturation = getSaturation(colors.right);
  const clampedSaturation = Math.min(maxSaturation, Math.max(minSaturation, saturation));
  const waveMultiplier = 0.75 + (clampedSaturation - minSaturation);
  drawBackground(ctx, width, height, colors, historyItem.songName, waveMultiplier);

  const fontFamily = "'Nunito', 'ZenMaruGothic', sans-serif";
  ctx.fillStyle = textColor;

  const image = imageBuffer ? await loadImage(imageBuffer) : coverArtPlaceholder;
  ctx.save();
  ctx.beginPath();
  const radius = 8;
  ctx.moveTo(padding + radius, padding);
  ctx.arcTo(padding + imgSize, padding, padding + imgSize, padding + imgSize, radius);
  ctx.arcTo(padding + imgSize, padding + imgSize, padding, padding + imgSize, radius);
  ctx.arcTo(padding, padding + imgSize, padding, padding, radius);
  ctx.arcTo(padding, padding, padding + imgSize, padding, radius);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(image, padding, padding, imgSize, imgSize);
  ctx.restore();

  ctx.font = `bold 40px ${fontFamily}`;
  const textMaxWidth = width - padding - imgSize - padding,
    textX = padding + imgSize + padding / 2;
  let heightCursor = padding + calculateTextHeight(historyItem.songName, ctx) + 10;
  const songName = wrapText(historyItem.songName, textMaxWidth, ctx, 3);
  for (const line of songName) {
    ctx.fillText(line, textX, heightCursor);
    heightCursor += 45;
  }

  ctx.font = `30px ${fontFamily}`;
  const artist = wrapText("by " + historyItem.artistName, textMaxWidth, ctx, 2);
  for (const line of artist) {
    ctx.fillText(line, textX, heightCursor);
    heightCursor += 35;
  }

  ctx.fillStyle = colors.right;
  heightCursor -= 15;
  ctx.fillRect(textX, heightCursor, 100, 4);

  if (historyItem.albumName) {
    const darkTextColor = interpolateColor(colors.left, "#000000", 0.85);
    const albumTextColor = getLuminance(colors.right) > 0.65 ? darkTextColor : textColor;
    ctx.fillStyle = albumTextColor;
    ctx.font = `italic 24px ${fontFamily}`;
    ctx.globalAlpha = 0.8;

    const albumText = "from " + historyItem.albumName;
    const albumWidth = ctx.measureText(albumText).width;
    const albumX = width - padding - albumWidth;
    const albumY = height - padding;

    if (albumX > textX) {
      ctx.fillText(albumText, albumX, albumY);
    } else {
      // If it's too long, left align it near the image bottom
      const truncatedAlbum = wrapText(albumText, textMaxWidth - padding, ctx);
      ctx.fillText(truncatedAlbum, textX, albumY);
    }
    ctx.globalAlpha = 1.0;
  }

  return canvas.toBuffer("image/png");
}
