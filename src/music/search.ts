import { z } from "zod";
import { httpJson } from "../lib/http.ts";

const itunesResponseShape = z.object({
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

const deezerResponseShape = z.object({
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
