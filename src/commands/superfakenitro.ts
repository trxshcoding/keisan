import {Command} from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType, REST, Routes,
    SlashCommandBuilder
} from "discord.js";
import {config, Config} from "../config.ts";

export default class SuperFakeNitroCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        const emojiname = interaction.options.getString("emoji");
        const rest = new REST().setToken(config.token);
        const data = await rest.get(
            Routes.applicationEmojis(config.applicationid)
        );
        // @ts-ignore
        const shit = data.items
        const theemoji = shit.find((item: any) => item.name === emojiname);
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

    slashCommand = new SlashCommandBuilder()
        .setName("superfakenitro")
        .setDescription("yeahh").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addStringOption(option => {
            return option.setName("emoji").setRequired(true).setDescription("the emojis name")
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
