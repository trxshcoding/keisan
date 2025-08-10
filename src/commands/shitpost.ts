import {
    ApplicationIntegrationType, AttachmentBuilder, type AutocompleteFocusedOption, AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";
import { declareCommand } from "../command";
import { NO_EXTRA_CONFIG } from "../config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DOWNLOAD_FOLDER_PATH = path.join(__dirname, '..', '..', 'shitposts');
export async function getFilesInFolder(folderPath: string): Promise<{ name: string, value: string }[]> {
    try {
        const files = await fs.readdir(folderPath);
        const fileList: { name: string, value: string }[] = [];

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = await fs.stat(filePath);

            if (stats.isFile()) {
                fileList.push({
                    name: file,
                    value: file
                });
            }
        }
        return fileList;
    } catch (error) {
        console.error(`Error reading directory ${folderPath}:`, error);
        return [];
    }
}
export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config) {
        await interaction.deferReply();
        const fileName = interaction.options.getString('shitpost', true);

        const filePath = path.join(DOWNLOAD_FOLDER_PATH, fileName);

        try {
            await fs.access(filePath);
            const attachment = new AttachmentBuilder(filePath, { name: fileName });
            await interaction.editReply({
                files: [attachment]
            });

        } catch (error: any) {
            if (error.code === 'ENOENT') {
                console.error(`file not found ${filePath}`, error);
                await interaction.editReply({
                    content: `\`${fileName}\`. wasnt found, aka something shat itself`,
                });
            } else {
                console.error(`Error sending file ${fileName}:`, error);
                await interaction.editReply({
                    content: `buh, shitpost (\`${fileName}\`) wasnt posted.`,
                });
            }
        }
    },
    async autoComplete(interaction: AutocompleteInteraction, config, option: AutocompleteFocusedOption): Promise<void> {
        const files = await getFilesInFolder(DOWNLOAD_FOLDER_PATH);

        const focusedValue = option.value.toLowerCase();
        const filteredFiles = files.filter(choice => choice.name.toLowerCase().includes(focusedValue));

        await interaction.respond(
            filteredFiles.slice(0, 25)
        );
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("shitpost")
        .setDescription("shitpost with the posix file system!!!!!!").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
            return option.setName("shitpost").setRequired(true).setDescription("the shitposts name")
                .setAutocomplete(true)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
