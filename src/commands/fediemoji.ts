import {Command} from "../command.ts";
import {
    ApplicationIntegrationType, AutocompleteFocusedOption, AutocompleteInteraction,
    ChatInputCommandInteraction,
    InteractionContextType, RESTGetAPIApplicationEmojisResult, Routes,
    SlashCommandBuilder
} from "discord.js";
import { Config } from "../config.ts";

export default class FediemojiCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        await interaction.deferReply();
        const emojiname = interaction.options.getString("emoji");
        const data = await (interaction.client.rest.get(
            Routes.applicationEmojis(interaction.applicationId)
        ) as Promise<RESTGetAPIApplicationEmojisResult>);
        const shit = data.items
        const theEmojiInApplicationEmojis = shit.find((item) => item.name === emojiname);
        if (!theEmojiInApplicationEmojis) {
            const emojis = (await fetch("https://"+config.sharkeyInstance+"/api/emojis").then((res) => res.json()))
            const emojiArray = emojis.emojis.map((i: {name: string}) => i.name)
            const theEmojiWeWannaUpload = emojis.emojis.find((emoji:{name:string}) => emoji.name === emojiname)!;
            console.log(theEmojiWeWannaUpload)
            interaction.client.application.emojis.create({
                attachment: theEmojiWeWannaUpload.url,
                name: theEmojiWeWannaUpload.name,
            }).then(emoji => interaction.followUp(`${emoji}`))
        } else {
            await interaction.followUp(`<${theEmojiInApplicationEmojis.animated ? 'a' : ''}:${theEmojiInApplicationEmojis.name}:${theEmojiInApplicationEmojis.id}>`)
        }
    }

    async autoComplete(interaction: AutocompleteInteraction, config: Config, option: AutocompleteFocusedOption): Promise<void> {
        if (option.name === 'emoji') {
            const search = option.value
            const emojis = (await fetch("https://"+config.sharkeyInstance+"/api/emojis").then((res) => res.json()))
            const emojiArray = emojis.emojis.map((i: {name: string}) => i.name)
            const matches = emojiArray.filter((item: string) => item && item.toLowerCase().includes(search.toLowerCase())).slice(0, 25)

            interaction.respond(matches.map((emoji: { name: any; }) => ({
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
