import { Command } from "../command.ts";
import {
    ApplicationIntegrationType,
    ChatInputCommandInteraction,
    InteractionContextType,
    SlashCommandBuilder
} from "discord.js";
import { type Config } from "../config.ts";
import packageJson from "../../package.json" with {type: "json"};

function toHumanReadableTime(n: number) {
    let result = []
    const multipiers = {
        day: 24 * 60 * 60,
        hour: 60 * 60,
        minute: 60,
        second: 1
    }
    for (const [unit, value] of Object.entries(multipiers)) {
        if (n > value) {
            const count = Math.floor(n / value)
            const pluralizedUnit = count === 1 ? unit : unit + "s"
            result.push(`${count} ${pluralizedUnit}`)
            n -= count * value
        }
    }
    return result.join(", ")
}

export default class PingCommand extends Command {
    async run(interaction: ChatInputCommandInteraction, config: Config) {
        const mem = process.memoryUsage()
        const memoryUsage = Object.values(mem).reduce((a, b) => a + b, 0)

        await interaction.reply({
            content: `amy jr - stats
uptime: ${toHumanReadableTime(process.uptime())}
memory: ${Math.floor(memoryUsage / 1024 / 1024)} mb
node: \`${process.versions.node}\`, discord.js: \`${packageJson.dependencies["discord.js"].replace(/[^\d\.]/g, "")}\``,
        });
    }
    dependsOn = []
    slashCommand = new SlashCommandBuilder()
        .setName("process")
        .setDescription("info for NERDS").setIntegrationTypes([
            ApplicationIntegrationType.UserInstall
        ])
        .setContexts([
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
        ]);
}
