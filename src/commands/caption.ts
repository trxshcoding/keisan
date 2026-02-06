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
import { ContextyalBuilder } from "../util.ts";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";

import { hash } from "crypto";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import { declareCommand } from "../command.ts";
import sharp from "sharp";
import { httpBuffer } from "../lib/http.ts";
import { fromPublic } from "../lib/paths.ts";

const imagecache: Record<string, string> = {};

export default declareCommand({
  targetType: ApplicationCommandType.Message,
  contextDefinition: new ContextMenuCommandBuilder()
    .setName("caption")
    .setType(ApplicationCommandType.Message),
  async run(interaction: ContextMenuCommandInteraction, target: Message): Promise<void> {
    let attachment = target.attachments.first();
    if (!attachment) {
      await interaction.reply({
        content: "no attachments found",
        flags: [MessageFlags.Ephemeral],
      });
      return;
    }
    const hashed = hash("md5", attachment.url);
    imagecache[hashed] = attachment.url;
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
    const image = await loadImage(await sharp(Buffer.from(avatarResponse)).png().toBuffer());

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
    await interaction.followUp({
      files: [new AttachmentBuilder(buffer).setName("meme.png").setDescription(`some meme`)],
    });
  },
  dependsOn: NO_EXTRA_CONFIG,
  commandName: "caption",
});
