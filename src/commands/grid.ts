import { declareCommand } from "../command.ts";
import {
  ApplicationIntegrationType,
  AttachmentBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
  type BufferResolvable,
} from "discord.js";
import sharp from "sharp";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { z } from "zod";
import type Stream from "stream";
import { wrapText } from "../utils/canvas.ts";
import { http, httpJson, httpText } from "../lib/http.ts";

async function urlToDataURI(url: string) {
  const response = await http.raw(url, { responseType: "arrayBuffer" });
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

const periodChoices = [
  {
    name: "1 week",
    value: "week",
  },
  {
    name: "1 month",
    value: "month",
  },
  {
    name: "3 months",
    value: "quarter",
  },
  {
    name: "6 months",
    value: "half_yearly",
  },
  {
    name: "1 year",
    value: "year",
  },
  {
    name: "All time",
    value: "all_time",
  },
];

async function getPlayCount(
  username: string,
  useLastFM: boolean,
  apiKey?: string,
): Promise<number> {
  if (useLastFM) {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "user.getinfo");
    url.searchParams.set("user", username);
    url.searchParams.set("api_key", apiKey || "");
    url.searchParams.set("format", "json");
    let response = await httpJson<any>(url.toString());
    return response.user.playcount;
  } else {
    const url = new URL(`/1/user/${username}/listen-count`, "https://api.listenbrainz.org/");
    let response = await httpJson<any>(url.toString());
    return response.payload.count;
  }
}

async function assembleLastFmGrid(
  username: string,
  gridSize: number,
  period: string,
  apiKey?: string,
) {
  const IMAGE_SIZE = 256;
  const periodMap = {
    week: "7day",
    month: "1month",
    quarter: "3month",
    half_yearly: "6month",
    year: "12month",
    all_time: "overall",
  } as Record<string, string>;

  if (!apiKey) return;
  const url = new URL("http://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.gettopalbums");
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", apiKey || "");
  url.searchParams.set("period", periodMap[period]);
  url.searchParams.set("limit", "50");
  url.searchParams.set("format", "json");
  const res = await httpJson<any>(url.toString());
  if (!res.topalbums || !res.topalbums.album || res.topalbums.album.length === 0) {
    return;
  }

  const usefulinfo = res.topalbums.album
    .map((a: any) => ({
      artist: a.artist.name,
      name: a.name,
      image: a.image.at(-1)!["#text"],
    }))
    .filter((a: any) => a.image)
    .slice(0, gridSize ** 2);

  const canvas = createCanvas(IMAGE_SIZE * gridSize, IMAGE_SIZE * gridSize);
  const ctx = canvas.getContext("2d");

  const imagePromises = usefulinfo.map((info: { image: string }) =>
    loadImage(info.image).catch((e: unknown) => {
      console.error(`Failed to load image ${info.image}`, e);
      return loadImage("https://files.keisan.trashcod.ing/placeholder.png");
    }),
  );
  const loadedImages = await Promise.all(imagePromises);

  loadedImages.forEach((img, i: number) => {
    const x = (i % gridSize) * IMAGE_SIZE;
    const y = Math.floor(i / gridSize) * IMAGE_SIZE;
    ctx.drawImage(img, x, y, IMAGE_SIZE, IMAGE_SIZE);

    const padding = 8;
    const fontSize = 18;
    const lineHeight = fontSize * 1.2;
    const rectHeight = lineHeight * 2 + padding;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(x, y + IMAGE_SIZE - rectHeight, IMAGE_SIZE, rectHeight);

    ctx.fillStyle = "white";
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    const textX = x + padding;
    const artistY = y + IMAGE_SIZE;
    const albumY = artistY - lineHeight;

    const albumName = wrapText(usefulinfo[i].name, IMAGE_SIZE - padding * 2, ctx);
    const artistName = wrapText(usefulinfo[i].artist, IMAGE_SIZE - padding * 2, ctx);

    ctx.fillText(albumName, textX, albumY);
    ctx.fillText(artistName, textX, artistY);
  });

  return canvas.toBuffer("image/png");
}

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, config) {
    await interaction.deferReply();
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

    const GRID_SIZE = 3,
      DEFAULT_PERIOD = "week";
    const period = interaction.options.getString("period") ?? DEFAULT_PERIOD;
    const playCount = await getPlayCount(user, useLastFM, config.lastFMApiKey);

    let img: BufferResolvable | Stream | undefined = undefined;

    if (useLastFM) {
      img = await assembleLastFmGrid(user, GRID_SIZE, period, config.lastFMApiKey);
    } else {
      let svgshit = await httpText(
        `https://api.listenbrainz.org/1/art/grid-stats/${user}/${period}/${GRID_SIZE}/0/512`,
      );
      const imageUrls = [
        ...new Set(
          [...svgshit.matchAll(/<image[^>]*?(?:xlink:)?href="([^"]*)"/g)].map((match) => match[1]),
        ),
      ];

      const urlToDataUriMap = new Map<string, string>();
      await Promise.all(
        imageUrls.map(async (url) => {
          if (url && !url.startsWith("data:")) {
            try {
              const dataUri = await urlToDataURI(`${url}`);
              urlToDataUriMap.set(url, dataUri);
            } catch (e) {
              console.error(`Failed to process image ${url}:`, e);
            }
          }
        }),
      );
      svgshit = svgshit.replace(
        /(<image[^>]*?(?:xlink:)?href=")([^"]*)(")/g,
        (match: string, p1: string, url: string, p3: string) => {
          const dataUri = urlToDataUriMap.get(url);
          if (dataUri) {
            return p1 + dataUri + p3;
          }
          return match;
        },
      );
      img = sharp(Buffer.from(svgshit)).png();
    }

    if (!img) {
      await interaction.followUp({
        content: "unexpected error; please try again shortly",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    await interaction.followUp({
      files: [
        new AttachmentBuilder(img)
          .setName("hardcoremusiclistening.png")
          .setDescription(`${user} is listening so music :fire:`),
      ],
      embeds: [
        new EmbedBuilder()
          .setDescription(
            `${user}'s (${useLastFM ? "lastfm" : "listenbrainz"}) grid \
over the past ${periodChoices.find((c) => c.value === period)!.name}`,
          )
          .setImage("attachment://hardcoremusiclistening.png")
          .setColor(0xff64c5)
          .setFooter({ text: `${playCount} scrobbles` }),
      ],
    });
  },
  dependsOn: z.object({
    lastFMApiKey: z.string(),
  }),
  slashCommand: new SlashCommandBuilder()
    .setName("grid")
    .setDescription("get a cover art grid from the stats of a given user.")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addStringOption((option) =>
      option
        .setName("period")
        .setDescription("timespan of the collage")
        .setChoices(periodChoices)
        .setRequired(false),
    )
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
    ]),
});
