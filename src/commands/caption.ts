import {
  ActionRowBuilder,
  ApplicationCommandType,
  AttachmentBuilder,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
  Message,
  MessageFlags,
  type ModalActionRowComponentBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { ContextyalBuilder } from "../utils/discord.ts";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";

import { hash } from "crypto";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { declareCommand } from "../command.ts";
import sharp from "sharp";
import { http, httpBuffer, httpText } from "../lib/http.ts";
import { fromPublic } from "../lib/paths.ts";

const imagecache: Record<string, string> = {};
const urlRegex = /https?:\/\/\S+/gi;
const tenorRegex = /https?:\/\/tenor\.com\/view\/\S+/i;
const cum = /<link\s+rel="image_src"\s+href="([^"]+)"/;

export default declareCommand({
  targetType: ApplicationCommandType.Message,
  contextDefinition: new ContextMenuCommandBuilder()
    .setName("caption")
    .setType(ApplicationCommandType.Message),
  async run(interaction: ContextMenuCommandInteraction, target: Message): Promise<void> {
    let attachment = target.attachments.first();
    let attachmentUrl: string | undefined;

    if (attachment) {
      attachmentUrl = attachment.url;
    } else {
      const urls = target.content.match(urlRegex);
      if (urls) {
        for (const url of urls) {
          try {
            if (tenorRegex.test(url)) {
              const text = await httpText(url);
              const match = text.match(cum);
              if (match && match[1]) {
                attachmentUrl = match[1];
                break;
              }
            } else {
              const res = await http.raw(url, { method: "HEAD" });
              const contentType = res.headers.get("content-type");
              if (contentType?.startsWith("image/")) {
                attachmentUrl = url;
                break;
              }
            }
          } catch (e) {
            console.error(`Failed to process URL ${url}:`, e);
          }
        }
      }
    }

    if (!attachmentUrl) {
      await interaction.reply({
        content: "no attachments or usable image links found",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }

    const hashed = hash("md5", attachmentUrl);
    imagecache[hashed] = attachmentUrl;
    await interaction.showModal(
      new ContextyalBuilder(this.commandName)
        .setCustomId(hashed)
        .setTitle("what do you want the meme to be")
        .addComponents(
          new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("pawSize")
              .setLabel("whats the meme?")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("haha funny"),
          ),
        ),
    );
  },
  async modal(interaction: ModalSubmitInteraction, _config: Config) {
    const fontPath = fromPublic("fonts", "impact.ttf");
    if (!GlobalFonts.has("impact")) {
      GlobalFonts.registerFromPath(fontPath, "impact");
    }
    await interaction.deferReply();
    const memetext = interaction.fields.fields.get("pawSize")?.value;
    if (!memetext) {
      console.error("exit quietly and cry");
      return;
    }
    const imageUrl = imagecache[interaction.customId.replaceAll("CC:caption|", "")];
    const avatarResponse = await httpBuffer(imageUrl!);
    const imageBuffer = Buffer.from(avatarResponse);
    const metadata = await sharp(imageBuffer, { animated: true }).metadata();

    const frameCount = metadata.pages ?? 1;
    let meow = [];
    const frames = Array.from({ length: frameCount }, (_, i) => sharp(imageBuffer, { page: i }));

    for (const frame of frames) {
      const image = await loadImage(frame);
      const width = image.width;
      const height = Math.max(image.height * 1.2, image.width / 2);
      const heightDiff = height - image.height;

      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, heightDiff);

      ctx.fillStyle = "black";
      let fontSize = width / 6;
      ctx.font = `${fontSize}px impact`;
      ctx.textAlign = "center";
      let metrics = ctx.measureText(memetext);

      while (
        (metrics.width > width * 0.8 || metrics.actualBoundingBoxAscent > height * 0.2) &&
        fontSize > 1
      ) {
        fontSize--;
        ctx.font = `${fontSize}px impact`;
        metrics = ctx.measureText(memetext);
      }

      const yPos = heightDiff / 2 + metrics.actualBoundingBoxAscent / 2;
      ctx.fillText(memetext, width / 2, yPos);

      const buffer = canvas.toBuffer("image/png");
      meow.push(buffer);
    }

    const input = meow.length > 1 ? { join: { animated: true } } : undefined;

    const source = meow.length > 1 ? meow : meow[0];

    const buffer = await sharp(source, input)
      .webp({ quality: 90, effort: 1, minSize: true, loop: 0 })
      .toBuffer();

    await interaction.followUp({
      files: [new AttachmentBuilder(buffer).setName("meme.webp").setDescription(`some meme`)],
    });
  },
  dependsOn: NO_EXTRA_CONFIG,
  commandName: "caption",
});
