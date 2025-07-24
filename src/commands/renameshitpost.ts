import {Command} from "../command.ts";
import {
    ApplicationIntegrationType, type AutocompleteFocusedOption, AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { config, type Config } from "../config.ts";
import {DOWNLOAD_FOLDER_PATH, getFilesInFolder} from "./shitpost.ts";
import fs from "node:fs";
import path from "node:path";

export default class RenameshitpostCommand extends Command {

    async run(interaction: ChatInputCommandInteraction, config: Config, ) {
        await interaction.deferReply();
        const originalname = interaction.options.getString("originalname")!;
        const newname = interaction.options.getString("newname")!;

        fs.renameSync(path.join(DOWNLOAD_FOLDER_PATH, originalname), path.join(DOWNLOAD_FOLDER_PATH, newname));
        await interaction.followUp("shitpost renamed.")
    }

    async autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption): Promise<void> {
        if (option.name === 'originalname') {
            const files = await getFilesInFolder(DOWNLOAD_FOLDER_PATH);

            const focusedValue = option.value.toLowerCase();
            const filteredFiles = files.filter(choice => choice.name.toLowerCase().includes(focusedValue));

            await interaction.respond(
                filteredFiles.slice(0, 25)
            );
        }
    }
    slashCommand = new SlashCommandBuilder()
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
        ]);
}
