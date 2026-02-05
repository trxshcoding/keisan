import {
  type ChatInputCommandInteraction,
  type Client,
  ModalBuilder,
  SlashCommandBuilder,
} from "discord.js";
import type { Results } from "linguist-js/dist/types";
import { MusicBrainzApi } from "musicbrainz-api";
import { createHash, hash } from "crypto";
import sharp from "sharp";
import { createCanvas, type CanvasRenderingContext2D } from "@napi-rs/canvas";
import { httpBuffer, httpJson } from "./lib/http.ts";

export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const b: T[][] = [];
  array.forEach((element) =>
    b && b[b.length - 1] && b[b.length - 1].length < chunkSize
      ? b[b.length - 1].push(element)
      : b.push([element]),
  );
  return b;
}

export function trimWhitespace(input: string): string;
export function trimWhitespace(input: string[]): string[];

export function trimWhitespace(input: string | string[]) {
  return Array.isArray(input) ? input.map((s) => s.trim()) : input.trim();
}

export class AmyodalBuilder extends ModalBuilder {
  private command: SlashCommandBuilder;

  constructor(command: SlashCommandBuilder) {
    super();
    this.command = command;
  }

  setCustomId(customId: string): this {
    this.data.custom_id = `${this.command.name}|${customId}`;
    return this;
  }
}

export class ContextyalBuilder extends ModalBuilder {
  private command: string;

  constructor(command: string) {
    super();
    this.command = command;
  }

  setCustomId(customId: string): this {
    this.data.custom_id = `CC:${this.command}|${customId}`;
    return this;
  }
}

export function getTop3Languages(result: Results) {
  let maxBytes = 0;
  Object.keys(result.languages.results).forEach((language) => {
    maxBytes += result.languages.results[language].bytes;
  });
  const newArray = Object.entries(result.languages.results)
    .map(([k, v]) => ({
      ...v,
      language: k,
      percentage: Number(((v.bytes / maxBytes) * 100).toFixed(2)),
    }))
    .filter((lang) => lang.type === "programming");
  newArray.sort((a, b) => b.bytes - a.bytes);
  newArray.length = 3;
  return newArray;
}

