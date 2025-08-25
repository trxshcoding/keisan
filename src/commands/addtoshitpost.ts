import {
    ApplicationCommandType, type Attachment,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    Message
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";
import { declareCommand } from "../command.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default declareCommand({
    commandName: "addtoshitposts",
    dependsOn: NO_EXTRA_CONFIG,
    targetType: ApplicationCommandType.Message,
    contextDefinition:
        new ContextMenuCommandBuilder()
            .setName('AddToShitposts')
            .setType(ApplicationCommandType.Message),
    async run(interaction: ContextMenuCommandInteraction, target: Message, config: Config): Promise<void> {
        await interaction.deferReply()
        for (const [_, attachment] of target.attachments) {
            const response = await fetch(attachment.url);

            if (!response.ok) {
                await interaction.editReply({ content: "discord shat itself while fetching an attachment!?" });
                return;
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const fileName = attachment.name || `attachment_${attachment.id}`;

            try {
                await config.prisma.user.upsert({
                    where: { id: interaction.user.id },
                    create: {
                        id: interaction.user.id,
                        shitposts: {
                            create: {
                                name: attachment.name,
                                content: buffer
                            }
                        }
                    },
                    update: {
                        shitposts: {
                            create: {
                                name: attachment.name,
                                content: buffer
                            }
                        }
                    }
                })
            } catch (error) {
                console.error(`Error downloading ${fileName}:`, error);
                await interaction.editReply({ content: `Failed to download ${fileName}.` });
                return;
            }
        }
        await interaction.editReply({ content: "shits have been posted!" });
    }
})