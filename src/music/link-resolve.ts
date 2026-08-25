import { tryCatch } from "../utils/general.ts";
import { http, httpJson } from "../lib/http.ts";

export type ResolvedTrack = {
  title?: string;
  artist?: string;
  album?: string;
  coverUrl?: string;
  coverIsHighQuality: boolean;
};

const resolvedTrackCache = {} as Record<string, ResolvedTrack>;
const resolvedTrackCacheTTL = 60 * 60 * 1000;

type Providers =
  | "spotify"
  | "youtubeMusic"
  | "youtube"
  | "appleMusic"
  | "tidal"
  | "deezer"
  | "soundcloud";

function linkProvider(link: string): Providers | null {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "open.spotify.com") return "spotify";
    if (host === "music.youtube.com") return "youtubeMusic";
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") return "youtube";
    if (host === "music.apple.com" || host === "itunes.apple.com") return "appleMusic";
    if (host === "tidal.com") return "tidal";
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
    case "tidal":
      return "TIDAL";
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
