import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  ContextMenuCommandInteraction,
  Message,
  MessageFlags,
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import { declareCommand } from "../command.ts";
import { httpBuffer } from "../lib/http.ts";

export default declareCommand({
  commandName: "addtoshitposts",
  dependsOn: NO_EXTRA_CONFIG,
  targetType: ApplicationCommandType.Message,
  contextDefinition: new ContextMenuCommandBuilder()
    .setName("AddToShitposts")
    .setType(ApplicationCommandType.Message),
  async run(
    interaction: ContextMenuCommandInteraction,
    target: Message,
    config: Config,
  ): Promise<void> {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    for (const [_, attachment] of target.attachments) {
      const buffer = await httpBuffer(attachment.url);
      const fileName = attachment.name || `attachment_${attachment.id}`;

      try {
        await config.prisma.user.upsert({
          where: { id: interaction.user.id },
          create: {
            id: interaction.user.id,
            shitposts: {
              create: {
                name: attachment.name,
                content: buffer,
              },
            },
          },
          update: {
            shitposts: {
              create: {
                name: attachment.name,
                content: buffer,
              },
            },
          },
        });
      } catch (error) {
        console.error(`Error downloading ${fileName}:`, error);
        await interaction.editReply({ content: `Failed to download ${fileName}.` });
        return;
      }
    }
    await interaction.editReply({ content: "shits have been posted!" });
  },
});