export function escapeMarkdown(content: string) {
  return content.replace(/([#*_~`|])/g, "\\$1");
}

export const mbApi = new MusicBrainzApi({
  appName: "YourAppName",
  appVersion: "1.0.0",
});

export function imageBullshittery(username: string) {
  const p = 2;
  const canvas = createCanvas(p * 7, p * 7);
  const context = canvas.getContext("2d");

  const xorshift32 = (n: number) => {
    n ^= n << 13;
    n ^= n >>> 17;
    n ^= n << 5;
    return n;
  };

  const seedSteps = 28;

  let seed = 1;
  for (let i = seedSteps + username.length - 1; i >= seedSteps; i--) {
    seed = xorshift32(seed);
    seed += username.charCodeAt(i - seedSteps);
  }

  context.fillStyle = "#" + ((seed >> 8) & 0xffffff).toString(16).padStart(0, "6");

  for (let i = seedSteps - 1; i > 0; i--) {
    // continue the seed
    seed = xorshift32(seed);

    const X = i & 3;
    const Y = i >> 2;

    if (seed >>> (seedSteps + 1) > (X * X) / 3 + Y / 2) {
      context.fillRect(p * 3 + p * X, p * Y, p, p);
      context.fillRect(p * 3 - p * X, p * Y, p, p);
    }
  }
  return canvas.toBuffer("image/png");
}

function getRandomArrayMember(arr: any[]) {
  if (arr.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * arr.length);

  return arr[randomIndex];
}

function createRandomBullshit(length: number) {
  let bullshit = "";
  const bullshitChars = "qwertyuiopasdfghjklzxcvbnm1234567890".split("");
  for (let i = 0; i <= length; i++) {
    let temp = getRandomArrayMember(bullshitChars);
    if (Math.random() > 0.5) {
      bullshit += temp.toUpperCase();
    } else {
      bullshit += temp;
    }
  }
  return bullshit;
}

export async function getGithubAvatar(name: string, email: string) {
  let username = "";
  const isGithubEmail = email.match(/^(?:\d+\+)(.+?)@users\.noreply\.github\.com$/);
  if (isGithubEmail) username = isGithubEmail[1];
  else {
    const res = await httpJson<{ items?: Array<{ login: string }> }>(
      `https://api.github.com/search/users?q=${encodeURIComponent(name)}`,
    );
    if (res?.items?.[0]) username = res.items[0].login;
    // note: there is a "score" property on the user which im assuming is related to how good of a match it is
    // but i've also never seen it not be 1
  }
  if (username) return await httpBuffer(`https://github.com/${username}.png`);
  else return imageBullshittery(name);
}

export async function bufferToEmoji(buffer: Buffer, client: Client) {
  return client.application!.emojis.create({
    name: createRandomBullshit(12),
    attachment: buffer,
  });
}

export async function createResizedEmoji(
  interaction: ChatInputCommandInteraction,
  imageUrl: string,
) {
  try {
    const imageBuffer = await httpBuffer(imageUrl);

    let resizedImageBuffer = await sharp(imageBuffer, { animated: true })
      .resize(128, 128)
      .gif({ loop: 0 })
      .toBuffer();

    if (resizedImageBuffer.byteLength > 262144) {
      resizedImageBuffer = await sharp(imageBuffer, { animated: true })
        .resize(64, 64)
        .gif({ loop: 0 })
        .toBuffer();
    }

    if (resizedImageBuffer.byteLength > 262144) {
      resizedImageBuffer = await sharp(imageBuffer, { animated: true })
        .resize(32, 32)
        .gif({ loop: 0 })
        .toBuffer();
    }

    return await interaction.client.application.emojis.create({
      attachment: resizedImageBuffer,
      name: hash("md5", imageUrl),
    });
  } catch (error) {
    console.error("Failed to create resized emoji:", error);
    return null;
  }
}

function xoshiro128ss(a: number, b: number, c: number, d: number) {
  return function () {
    let t = b << 9,
      r = b * 5;
    r = ((r << 7) | (r >>> 25)) * 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = (d << 11) | (d >>> 21);
    return (r >>> 0) / 4294967296;
  };
}

// keeping the name's legacy
export function numberFaggtory(str: string) {
  const hash = createHash("md5").update(str).digest();
  const seeds = [] as number[];
  for (let i = 0; i < 4; i++) {
    seeds.push(hash.readUInt32BE(i * 4));
  }

  return xoshiro128ss(seeds[0], seeds[1], seeds[2], seeds[3]);
}

export function calculateTextHeight(text: string, ctx: CanvasRenderingContext2D): number {
  const size = ctx.measureText(text);
  return size.actualBoundingBoxAscent + size.actualBoundingBoxDescent;
}

export function wrapText(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
  maxLines?: 1,
): string;
export function wrapText(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
  maxLines: number,
): string[];
export function wrapText(
  text: string,
  maxWidth: number,
  ctx: CanvasRenderingContext2D,
  maxLines = 1,
): string | string[] {
  const ellipsisWidth = ctx.measureText("...").width;

  if (maxLines === 1) {
    let width = ctx.measureText(text).width;
    if (width <= maxWidth) {
      return text;
    }
    let truncatedText = text;
    let i = text.length;
    while (width >= maxWidth - ellipsisWidth && i > 0) {
      truncatedText = text.substring(0, i);
      width = ctx.measureText(truncatedText).width;
      i--;
    }
    return truncatedText + "...";
  }

  const lines: string[] = [];
  let remainingText = text;
  const minLineWidth = maxWidth * 0.5;

  for (let lineNum = 0; lineNum < maxLines && remainingText.length > 0; lineNum++) {
    const remainingWidth = ctx.measureText(remainingText).width;
    if (remainingWidth <= maxWidth) {
      lines.push(remainingText);
      remainingText = "";
      break;
    }

    const avgCharWidth = remainingWidth / remainingText.length;
    let guessIndex = Math.max(
      1,
      Math.min(Math.floor(maxWidth / avgCharWidth), remainingText.length),
    );

    let charBoundary = guessIndex;
    let charBoundaryText = remainingText.substring(0, charBoundary);
    let charBoundaryWidth = ctx.measureText(charBoundaryText).width;

    while (charBoundaryWidth > maxWidth && charBoundary > 1) {
      charBoundary--;
      charBoundaryText = remainingText.substring(0, charBoundary);
      charBoundaryWidth = ctx.measureText(charBoundaryText).width;
    }
    while (charBoundary < remainingText.length) {
      const nextText = remainingText.substring(0, charBoundary + 1);
      const nextWidth = ctx.measureText(nextText).width;
      if (nextWidth <= maxWidth) {
        charBoundary++;
        charBoundaryText = nextText;
        charBoundaryWidth = nextWidth;
      } else {
        break;
      }
    }

    let wordBoundary = charBoundary;
    while (wordBoundary > 0) {
      const char = remainingText[wordBoundary];
      const prevChar = wordBoundary > 0 ? remainingText[wordBoundary - 1] : "";

      if (char === " " || prevChar === " ") {
        const wordBoundaryText = remainingText.substring(0, wordBoundary).trimEnd();
        if (ctx.measureText(wordBoundaryText).width >= minLineWidth) {
          charBoundary = wordBoundary;
          charBoundaryText = wordBoundaryText;
          break;
        }
      }
      wordBoundary--;
    }

    let lineText = charBoundaryText.trimEnd();
    if (lineNum === maxLines - 1 && charBoundary < remainingText.length) {
      while (ctx.measureText(lineText + "...").width > maxWidth && lineText.length > 0) {
        lineText = lineText.substring(0, lineText.length - 1).trimEnd();
      }
      lines.push(lineText + "...");
      break;
    } else {
      lines.push(lineText);
    }

    remainingText = remainingText.substring(charBoundary).trimStart();
  }

  return lines;
}
