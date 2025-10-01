import { declareCommand } from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    ContainerBuilder,
    EmbedBuilder,
    InteractionContextType,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder,
    SlashCommandUserOption,
    TextDisplayBuilder,
    type SlashCommandOptionsOnlyBuilder,
    type SlashCommandSubcommandsOnlyBuilder
} from "discord.js";
import { NO_EXTRA_CONFIG, type Config } from "../config.ts";

const categories = ["hug", "pat", "bonk", "poke", "handhold", "slap"] // as const
const tense: Record<typeof categories[number], string> = {
    hug: "$1 hugs $2",
    pat: "$1 pets $2",
    bonk: "$1 bonks $2",
    poke: "$1 pokes $2",
    handhold: "$1 holds $2's hand",
    bite: "$1 bites $2",
    slap: "$1 slaps $2"
}

let slashCommand: SlashCommandSubcommandsOnlyBuilder = new SlashCommandBuilder()
    .setName("interaction")
    .setDescription("uwaa thats so cute").setIntegrationTypes([
        ApplicationIntegrationType.UserInstall
    ])
    .setContexts([
        InteractionContextType.BotDM,
        InteractionContextType.Guild,
        InteractionContextType.PrivateChannel
    ])
for (const cat of categories) {
    slashCommand = slashCommand.addSubcommand(
        new SlashCommandSubcommandBuilder()
            .setName(cat)
            .setDescription(cat)
            .addUserOption(
                new SlashCommandUserOption()
                    .setName("user")
                    .setDescription("someone")
                    .setRequired(true)
            )
    )
}

export default declareCommand({
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        const subcommand = interaction.options.getSubcommand(true)
        const user = interaction.options.getUser("user", true)
        if (!user) {
            await interaction.reply({
                content: "who",
                flags: [MessageFlags.Ephemeral]
            })
            return
        }

        const req = await fetch(`https://api.waifu.pics/sfw/${subcommand}`)
        const res = await req.json()
        if (req.status !== 200 || !res.url) {
            await interaction.reply({
                content: "something shat itself",
                flags: [MessageFlags.Ephemeral]
            })
            return
        }

        await interaction.reply({
            components: [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent(`### ${tense[subcommand]
                                .replace("$1", interaction.user.displayName)
                                .replace("$2", user.id === interaction.user.id ? "themselves" : user.displayName)
                                }`)
                    )
                    .addMediaGalleryComponents(
                        new MediaGalleryBuilder()
                            .addItems(
                                new MediaGalleryItemBuilder()
                                    .setURL(res.url),
                            ),
                    )
                    .setAccentColor(0xFF80CE)
            ],
            flags: [MessageFlags.IsComponentsV2]
        })
    },
    dependsOn: NO_EXTRA_CONFIG,
    slashCommand,
})
