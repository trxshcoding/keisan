import {
    ApplicationCommandType, type Attachment,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    Message
} from "discord.js";
import { ContextCommand } from "../command.ts";
import type {Config} from "../config.ts";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Mock extends ContextCommand<Message> {
    targetType: ApplicationCommandType.Message = ApplicationCommandType.Message;
    contextDefinition: ContextMenuCommandBuilder =
        new ContextMenuCommandBuilder()
            .setName('AddToShitposts')
            .setType(ApplicationCommandType.Message)
    async run(interaction: ContextMenuCommandInteraction, target: Message, config:Config): Promise<void> {
        await interaction.deferReply();
        await interaction.followUp({content: "uploading..."});

        const downloadFolderPath = path.join(__dirname, '..', '..', 'shitposts');

        try {
            await fs.mkdir(downloadFolderPath, { recursive: true });
        } catch (error) {
            console.error("Error creating download folder:", error);
            await interaction.editReply({ content: "the fucking posix file system failed me (download foler couldnt be made)" });
            return;
        }

        if(target.attachments.size === 0){
            await interaction.editReply({ content: "there is no shit for me to post" });
            return;
        }

        for (const [_, attachment] of target.attachments) {
            const response = await fetch(attachment.url);

            if (!response.ok) {
                await interaction.editReply({ content: "discord shat itself while fetching an attachment!?" });
                return;
            }

            const buffer = await response.arrayBuffer();
            const fileName = attachment.name || `attachment_${attachment.id}`;
            const filePath = path.join(downloadFolderPath, fileName);

            try {
                await fs.writeFile(filePath, Buffer.from(buffer));
                console.log(`Downloaded: ${fileName}`);
            } catch (error) {
                console.error(`Error downloading ${fileName}:`, error);
                await interaction.editReply({ content: `Failed to download ${fileName}.` });
                return;
            }
        }
        await interaction.editReply({content: "shits have been posted!"});
    }
}