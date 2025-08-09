import {
    ApplicationCommandType,
    ContextMenuCommandBuilder,
    ContextMenuCommandInteraction,
    Message
} from "discord.js";
import { declareCommand } from "../command";
import { NO_EXTRA_CONFIG } from "../config";

export default declareCommand({
    dependsOn: NO_EXTRA_CONFIG,
    commandName: "uwuifier",
    targetType: ApplicationCommandType.Message,
    contextDefinition: new ContextMenuCommandBuilder()
        .setName('uwuify')
        .setType(ApplicationCommandType.Message),
    async run(interaction: ContextMenuCommandInteraction, target: Message): Promise<void> {

        const endings = [
            "rawr x3",
            "OwO",
            "UwU",
            "o.O",
            "-.-",
            ">w<",
            "(⑅˘꒳˘)",
            "(ꈍᴗꈍ)",
            "(˘ω˘)",
            "(U ᵕ U❁)",
            "σωσ",
            "òωó",
            "(///ˬ///✿)",
            "(U ﹏ U)",
            "( ͡o ω ͡o )",
            "ʘwʘ",
            ":3",
            ":3",
            "XD",
            "nyaa~~",
            "mya",
            ">_<",
            "😳",
            "🥺",
            "😳😳😳",
            "rawr",
            "^^",
            "^^;;",
            "(ˆ ﻌ ˆ)♡",
            "^•ﻌ•^",
            "/(^•ω•^)",
            "(✿oωo)"
        ];

        const replacements = [
            ["small", "smol"],
            ["cute", "kawaii~"],
            ["fluff", "floof"],
            ["love", "luv"],
            ["stupid", "baka"],
            ["what", "nani"],
            ["meow", "nya~"],
            ["hello", "hewwo"],
        ];
        await interaction.deferReply();
        let message = target.content;
        function getRandomElement<T>(arr: T[]): T {
            const randomIndex = Math.floor(Math.random() * arr.length);
            return arr[randomIndex];
        }


        function uwuify(message: string): string {
            message = message.toLowerCase();
            for (const pair of replacements) {
                message = message.replaceAll(pair[0], pair[1]);
            }
            message = message
                .replaceAll(/([ \t\n])n/g, "$1ny")
                .replaceAll(/[lr]/g, "w")
                .replaceAll(/([ \t\n])([a-z])/g, (_, p1, p2) => Math.random() < .5 ? `${p1}${p2}-${p2}` : `${p1}${p2}`)
                .replaceAll(/([^.,!][.,!])([ \t\n])/g, (_, p1, p2) => `${p1} ${getRandomElement(endings)}${p2}`);
            return message;
        }

        interaction.followUp(uwuify(message));

    }
})