import {
    ApplicationIntegrationType,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { NO_EXTRA_CONFIG } from "../config.ts";
import { declareCommand } from "../command.ts";

export default declareCommand({
    async run(interaction, config) {
        const emojiname = interaction.options.getString("emoji")!;
        const shit = await (interaction.client.application.emojis.fetch());

        const theemoji = shit.get(emojiname);
        if (!theemoji) {
            await interaction.reply("this isnt supposed to happen. how");
            return;
        }
        await interaction.reply(`${theemoji}`);
    },
    async autoComplete(interaction, config, option): Promise<void> {
        if (option.name === 'emoji') {
            const search = option.value
            const data = await (interaction.client.application.emojis.fetch());
            const matches = data.keys().filter(item => item && item.toLowerCase().includes(search.toLowerCase()))
            await interaction.respond([...matches.map(emoji => ({
                name: emoji,
                value: emoji
            }))])
        }
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
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
        ]),
})