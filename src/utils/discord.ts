import {
  type ChatInputCommandInteraction,
  type Client,
  ModalBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { createRandomBullshit } from "./general.ts";
import { hash } from "crypto";
import sharp from "sharp";
import { httpBuffer } from "../lib/http.ts";

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
