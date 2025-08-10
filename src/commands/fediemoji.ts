import { declareCommand } from "../command.ts";
import {
    ApplicationIntegrationType, type AutocompleteFocusedOption, AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { z } from "zod";
async function getSharkeyEmojis(config: { sharkeyInstance: string }) {
    const emojis = (await fetch("https://" + config.sharkeyInstance + "/api/emojis").then((res) => res.json()))
    const typedEmojis: Array<{ name: string, url: string }> = emojis.emojis
    return typedEmojis
}

export default declareCommand({

    async run(interaction: ChatInputCommandInteraction, config,) {
        await interaction.deferReply();
        const emojiname = interaction.options.getString("emoji");
        const shit = await interaction.client.application.emojis.fetch();
        const theEmojiInApplicationEmojis = shit.find((item) => item.name === emojiname);
        if (!theEmojiInApplicationEmojis) {
            const theEmojiWeWannaUpload = (await getSharkeyEmojis(config)).find((emoji) => emoji.name === emojiname)!;
            console.log(theEmojiWeWannaUpload)
            const emoji = await interaction.client.application.emojis.create({
                attachment: theEmojiWeWannaUpload.url,
                name: theEmojiWeWannaUpload.name,
            });
            await interaction.followUp(`${emoji}`)
            await emoji.delete()
        } else {
            await interaction.followUp(`<${theEmojiInApplicationEmojis.animated ? 'a' : ''}:${theEmojiInApplicationEmojis.name}:${theEmojiInApplicationEmojis.id}>`)
        }
    },

    async autoComplete(interaction: AutocompleteInteraction, config, option: AutocompleteFocusedOption): Promise<void> {
        if (option.name === 'emoji') {
            const search = option.value
            const emojiArray = (await getSharkeyEmojis(config)).map((i) => i.name)
            const matches = emojiArray.filter((item: string) => item && item.toLowerCase().includes(search.toLowerCase())).slice(0, 25)

            await interaction.respond(matches.map((emoji) => ({
                name: emoji!,
                value: emoji!
            })))
        }
    },
    dependsOn: z.object({
        sharkeyInstance: z.string(),
    }),
    slashCommand: new SlashCommandBuilder()
        .setName("fediemoji")
        .setDescription("Pong!").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ]).addStringOption(option => {
            return option.setName("emoji").setRequired(true).setDescription("the emojis name")
                .setAutocomplete(true)
        })
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]),
})