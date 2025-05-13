import {Command} from "../command.ts";
import {
    ApplicationIntegrationType, AttachmentBuilder, type AutocompleteFocusedOption, AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { config, type Config } from "../config.ts";
import {ListObjectsV2Command, type S3Client} from "@aws-sdk/client-s3";
import {inspect} from "node:util";

export default class ShitPostCommand extends Command {


    async run(interaction: ChatInputCommandInteraction, config: Config, s3: S3Client) {
            const shitpost = interaction.options.getString("shitpost")!;

        const shitpostUrl = "https://sp.amy.rip/" + encodeURIComponent(shitpost);

        try {
            const response = await fetch(shitpostUrl);

            if (!response.ok) {
                await interaction.reply({ content: "S3 bucket shat itself??????" });
                return;
            }

            const buffer = await response.arrayBuffer();
            const attachment = new AttachmentBuilder(Buffer.from(buffer), { name: shitpost });

            await interaction.reply({ files: [attachment] });

        } catch (error) {
            await interaction.reply({ content: "fileproccessing shat itself" });
        }
    }

    async autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption, s3: S3Client): Promise<void> {

            await interaction.respond((await s3.send(new ListObjectsV2Command({ Bucket: "shitposts" }))).Contents!
                .filter((i): i is { Key: string } => !!i.Key)
                .map(key => ({ name: key.Key, value: key.Key })))

    }
    slashCommand = new SlashCommandBuilder()
        .setName("shitpost")
        .setDescription("shitpost with S3!!!!!").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
            return option.setName("shitpost").setRequired(true).setDescription("the shitposts name")
                .setAutocomplete(true)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
