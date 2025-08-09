import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType, Routes,
    SlashCommandBuilder
} from "discord.js";
import { declareCommand } from "../command";
import { NO_EXTRA_CONFIG } from "../config";


export default declareCommand({
    async run(interaction, config) {
        await interaction.deferReply();
        const emoji = interaction.options.getString("emoji")!;
        const emojiname = interaction.options.getString("emojiname")!;
        interaction.client.application.emojis.create({
            attachment: emoji,
            name: emojiname,
        }).then(emoji => interaction.followUp(`Created new emoji with name ${emoji.name}`))
            .catch(console.error);
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
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
        ]),
})