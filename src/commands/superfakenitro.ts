import { Command } from "../command.ts";
import {
    ApplicationIntegrationType,
    AutocompleteFocusedOption,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType, REST, RESTGetAPIApplicationEmojisResult, Routes,
    SlashCommandBuilder
} from "discord.js";
import { config, Config } from "../config.ts";

export default class SuperFakeNitroCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        const emojiname = interaction.options.getString("emoji")!;
        const shit = await (interaction.client.application.emojis.fetch());

        const theemoji = shit.get(emojiname);
        if (!theemoji) {
            await interaction.reply("this isnt supposed to happen. how");
            return;
        }
        await interaction.reply(`${theemoji}`);
    }

    async autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption): Promise<void> {
        if (option.name === 'emoji') {
            const search = option.value
            const data = await (interaction.client.application.emojis.fetch());
            const matches = data.keys().filter(item => item && item.toLowerCase().includes(search.toLowerCase()))
            await interaction.respond([...matches.map(emoji => ({
                name: emoji,
                value: emoji
            }))])
        }
    }

    slashCommand = new SlashCommandBuilder()
        .setName("superfakenitro")
        .setDescription("yeahh").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addStringOption(option => {
            return option.setName("emoji").setRequired(true).setDescription("the emojis name")
                .setAutocomplete(true)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
