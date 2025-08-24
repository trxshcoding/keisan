import {
    ApplicationIntegrationType, AttachmentBuilder, type AutocompleteFocusedOption, AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "url";
import { declareCommand } from "../command.ts";
import { NO_EXTRA_CONFIG } from "../config.ts";

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
        const user = (await config.prisma.user.findFirst({
            where: {
                id: interaction.user.id
            },
            include: {
                shitposts: true
            }
        }));
        if (!user) {
            return;
        }
        const shitpostwewant = user.shitposts.find((a: { name: string; }) => {
            return a.name === fileName
        })
        if (!shitpostwewant)
            return;
        const attachment = new AttachmentBuilder(Buffer.from(shitpostwewant.content), { name: fileName });
        await interaction.editReply({
            files: [attachment]
        });
    },
    async autoComplete(interaction: AutocompleteInteraction, config, option: AutocompleteFocusedOption): Promise<void> {
        const focusedValue = option.value.toLowerCase();
        const user = (await config.prisma.user.findFirst({
            where: {
                id: interaction.user.id
            },
            include: {
                shitposts: true
            }
        }));
        if (!user) {
            return;
        }
        const posts = user.shitposts
        const filteredFiles = posts
            .filter(choice => choice.name.toLowerCase().includes(focusedValue))
            .map(a=> {
                return {
                    name: a.name,
                    value: a.name
                }
            });

        await interaction.respond(
            filteredFiles,
        );
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("shitpost")
        .setDescription("shitpost with sqlite!!!!!!").setIntegrationTypes([
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
