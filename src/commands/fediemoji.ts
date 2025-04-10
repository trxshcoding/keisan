import {Command} from "../command.ts";
import {
    ApplicationIntegrationType, AutocompleteFocusedOption, AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType, RESTGetAPIApplicationEmojisResult, Routes,
    SlashCommandBuilder
} from "discord.js";
import { config, Config } from "../config.ts";

export default class FediemojiCommand extends Command {
    async getSharkeyEmojis() {
        const emojis = (await fetch("https://" + config.sharkeyInstance + "/api/emojis").then((res) => res.json()))
        const typedEmojis: Array<{ name: string , url: string}> = emojis.emojis
        return typedEmojis
    }

    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply();
        const emojiname = interaction.options.getString("emoji");
        const shit = await interaction.client.application.emojis.fetch();
        const theEmojiInApplicationEmojis = shit.find((item) => item.name === emojiname);
        if (!theEmojiInApplicationEmojis) {
            const theEmojiWeWannaUpload = (await this.getSharkeyEmojis()).find((emoji) => emoji.name === emojiname)!;
            console.log(theEmojiWeWannaUpload)
            const emoji = await interaction.client.application.emojis.create({
                attachment: theEmojiWeWannaUpload.url,
                name: theEmojiWeWannaUpload.name,
            });
            await interaction.followUp(`${emoji}`)
        } else {
            await interaction.followUp(`<${theEmojiInApplicationEmojis.animated ? 'a' : ''}:${theEmojiInApplicationEmojis.name}:${theEmojiInApplicationEmojis.id}>`)
        }
    }

    async autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption): Promise<void> {
        if (option.name === 'emoji') {
            const search = option.value
            const emojiArray = (await this.getSharkeyEmojis()).map((i) => i.name)
            const matches = emojiArray.filter((item: string) => item && item.toLowerCase().includes(search.toLowerCase())).slice(0, 25)

            interaction.respond(matches.map((emoji) => ({
                name: emoji!,
                value: emoji!
            })))
        }
    }
    slashCommand = new SlashCommandBuilder()
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
        ]);
}
