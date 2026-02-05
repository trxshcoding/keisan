import {
  ApplicationIntegrationType,
  AttachmentBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import { NO_EXTRA_CONFIG } from "../config.ts";
import sharp, { type SharpInput } from "sharp";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readdir } from "fs/promises";
import { declareCommand } from "../command.ts";
import { httpBuffer } from "../lib/http.ts";
import { fromPublic } from "../lib/paths.ts";
import { join } from "pathe";

const patpatGifPath = fromPublic("patpatframes");

export default declareCommand({
  async run(interaction: ChatInputCommandInteraction, _config) {
    const user = interaction.options.getUser("user", true);
    const speed = interaction.options.getInteger("speed") ?? 0;
    const avatarBuf = await httpBuffer(user.avatarURL()!);

    const frames: SharpInput[] = [];
    const frame_avatar_positions = [
      [32, 102, 73, 65],
      [32, 112, 73, 47],
    ] as const;

    let pos = 0;
    for (const framePath of await readdir(patpatGifPath)) {
      if (!framePath.endsWith(".png")) continue;
      const filePath = join(patpatGifPath, framePath);
      const patImage = await loadImage(filePath);
      const composite = createCanvas(patImage.width, patImage.height);
      const context = composite.getContext("2d");

      const [x, y, w, h] = frame_avatar_positions[pos++];
      const squishedAvatar = await loadImage(
        await sharp(avatarBuf)
          .resize(w, h, {
            fit: "fill",
          })
          .png()
          .toBuffer(),
      );

      context.save();
      context.beginPath();
      context.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      context.clip();
      context.drawImage(squishedAvatar, x, y);
      context.restore();

      context.drawImage(patImage, 0, 0);
      frames.push(composite.toBuffer("image/png"));
    }
    const delays = Array.from({ length: pos }, () => 200 - speed);
    const webP = await sharp(frames, { join: { animated: true } })
      .webp({ delay: delays, loop: 0 })
      .toBuffer();

    await interaction.reply({
      content: `Patting ${user.displayName}`,
      files: [
        new AttachmentBuilder(webP)
          .setName("softcorepattingaction.webp")
          .setDescription(`the ${user.displayName} is being gently patted`),
      ],
    });
  },
  dependsOn: NO_EXTRA_CONFIG,
  slashCommand: new SlashCommandBuilder()
    .setName("pat")
    .setDescription("Pats someone!")
    .setIntegrationTypes([ApplicationIntegrationType.UserInstall])
    .addUserOption((builder) =>
      builder.setName("user").setDescription("The one to plap").setRequired(true),
    )
    .addIntegerOption((builder) =>
      builder
        .setName("speed")
        .setDescription("speed (higher is faster, max is 200)")
        .setRequired(false),
    )
    .setContexts([
      InteractionContextType.BotDM,
      InteractionContextType.Guild,
      InteractionContextType.PrivateChannel,
    ]),
});
