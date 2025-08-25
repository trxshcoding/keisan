import {
    ApplicationIntegrationType, type AutocompleteFocusedOption, AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType, MessageFlags,
    SlashCommandBuilder
} from "discord.js";
import { config, NO_EXTRA_CONFIG, type Config } from "../config.ts";
import fs from "node:fs";
import path from "node:path";
import { declareCommand } from "../command.ts";

export default declareCommand({

    async run(interaction: ChatInputCommandInteraction, config) {
        await interaction.deferReply();
        const originalname = interaction.options.getString("originalname")!;
        const newname = interaction.options.getString("newname")!;
        const shitpostWeWannaChange = await config.prisma.shitpost.findFirst({
            where:{
                name: originalname
            }
        })
        if (shitpostWeWannaChange === null) {
            await interaction.followUp({
                content: "shitpost not found",
                flags: [MessageFlags.Ephemeral]
            })
            return;
        }
        await config.prisma.shitpost.update({
            where: {
                id: shitpostWeWannaChange.id
            },
            data: {
                name: newname
            }
        })
        await interaction.followUp({
            content: "shitpost renamed",
            flags: [MessageFlags.Ephemeral]
        })
    },
    async autoComplete(interaction: AutocompleteInteraction, config, option: AutocompleteFocusedOption): Promise<void> {
        if (option.name === 'originalname') {
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
        }
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("renameshitpost")
        .setDescription("rename the shitpost").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
            return option.setName("originalname").setRequired(true).setDescription("the original shitpost name")
                .setAutocomplete(true)
        }).addStringOption(option => {
            return option.setName("newname").setRequired(true).setDescription("the new shitpost name")
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
