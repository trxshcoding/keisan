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
        const emojiname = interaction.options.getString("emoji");
        const data = await (interaction.client.rest.get(
            Routes.applicationEmojis(interaction.applicationId)
        ) as Promise<RESTGetAPIApplicationEmojisResult>);
        const shit = data.items
        const theemoji = shit.find((item) => item.name === emojiname)!;
        let string = "<";
        if (theemoji.animated) {
            string += `a`;
        }
        string += `:`;
        string += theemoji.name;
        string += `:`;
        string += theemoji.id;
        string += `>`;
        await interaction.reply(string);
    }

    async autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption): Promise<void> {
        if (option.name === 'emoji') {
            const search = option.value
            const data = await (interaction.client.rest.get(
                Routes.applicationEmojis(interaction.applicationId)
            ) as Promise<RESTGetAPIApplicationEmojisResult>);
            const matches = data.items.filter(item => item.name && item.name.toLowerCase().includes(search.toLowerCase()))
            interaction.respond(matches.map(emoji => ({
                name: emoji.name!,
                value: emoji.name!
            })))
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
