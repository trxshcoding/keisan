import {
    ActionRowBuilder,
    ApplicationCommandType, AttachmentBuilder,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    Message,
    MessageFlags,
    type ModalActionRowComponentBuilder,
    ModalBuilder,
    type ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import { ContextCommand } from "../command.ts";
import { AmyodalBuilder, ContextyalBuilder } from "../util.ts";
import type { Config } from "../config.ts";

const imagecache: Record<string, string> = {};
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { hash } from "crypto"
import { createCanvas, loadImage, registerFont } from "canvas";
import path from "node:path";
import { fileURLToPath } from "url";

export default class Caption extends ContextCommand<Message> {
    targetType: ApplicationCommandType.Message = ApplicationCommandType.Message;
    contextDefinition: ContextMenuCommandBuilder =
        new ContextMenuCommandBuilder()
            .setName('caption')
            .setType(ApplicationCommandType.Message)
    async run(interaction: ContextMenuCommandInteraction, target: Message): Promise<void> {
        let attachment = target.attachments.first();
        if (!attachment) {
            await interaction.reply({
                content: "no attachments found",
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }
        const hashed = hash("md5", attachment.url);
        imagecache[hashed] = attachment.url
        await interaction.showModal(new ContextyalBuilder(this.commandName)
            .setCustomId(hashed)
            .setTitle('what do you want the meme to be')
            .addComponents(
                new ActionRowBuilder<ModalActionRowComponentBuilder>()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId('pawSize')
                            .setLabel("whats the meme?")
                            .setStyle(TextInputStyle.Short)
                            .setPlaceholder("haha funny")
                    )
            ))
    }
    async modal(interaction: ModalSubmitInteraction, config: Config) {
        //putting this here is a bad idea
        registerFont(path.join(__dirname, '../../impact.ttf'), { family: 'impact' });
        await interaction.deferReply()
        const memetext = interaction.fields.fields.get("pawSize")?.value;
        if (!memetext) {
            console.error("exit quietly and cry")
            return;
        }
        const imageUrl = imagecache[interaction.customId.replaceAll("CC:caption|", "")]
        const image = await loadImage(imageUrl);

        const width = image.width;
        const height = Math.max(image.height * 1.2, image.width / 2)
        const heightDiff = height - image.height

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(image, 0, heightDiff);

        ctx.fillStyle = "black"
        let fontSize = width / 6;
        ctx.font = `${fontSize}px impact`;
        ctx.textAlign = "center"
        let metrics = ctx.measureText(memetext);

        while ((metrics.width > width * 0.8 || metrics.actualBoundingBoxAscent > height * 0.2) && fontSize > 1) {
            fontSize--;
            ctx.font = `${fontSize}px impact`;
            metrics = ctx.measureText(memetext);
        }

        const yPos = heightDiff / 2 + metrics.actualBoundingBoxAscent / 2;
        ctx.fillText(memetext, width / 2, yPos);

        const buffer = canvas.toBuffer('image/png');
        await interaction.followUp({
            files: [
                new AttachmentBuilder(buffer)
                    .setName('meme.png')
                    .setDescription(`some meme`),
            ],
        })
    }
    dependsOn = []
    commandName = "caption";
}