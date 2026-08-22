import { z } from "zod";
import { MusicBrainzApi } from "musicbrainz-api";

export const mbApi = new MusicBrainzApi({
  appName: "YourAppName",
  appVersion: "1.0.0",
});

export type HistoryItem = {
  songName: string;
  artistName: string;
  albumName?: string;
  albumArt?: string;
  link?: string;
  mbid?: string;
};

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
