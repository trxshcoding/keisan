import {Command} from "../command.ts";
import {
    ActionRowBuilder,
    ApplicationIntegrationType, ButtonBuilder, ButtonStyle,
    ChatInputCommandInteraction, EmbedBuilder,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config) {
        const repo = interaction.options.getString("repo")
        const meow = await fetch(config.gitapi + repo).then(res => res.json());
        const embed = new EmbedBuilder()
            .setAuthor({
                name: meow.name,
            })
            .setTitle(meow.description)
            .setImage(meow.owner.avatar_url);
        const nya = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setURL(meow.html_url).setLabel("link").setStyle(ButtonStyle.Link))
        await interaction.reply({
            components: [
                nya
            ],
            embeds: [embed],
        });
    }

    slashCommand = new SlashCommandBuilder()
        .setName("src")
        .setDescription("get src of shit").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
            return option.setName("repo").setDescription("name").setRequired(true);
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}