import {
    ApplicationIntegrationType, AttachmentBuilder, type AutocompleteFocusedOption, AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "url";
import {declareCommand} from "../command.ts";
import {NO_EXTRA_CONFIG} from "../config.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        if (!shitpostwewant) {
            await interaction.editReply({
                content: "there's no shitpost with that name"
            });
            return;
        }
        const attachment = new AttachmentBuilder(Buffer.from(shitpostwewant.content), {name: fileName});
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
            .map(a => {
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
