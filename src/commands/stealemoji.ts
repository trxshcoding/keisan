import {Command} from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType, Routes,
    SlashCommandBuilder
} from "discord.js";
import {type Config} from "../config.ts";


export default class StealEmojiCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply();
        const emoji = interaction.options.getString("emoji")!;
        const emojiname = interaction.options.getString("emojiname")!;
        interaction.client.application.emojis.create({
            attachment: emoji,
            name: emojiname,
        }).then(emoji => interaction.followUp(`Created new emoji with name ${emoji.name}`))
            .catch(console.error);
    }

    slashCommand = new SlashCommandBuilder()
        .setName("stealemoji")
        .setDescription("steal the emojer")
        .addStringOption(option => option.setName("emojiname").setRequired(true).setDescription("emoji name"))
        .addStringOption(option => option.setName("emoji").setRequired(true).setDescription("emoji link"))
        .setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
