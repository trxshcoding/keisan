import {
    ApplicationCommandType, type Attachment,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    Message
} from "discord.js";
import { ContextCommand } from "../command.ts";
import {PutObjectCommand, type S3Client} from "@aws-sdk/client-s3";
import type {Config} from "../config.ts";
import {BUCKETNAME} from "./shitpost.ts";

export default class Mock extends ContextCommand<Message> {
    targetType: ApplicationCommandType.Message = ApplicationCommandType.Message;
    contextDefinition: ContextMenuCommandBuilder =
        new ContextMenuCommandBuilder()
            .setName('AddToShitposts')
            .setType(ApplicationCommandType.Message)
    async run(interaction: ContextMenuCommandInteraction, target: Message, config:Config): Promise<void> {
        await interaction.deferReply()
        await interaction.followUp({content: "uploading..."})
        for (const [_, attachment] of target.attachments) {

            const response = await fetch(attachment.proxyURL);

            if (!response.ok) {
                await interaction.reply({ content: "discord shat itself??????" });
                return;
            }

            const buffer = await response.arrayBuffer();

            const command = new PutObjectCommand({
                Bucket: BUCKETNAME,
                Key: attachment.name,
                Body: Buffer.from(buffer),
            });
            await config.s3.send(command)
        }
        await interaction.editReply({content: "shits have been posted"})
    }
}