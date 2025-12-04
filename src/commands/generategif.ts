import { declareCommand } from "../command.ts";
import {
    ApplicationIntegrationType,
    AttachmentBuilder,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";
import sharp from "sharp";
import { readFile } from "fs/promises";

type Gifs = {
    [key: string]: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
};

const gifs: Gifs = {
    is_talking: {
        "x": 100,
        "y": 10,
        "width": 75,
        "height": 75
    },
}

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply()
        const type = interaction.options.getString("type", true)
        const person = interaction.options.getUser("person", true)
        const isReversed = interaction.options.getBoolean("isreversed", false) ?? false

        const gif = gifs[type]

        const gifBuffer = await readFile(`./src/commands/gifs/${type}.webp`);
        const image = sharp(gifBuffer, { animated: true });
        const buffer = await image.toBuffer();
        const metadata = await image.metadata();

        if (!metadata.pages || !metadata.width || !metadata.pageHeight || !metadata.channels || !metadata.delay) {
            return
        }
        const frameCount = metadata.pages;

        const avatarBuffer = await (await fetch(person.displayAvatarURL({ extension: "webp", size: 512 }))).arrayBuffer()
        const resizedAvatar = await sharp(Buffer.from(avatarBuffer)).resize(gif.width, gif.height).toBuffer()

        const frames = await Promise.all(Array.from({ length: frameCount }, (_, i) =>
            sharp(buffer, { page: i }).composite([{
                input: resizedAvatar,
                top: gif.y,
                left: gif.x
            }]).toBuffer())
        )

        if (isReversed) {
            frames.reverse()
        }

        const webP = await sharp(frames, { join: { animated: true } })
            .webp({
                delay: metadata.delay,
                loop: 0
            })
            .toBuffer();

        await interaction.followUp({
            files: [
                new AttachmentBuilder(webP)
                    .setName('softcoregiffingaction.webp')
            ]
        });
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand: new SlashCommandBuilder()
        .setName("generategif")
        .setDescription("generate a gif (its actually a webp)").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .addStringOption(builder => {
            return builder.setName("type").setDescription("what typa gif you want").setRequired(true).addChoices(
                ...Object.keys(gifs).map(gif => ({ name: gif, value: gif }))
            )
        })
        .addUserOption(builder => {
            return builder.setName("person").setDescription("who do you wanna generate a gif with").setRequired(true)
        })
        .addBooleanOption(builder => {
            return builder.setName("isreversed").setDescription("reverse the gif or not").setRequired(false)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})
